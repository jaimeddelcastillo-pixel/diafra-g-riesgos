import { InformacionRespuestaIA } from "@/components/InformacionRespuestaIA";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { TrazaIA } from "@/lib/skills-presentacion";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Loader2, Send, User, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string } & TrazaIA;

export type WizardApplyField =
  | "peligro"
  | "peligro_modo_falla"
  | "causa"
  | "situacion_peligrosa"
  | "secuencia"
  | "efecto_dano"
  | "severidad"
  | "ocurrencia"
  | "deteccion"
  | "control_prevencion"
  | "control_deteccion"
  | "accion_propuesta";

interface Props {
  folioId: string | null;
  agente?: "dm" | "farma";
  contextoSistema: string;
  paso: number;
  onApply: (field: WizardApplyField, value: string | number) => void;
  onClose?: () => void;
}

// Extrae sugerencias S/O/D y campos cualitativos de la respuesta del agente
function parseSugerencias(texto: string): Array<{ field: WizardApplyField; value: string | number; label: string }> {
  const out: Array<{ field: WizardApplyField; value: string | number; label: string }> = [];
  const seen = new Set<string>();
  const push = (field: WizardApplyField, value: string | number, label: string) => {
    const key = `${field}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ field, value, label });
  };
  const num = [
    { re: /\bseveridad\s*[:=]\s*(\d{1,2})\b/gi, f: "severidad" as const, l: "S" },
    { re: /\bS\s*=\s*(\d{1,2})\b/g, f: "severidad" as const, l: "S" },
    { re: /\bocurrencia\s*[:=]\s*(\d{1,2})\b/gi, f: "ocurrencia" as const, l: "O" },
    { re: /\bO\s*=\s*(\d{1,2})\b/g, f: "ocurrencia" as const, l: "O" },
    { re: /\bdetectabilidad\s*[:=]\s*(\d{1,2})\b/gi, f: "deteccion" as const, l: "D" },
    { re: /\bdetecci[oó]n\s*[:=]\s*(\d{1,2})\b/gi, f: "deteccion" as const, l: "D" },
    { re: /\bD\s*=\s*(\d{1,2})\b/g, f: "deteccion" as const, l: "D" },
  ];
  for (const { re, f, l } of num) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 10) push(f, n, `${l}=${n}`);
    }
  }
  // Patrón ::APLICAR field=valor::  (instrucción al agente en el prompt de sistema)
  const apl = /::APLICAR\s+(\w+)\s*=\s*([^:]+?)::/g;
  let mm: RegExpExecArray | null;
  while ((mm = apl.exec(texto)) !== null) {
    const f = mm[1].toLowerCase() as WizardApplyField;
    const v = mm[2].trim();
    push(f, /^(severidad|ocurrencia|deteccion)$/.test(f) ? parseInt(v, 10) : v, `${f}: ${v.slice(0, 30)}`);
  }
  return out;
}

export function WizardAsistente({ folioId, agente, contextoSistema, paso, onApply, onClose }: Props) {
  const { session, orgId } = useAuth();
  const [iaPrueba, setIaPrueba] = useState(false);
  useEffect(() => {
    setIaPrueba(false);
    void supabase.rpc("mi_ia_en_prueba").then(({ data }) => setIaPrueba(!!data));
  }, [orgId]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const initialSent = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const enviar = async (texto: string, esContexto = false) => {
    if (!texto.trim() || streaming || !session) return;
    const next: Msg[] = esContexto
      ? messages
      : [...messages, { role: "user", content: texto }];
    if (!esContexto) setMessages(next);
    setInput("");
    setStreaming(true);
    try {
      const payload = {
        messages: esContexto
          ? [{ role: "user", content: texto }]
          : next.map((m) => ({ role: m.role, content: m.content })),
        folio_id: folioId,
        agente,
        conversacion_id: conversacionId,
      };
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chat-asistente`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 429) {
        const d = await res.json();
        toast({ title: "Límite alcanzado", description: d.message ?? "Sin créditos", variant: "destructive" });
        return;
      }
      if (!res.ok || !res.body) {
        toast({ title: "Error", description: (await res.text()).slice(0, 200), variant: "destructive" });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let traza: TrazaIA = {};
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
            if (evt.type === "conversacion") {
              if (evt.id && !conversacionId) setConversacionId(evt.id);
              setIaPrueba(!!evt.ia_prueba_borradores);
              traza = { skills_usadas: evt.skills_usadas, modelo_ia: evt.modelo_ia };
              setMessages((m) => m.map((msg, i) => i === m.length - 1 ? { ...msg, ...traza } : msg));
            }
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              acc += evt.delta.text;
              setMessages((m) => {
                const arr = [...m];
                arr[arr.length - 1] = { role: "assistant", content: acc, ...traza };
                return arr;
              });
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  // Envía contexto automático en el primer render
  useEffect(() => {
    if (initialSent.current || !session) return;
    initialSent.current = true;
    const prompt = `${contextoSistema}\n\nResponde de forma breve y técnica, citando la norma cuando aplique. Cuando propongas un valor numérico (S, O, D) o un texto para llenar un campo del wizard, usa el formato \`::APLICAR campo=valor::\` al final (campos: severidad, ocurrencia, deteccion, peligro, peligro_modo_falla, causa, secuencia, situacion_peligrosa, efecto_dano, control_prevencion, control_deteccion, accion_propuesta). Para campos multi-elemento (secuencia, causa, control_prevencion, control_deteccion) separa cada elemento con " | " dentro del mismo ::APLICAR::, nunca los concatenes en una sola frase. Inicia confirmando que entendiste el contexto y haz 1 pregunta corta para orientar al usuario en el paso ${paso}.`;
    setMessages([{ role: "user", content: "_(contexto del wizard enviado)_" }]);
    enviar(prompt, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20 border-l">
      <div className="px-3 py-2 border-b bg-background flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="h-4 w-4 text-accent" /> Asesor IA
        </div>
        {iaPrueba && <Badge variant="secondary" className="text-[10px]">IA en prueba (borradores)</Badge>}
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs">
            Cerrar
          </Button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => {
          const sugs = m.role === "assistant" ? parseSugerencias(m.content) : [];
          return (
            <div
              key={i}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                </div>
              )}
              <div
                className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border"
                }`}
              >
                {m.role === "assistant" && <div className="flex justify-end"><InformacionRespuestaIA skills_usadas={m.skills_usadas} modelo_ia={m.modelo_ia} /></div>}
                <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content.replace(/::APLICAR[^:]+::/g, "").trim() || "…"}
                  </ReactMarkdown>
                </div>
                {sugs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sugs.map((s, k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          onApply(s.field, s.value);
                          toast({ title: "Aplicado al wizard", description: s.label });
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-accent/15 hover:bg-accent hover:text-accent-foreground text-accent text-[11px] font-medium px-2 py-0.5 transition-colors border border-accent/30"
                      >
                        <Wand2 className="h-3 w-3" /> Aplicar {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </div>
          );
        })}
        {streaming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Pensando…
          </div>
        )}
      </div>
      <div className="border-t p-2 bg-background">
        <div className="flex gap-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Pregunta sobre el paso ${paso}…`}
            rows={2}
            className="text-sm resize-none min-h-0"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => enviar(input)}
            disabled={streaming || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}