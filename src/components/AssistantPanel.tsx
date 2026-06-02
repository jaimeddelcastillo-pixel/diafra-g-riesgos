import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Paperclip, Loader2, AlertTriangle, Sparkles, FileText, FileSpreadsheet, FileType2, X, Plus, History, PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  extractFileText,
  buildAttachmentPrefix,
  ATTACHMENT_DEFAULT_PROMPT,
  type ExtractKind,
} from "@/lib/extract-file-text";

type Msg = { role: "user" | "assistant"; content: any; toolUses?: any[] };

type Conversacion = {
  id: string;
  titulo: string;
  folio_id: string | null;
  agente: string;
  ultimo_mensaje_en: string;
  mensajes_count: number;
  tiene_riesgos_insertados: boolean;
  folio?: { codigo: string } | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folioId?: string | null;
  folioCodigo?: string | null;
  mensajeInicial?: string | null;
}

const PLAN_LIMITS: Record<string, number> = {
  trial: 30, starter: 30, pro: 300, professional: 300, enterprise: -1,
};

export function AssistantPanel({ open, onOpenChange, folioId = null, folioCodigo = null, mensajeInicial = null }: Props) {
  const { org, session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [agente, setAgente] = useState<"dm" | "farma">("dm");
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [insertedRiskKeys, setInsertedRiskKeys] = useState<Set<string>>(() => new Set());

  type Attachment =
    | { file: File; status: "processing" }
    | { file: File; status: "ready"; kind: ExtractKind; text: string; truncated: boolean }
    | { file: File; status: "error"; message: string };
  const [attachment, setAttachment] = useState<Attachment | null>(null);

  // Norma multi → selector
  const showAgenteSelector = org?.norma_aplicable === "MULTI";

  useEffect(() => {
    if (!org) return;
    if (org.norma_aplicable === "NOM-059") setAgente("farma");
    else setAgente("dm");
  }, [org?.norma_aplicable]);

  useEffect(() => {
    if (open && mensajeInicial) setInput(mensajeInicial);
  }, [open, mensajeInicial]);

  useEffect(() => {
    if (!open || !org) return;
    refreshUsage();
    refreshConversaciones();
  }, [open, org?.id]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    // Radix ScrollArea forwards ref to root, so reach into the viewport directly.
    const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ block: "end", behavior });
    }
  };

  useEffect(() => {
    scrollToBottom(streaming ? "smooth" : "auto");
  }, [messages, streaming]);

  // Al abrir el panel o cambiar de conversación, ir al último mensaje.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(id);
  }, [open, conversacionId, loadingConv]);

  async function refreshUsage() {
    if (!org) return;
    const now = new Date();
    const { data } = await supabase
      .from("chat_uso_mensual")
      .select("mensajes_consumidos")
      .eq("org_id", org.id)
      .eq("year", now.getUTCFullYear())
      .eq("month", now.getUTCMonth() + 1)
      .maybeSingle();
    const limit = PLAN_LIMITS[org.plan] ?? 30;
    setUsage({ used: data?.mensajes_consumidos ?? 0, limit });
  }

  async function refreshConversaciones() {
    if (!org) return;
    const { data, error } = await supabase
      .from("chat_conversaciones")
      .select("id, titulo, folio_id, agente, ultimo_mensaje_en, mensajes_count, tiene_riesgos_insertados")
      .eq("org_id", org.id)
      .order("ultimo_mensaje_en", { ascending: false })
      .limit(50);
    if (error) {
      console.error("refreshConversaciones error:", error);
      setConversaciones([]);
      return;
    }
    const rows = (data ?? []) as any[];
    const folioIds = Array.from(new Set(rows.map((r) => r.folio_id).filter(Boolean)));
    let folioMap: Record<string, string> = {};
    if (folioIds.length > 0) {
      const { data: fdata } = await supabase
        .from("folios")
        .select("id, codigo")
        .in("id", folioIds);
      folioMap = Object.fromEntries((fdata ?? []).map((f: any) => [f.id, f.codigo]));
    }
    setConversaciones(
      rows.map((r) => ({
        ...r,
        folio: r.folio_id && folioMap[r.folio_id] ? { codigo: folioMap[r.folio_id] } : null,
      })) as Conversacion[],
    );
  }

  function nuevaConversacion() {
    setConversacionId(null);
    setMessages([]);
    setInput("");
    setInsertedRiskKeys(new Set());
  }

  async function cargarConversacion(id: string) {
    if (id === conversacionId) return;
    setLoadingConv(true);
    try {
      const { data, error } = await supabase
        .from("chat_mensajes")
        .select("role, contenido, documentos_adjuntos, created_at")
        .eq("conversacion_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const msgs: Msg[] = (data ?? []).map((r: any) => ({
        role: r.role === "assistant" ? "assistant" : "user",
        content: r.contenido ?? "",
        toolUses: r.documentos_adjuntos?.tool_uses ?? undefined,
      }));
      setMessages(msgs);
      setConversacionId(id);
    } catch (e: any) {
      toast({ title: "Error cargando conversación", description: e.message, variant: "destructive" });
    } finally {
      setLoadingConv(false);
    }
  }

  async function sendMessage() {
    if (streaming || !session) return;
    if (attachment?.status === "processing") return;
    const userText = input.trim();
    let composed = userText;
    if (attachment?.status === "ready") {
      const prefix = buildAttachmentPrefix(attachment.file.name, attachment.text);
      composed = prefix + (userText || ATTACHMENT_DEFAULT_PROMPT);
    }
    if (!composed) return;
    const next = [...messages, { role: "user" as const, content: composed }];
    setMessages(next);
    setInput("");
    setAttachment(null);
    setStreaming(true);

    try {
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chat-asistente`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          folio_id: folioId,
          agente: showAgenteSelector ? agente : undefined,
          conversacion_id: conversacionId,
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        toast({ title: "Límite alcanzado", description: data.message ?? "Sin créditos este mes", variant: "destructive" });
        setStreaming(false);
        await refreshUsage();
        return;
      }
      if (!res.ok || !res.body) {
        const t = await res.text();
        toast({ title: "Error", description: t.slice(0, 200), variant: "destructive" });
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const toolUses: any[] = [];
      let currentToolJson = "";
      let currentTool: any = null;

      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "conversacion" && evt.id) {
              if (!conversacionId) setConversacionId(evt.id);
              continue;
            }
            if (evt.type === "content_block_start" && evt.content_block?.type === "tool_use") {
              currentTool = { ...evt.content_block };
              currentToolJson = "";
            }
            if (evt.type === "content_block_delta") {
              if (evt.delta?.type === "text_delta") {
                assistantText += evt.delta.text;
                setMessages((m) => {
                  const arr = [...m];
                  arr[arr.length - 1] = { role: "assistant", content: assistantText, toolUses: [...toolUses] };
                  return arr;
                });
              }
              if (evt.delta?.type === "input_json_delta") currentToolJson += evt.delta.partial_json ?? "";
            }
            if (evt.type === "content_block_stop" && currentTool) {
              try { currentTool.input = JSON.parse(currentToolJson || "{}"); } catch { currentTool.input = {}; }
              toolUses.push(currentTool);
              currentTool = null;
              setMessages((m) => {
                const arr = [...m];
                arr[arr.length - 1] = { role: "assistant", content: assistantText, toolUses: [...toolUses] };
                return arr;
              });
            }
          } catch { /* skip */ }
        }
      }

      await refreshUsage();
      await refreshConversaciones();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  }

  async function handleFile(file: File) {
    setAttachment({ file, status: "processing" });
    const result = await extractFileText(file);
    if (result.ok === false) {
      setAttachment({ file, status: "error", message: result.message });
      return;
    }
    setAttachment({
      file,
      status: "ready",
      kind: result.kind,
      text: result.text,
      truncated: result.truncated,
    });
    if (result.truncated) {
      toast({ title: "Archivo truncado", description: "Se procesaron los primeros 8,000 caracteres." });
    }
  }

  async function insertarRiesgo(input: any) {
    const riskKey = input.__risk_key ?? JSON.stringify({ folio_id: input.folio_id, peligro: input.peligro, situacion_peligrosa: input.situacion_peligrosa, efecto_dano: input.efecto_dano });
    if (insertedRiskKeys.has(riskKey)) {
      toast({ title: "Riesgo ya insertado", description: "Esta tarjeta ya fue aplicada al folio." });
      return;
    }
    try {
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chat-insertar-riesgo`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ ...input, conversacion_id: conversacionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error ?? `Error ${res.status}`);
      }
      setInsertedRiskKeys((prev) => new Set(prev).add(riskKey));
      toast({ title: (data as any).duplicate ? "Riesgo ya existía" : "Riesgo insertado", description: `#${(data as any).riesgo.numero_id} en el folio.` });
      setMessages((m) => [...m, { role: "assistant", content: `✅ Riesgo #${(data as any).riesgo.numero_id} ${(data as any).duplicate ? "ya existía" : "insertado"} en el folio.` }]);
      refreshConversaciones();
    } catch (e: any) {
      toast({ title: "No se pudo insertar", description: e.message ?? String(e), variant: "destructive" });
    }
  }

  const limit = usage?.limit ?? 0;
  const used = usage?.used ?? 0;
  const pct = limit === -1 ? 0 : limit === 0 ? 0 : (used / limit) * 100;

  const grouped = useMemo(() => groupConversaciones(conversaciones), [conversaciones]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl flex flex-col p-0">
        <SheetHeader className="bg-primary text-primary-foreground px-4 py-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-primary-foreground flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Asistente IA — {agente === "dm" ? "Agent DM (NOM-241)" : "Agent Farma (NOM-059)"}
            </SheetTitle>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Mostrar/ocultar historial"
              className="text-primary-foreground/80 hover:text-primary-foreground p-1"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-primary-foreground/80">
            <span>{folioCodigo ? `Contexto: ${folioCodigo}` : "Sin folio activo"}</span>
            {usage && (
              <span>
                {limit === -1 ? "Ilimitado" : `${used}/${limit} mensajes`}
              </span>
            )}
          </div>
          {showAgenteSelector && (
            <div className="flex gap-1 pt-1">
              <button onClick={() => setAgente("dm")}
                className={`px-2 py-0.5 text-xs rounded ${agente === "dm" ? "bg-white text-primary" : "bg-primary-foreground/10"}`}>
                Agent DM
              </button>
              <button onClick={() => setAgente("farma")}
                className={`px-2 py-0.5 text-xs rounded ${agente === "farma" ? "bg-white text-primary" : "bg-primary-foreground/10"}`}>
                Agent Farma
              </button>
            </div>
          )}
        </SheetHeader>

        {limit !== -1 && pct >= 80 && pct < 100 && (
          <div className="bg-warning/10 text-foreground border-b border-warning/30 px-4 py-2 text-xs flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-warning" />
            Has usado el {Math.floor(pct)}% de tus mensajes este mes.
          </div>
        )}
        {limit !== -1 && pct >= 100 && (
          <div className="bg-destructive/10 text-foreground border-b border-destructive/30 px-4 py-2 text-xs flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Sin mensajes este mes. Mejora tu plan para continuar.
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {sidebarOpen && (
            <aside className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
              <div className="p-2 border-b">
                <Button size="sm" variant="outline" className="w-full justify-start gap-2 h-8" onClick={nuevaConversacion}>
                  <Plus className="h-3.5 w-3.5" /> Nueva conversación
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-3">
                  {conversaciones.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6 flex flex-col items-center gap-1">
                      <History className="h-4 w-4 opacity-50" />
                      Sin conversaciones aún
                    </div>
                  )}
                  {grouped.map(({ label, items }) => (
                    <div key={label}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-1">{label}</div>
                      <div className="space-y-1">
                        {items.map((c) => (
                          <ConversacionItem key={c.id}
                            c={c}
                            active={c.id === conversacionId}
                            onClick={() => cargarConversacion(c.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </aside>
          )}

          <ScrollArea
            className="flex-1 px-4 py-3 min-w-0 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!min-w-0"
            ref={scrollRef as any}
          >
          <div className="space-y-4 min-w-0">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-12">
                <Bot className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Hola, soy tu asistente de gestión de riesgos.</p>
                <p className="text-xs mt-1">
                  {agente === "dm"
                    ? "Asistente de Gestión de Riesgos NOM-241 y FEUM. Pregúntame sobre análisis AMEF, normativas o adjunta un documento."
                    : "Asistente de Gestión de Riesgos de Calidad NOM-059 y FEUM. Pregúntame sobre normativas o adjunta un documento."}
                </p>
              </div>
            )}
            {loadingConv && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando conversación...
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} onInsertarRiesgo={insertarRiesgo} folioId={folioId} insertedRiskKeys={insertedRiskKeys} />
            ))}
            {streaming && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Pensando...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          </ScrollArea>
        </div>

        <div className="border-t p-3 pb-6 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Shift + Enter para salto de línea · arrastra la esquina ↘ para agrandar</span>
            <button
              type="button"
              onClick={() => setComposerExpanded((v) => !v)}
              className="flex items-center gap-1 hover:text-foreground transition"
              aria-label={composerExpanded ? "Reducir editor" : "Expandir editor"}
            >
              {composerExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {composerExpanded ? "Reducir" : "Expandir"}
            </button>
          </div>
          {attachment && <AttachmentChip attachment={attachment} onRemove={() => setAttachment(null)} />}
          <div className="flex gap-2 items-end">
            <input ref={fileInputRef} type="file" hidden
              accept=".pdf,.xlsx,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={streaming || attachment?.status === "processing"}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta o pega texto largo..."
              className={`resize-y ${composerExpanded ? "min-h-[55vh] max-h-[70vh]" : "min-h-[72px] max-h-[40vh]"}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={
                streaming ||
                attachment?.status === "processing" ||
                attachment?.status === "error" ||
                (!input.trim() && attachment?.status !== "ready")
              }
            >
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConversacionItem({ c, active, onClick }: { c: Conversacion; active: boolean; onClick: () => void }) {
  const fecha = new Date(c.ultimo_mensaje_en);
  const hoy = new Date();
  const esHoy = fecha.toDateString() === hoy.toDateString();
  const sub = esHoy
    ? fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent/30 transition ${active ? "bg-accent/40" : ""}`}
    >
      <div className="flex items-center gap-1">
        {esHoy && <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" aria-label="Activa hoy" />}
        <div className="font-medium truncate flex-1">{c.titulo}</div>
      </div>
      <div className="flex items-center justify-between mt-0.5 gap-1">
        <span className="text-muted-foreground text-[10px]">{sub}</span>
        <div className="flex gap-1">
          {c.folio?.codigo && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{c.folio.codigo}</Badge>
          )}
          {c.tiene_riesgos_insertados && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">IDs</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function groupConversaciones(rows: Conversacion[]) {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfDay); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(startOfDay); startOfMonth.setDate(startOfMonth.getDate() - 30);

  const buckets: Record<string, Conversacion[]> = { "Hoy": [], "Ayer": [], "Esta semana": [], "Este mes": [], "Anteriores": [] };
  for (const c of rows) {
    const d = new Date(c.ultimo_mensaje_en);
    if (d >= startOfDay) buckets["Hoy"].push(c);
    else if (d >= startOfYesterday) buckets["Ayer"].push(c);
    else if (d >= startOfWeek) buckets["Esta semana"].push(c);
    else if (d >= startOfMonth) buckets["Este mes"].push(c);
    else buckets["Anteriores"].push(c);
  }
  return Object.entries(buckets)
    .filter(([, v]) => v.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function MessageBubble({ msg, onInsertarRiesgo, folioId, insertedRiskKeys }: { msg: Msg; onInsertarRiesgo: (i: any) => void; folioId: string | null; insertedRiskKeys: Set<string> }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-accent" : "bg-primary"}`}>
        {isUser ? <User className="h-3.5 w-3.5 text-accent-foreground" /> : <Bot className="h-3.5 w-3.5 text-primary-foreground" />}
      </div>
      <div className={`rounded-md px-3 py-2 text-sm max-w-[85%] ${isUser ? "bg-accent/10" : "bg-muted/50"}`}>
        {typeof msg.content === "string" ? (
          <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : null}
        {msg.toolUses?.map((t, i) => {
          if (t.name === "proponer_riesgo") {
            const r = t.input;
            const npr = (r.severidad ?? 0) * (r.ocurrencia ?? 0) * (r.deteccion ?? 0);
            const nprRes = (r.sev_residual ?? 0) * (r.ocu_residual ?? 0) * (r.det_residual ?? 0);
            const riskKey = JSON.stringify({ folio_id: r.folio_id ?? folioId, peligro: r.peligro, situacion_peligrosa: r.situacion_peligrosa, efecto_dano: r.efecto_dano });
            const alreadyInserted = insertedRiskKeys.has(riskKey);
            return (
              <div key={i} className="mt-2 border border-accent/30 rounded-md p-3 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3 w-3 text-accent" />
                  <span className="text-xs font-semibold">Riesgo sugerido</span>
                  <Badge variant="outline" className="text-xs">NPR {npr}</Badge>
                  {nprRes > 0 && <Badge variant="outline" className="text-xs">NPR residual {nprRes}</Badge>}
                  {r.requiere_accion && <Badge className="text-xs">Requiere acción</Badge>}
                </div>
                <div className="text-xs space-y-0.5">
                  {r.etapa_proceso && <div><strong>Etapa:</strong> {r.etapa_proceso}</div>}
                  <div><strong>Peligro:</strong> {r.peligro}</div>
                  <div><strong>Situación:</strong> {r.situacion_peligrosa}</div>
                  {r.secuencia_eventos && <div><strong>Secuencia:</strong> {r.secuencia_eventos}</div>}
                  <div><strong>Efecto:</strong> {r.efecto_dano}</div>
                  {r.causa_potencial && <div><strong>Causa:</strong> {r.causa_potencial}</div>}
                  {(r.controles_prevencion || r.controles_actuales) && (
                    <div><strong>Prevención:</strong> {r.controles_prevencion || r.controles_actuales}</div>
                  )}
                  {r.controles_deteccion && <div><strong>Detección:</strong> {r.controles_deteccion}</div>}
                  <div className="text-muted-foreground">S:{r.severidad} O:{r.ocurrencia} D:{r.deteccion}</div>
                  {nprRes > 0 && (
                    <div className="text-muted-foreground">Residual → S:{r.sev_residual} O:{r.ocu_residual} D:{r.det_residual}</div>
                  )}
                  {r.accion_propuesta && <div><strong>Acción:</strong> {r.accion_propuesta}</div>}
                  {r.responsable && <div><strong>Responsable:</strong> {r.responsable}{r.fecha_compromiso ? ` — ${r.fecha_compromiso}` : ""}</div>}
                  {r.justificacion && <div className="text-muted-foreground italic">{r.justificacion}</div>}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="h-7 text-xs"
                    disabled={alreadyInserted || (!r.folio_id && !folioId)}
                    onClick={() => onInsertarRiesgo({ ...r, folio_id: r.folio_id ?? folioId, __risk_key: riskKey })}>
                    {alreadyInserted ? "Insertado" : "Insertar"}
                  </Button>
                </div>
                {!r.folio_id && !folioId && (
                  <p className="text-xs text-muted-foreground mt-1">Abre un folio para poder insertar este riesgo.</p>
                )}
              </div>
            );
          }
          if (t.name === "buscar_folio") {
            return (
              <div key={i} className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Buscando folios: <em>{t.input?.query}</em>
              </div>
            );
          }
          if (t.name === "crear_folio") {
            return (
              <div key={i} className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Creando folio: <em>{t.input?.proceso_equipo}</em>
              </div>
            );
          }
          if (t.name === "actualizar_folio") {
            const keys = Object.keys(t.input ?? {}).filter((k) => k !== "folio_id");
            return (
              <div key={i} className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Actualizando folio: <em>{keys.join(", ")}</em>
              </div>
            );
          }
          if (t.name === "consultar_config_org" || t.name === "listar_riesgos_folio") {
            return (
              <div key={i} className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> {t.name === "consultar_config_org" ? "Consultando configuración" : "Listando riesgos del folio"}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment:
    | { file: File; status: "processing" }
    | { file: File; status: "ready"; kind: ExtractKind; text: string; truncated: boolean }
    | { file: File; status: "error"; message: string };
  onRemove: () => void;
}) {
  const Icon =
    attachment.status === "ready" && attachment.kind === "xlsx"
      ? FileSpreadsheet
      : attachment.status === "ready" && attachment.kind === "docx"
      ? FileType2
      : FileText;
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate flex-1" title={attachment.file.name}>{attachment.file.name}</span>
        {attachment.status === "processing" && (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Procesando…
          </Badge>
        )}
        {attachment.status === "ready" && (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            Listo{attachment.truncated ? " (truncado)" : ""}
          </Badge>
        )}
        {attachment.status === "error" && (
          <Badge variant="destructive">Error</Badge>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar archivo"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {attachment.status === "error" && (
        <p className="text-[11px] text-destructive leading-snug pl-6">{attachment.message}</p>
      )}
    </div>
  );
}