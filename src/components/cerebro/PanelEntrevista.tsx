import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Pause, Play, Send, Square } from "lucide-react";
import { useEntrevistaStream, TurnComplete } from "@/hooks/useEntrevistaStream";

type Msg = { id: string; role: string; content: string; created_at: string };

interface Props {
  sessionId: string;
  onSalir: () => void;
}

export function PanelEntrevista({ sessionId, onSalir }: Props) {
  const qc = useQueryClient();
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [estado, setEstado] = useState<string>("pendiente");
  const [objetivo, setObjetivo] = useState<any>(null);
  const [sugeridosSesion, setSugeridosSesion] = useState(0);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const iniciadaRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: sesion } = useQuery({
    queryKey: ["brain", "session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_interview_sessions")
        .select("*, brain_session_processes(process_id, brain_processes(nombre))")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: transcript } = useQuery({
    queryKey: ["brain", "transcript", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_interview_messages")
        .select("id, role, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const { data: conteos } = useQuery({
    queryKey: ["brain", "session-counts", sessionId],
    queryFn: async () => {
      const { data: turnos } = await supabase
        .from("brain_interview_turns").select("id").eq("session_id", sessionId);
      const turnIds = (turnos ?? []).map((t: any) => t.id);
      const [k, g, c] = await Promise.all([
        turnIds.length
          ? supabase.from("brain_knowledge_items").select("id", { count: "exact", head: true }).in("turn_id", turnIds)
          : Promise.resolve({ count: 0 } as any),
        supabase.from("brain_gaps").select("tipo_brecha").eq("session_id", sessionId),
        supabase.from("brain_contradictions").select("id", { count: "exact", head: true }).eq("session_id", sessionId),
      ]);
      const porTipo: Record<string, number> = {};
      for (const row of (g as any).data ?? []) {
        const t = String((row as any).tipo_brecha ?? "sin_tipo");
        porTipo[t] = (porTipo[t] ?? 0) + 1;
      }
      return {
        conocimientos: (k as any).count ?? 0,
        brechas: ((g as any).data ?? []).length,
        brechasPorTipo: porTipo,
        contradicciones: (c as any).count ?? 0,
      };
    },
  });

  useEffect(() => {
    if (transcript) setMensajes(transcript);
  }, [transcript]);

  useEffect(() => {
    if (sesion?.estado) setEstado(sesion.estado);
    if (sesion?.objetivo_actual) setObjetivo({ objetivo: sesion.objetivo_actual });
  }, [sesion?.estado, sesion?.objetivo_actual]);

  const agregarMensaje = (role: string, content: string) =>
    setMensajes((m) => [...m, { id: crypto.randomUUID(), role, content, created_at: new Date().toISOString() }]);

  const onTurnComplete = (t: TurnComplete) => {
    setEstado(t.session_status ?? estado);
    if (t.current_objective) setObjetivo(t.current_objective);
    setSugeridosSesion((n) => n + (t.interviewees_suggested ?? 0));
    qc.invalidateQueries({ queryKey: ["brain", "session-counts", sessionId] });
    qc.invalidateQueries({ queryKey: ["brain", "knowledge"] });
    qc.invalidateQueries({ queryKey: ["brain", "gaps"] });
    qc.invalidateQueries({ queryKey: ["brain", "contradictions"] });
    qc.invalidateQueries({ queryKey: ["brain", "sessions"] });
  };

  const { enviar, enviando, procesando, streamText } = useEntrevistaStream({
    sessionId,
    onTurnComplete,
    onAssistantMessage: (texto) => agregarMensaje("assistant", texto),
  });

  // Apertura automática de la sesión (el primer mensaje lo genera el agente)
  useEffect(() => {
    if (!sesion || iniciadaRef.current) return;
    if (sesion.estado === "pendiente") {
      iniciadaRef.current = true;
      enviar("iniciar");
    }
  }, [sesion, enviar]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes.length, streamText]);

  const enviarMensaje = async () => {
    const texto = input.trim();
    if (!texto || enviando) return;
    setInput("");
    agregarMensaje("user", texto);
    await enviar("mensaje", { content: texto });
  };

  const procesos = useMemo(
    () => (sesion?.brain_session_processes ?? []).map((p: any) => p.brain_processes?.nombre).filter(Boolean),
    [sesion],
  );

  const activa = estado === "en_proceso";
  const cerrada = estado === "completada" || estado === "cancelada";

  return (
    <div className="grid gap-4 lg:grid-cols-[7fr_3fr]">
      {/* Columna izquierda — conversación */}
      <Card className="flex flex-col h-[70vh]">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onSalir} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Sesiones
          </Button>
          <div className="flex items-center gap-2">
            {activa && (
              <>
                <Button variant="outline" size="sm" onClick={() => enviar("pausar")} disabled={enviando} className="gap-1">
                  <Pause className="h-4 w-4" /> Pausar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmarCierre(true)} disabled={enviando} className="gap-1">
                  <Square className="h-4 w-4" /> Cerrar sesión
                </Button>
              </>
            )}
            {estado === "pausada" && (
              <Button size="sm" onClick={() => enviar("reanudar")} disabled={enviando} className="gap-1">
                <Play className="h-4 w-4" /> Reanudar
              </Button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {mensajes.map((m) => (
            <div key={m.id} className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {m.role === "assistant" ? "Consultor" : "Entrevistado"}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {streamText && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Consultor</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamText}</p>
            </div>
          )}
          {(procesando || (enviando && !streamText)) && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Procesando…
            </p>
          )}
          {estado === "pausada" && (
            <p className="text-xs text-muted-foreground">Sesión pausada.</p>
          )}
        </div>

        <Separator />
        <div className="p-3 space-y-2">
          {cerrada ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Sesión cerrada — solo lectura.</p>
              <Button asChild size="sm"><Link to="/cerebro/conocimiento">Ver conocimiento capturado</Link></Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
                }}
                placeholder={activa ? "Escribe tu respuesta…" : "La sesión no está activa"}
                disabled={!activa || enviando}
                className="min-h-[60px] resize-none"
              />
              <Button onClick={enviarMensaje} disabled={!activa || enviando || !input.trim()} size="icon" className="h-[60px] w-12">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Columna derecha — panel contextual */}
      <Card>
        <CardContent className="p-4 space-y-4 text-sm">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Entrevistado</p>
            <p className="font-medium">{sesion?.entrevistado_nombre ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {[sesion?.entrevistado_puesto, sesion?.capa].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Estado</p>
            <Badge variant="outline">{estado}</Badge>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Procesos de esta sesión</p>
            {procesos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin procesos seleccionados.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {procesos.map((n: string) => <Badge key={n} variant="secondary">{n}</Badge>)}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Esta sesión</p>
            <div className="flex justify-between"><span>Conocimientos capturados</span><span className="font-semibold">{conteos?.conocimientos ?? 0}</span></div>
            <div className="flex justify-between"><span>Brechas detectadas</span><span className="font-semibold">{conteos?.brechas ?? 0}</span></div>
            {Object.entries(conteos?.brechasPorTipo ?? {}).map(([t, n]) => (
              <div key={t} className="flex justify-between text-xs text-muted-foreground pl-3">
                <span>{t.replace(/_/g, " ")}</span><span>{n as number}</span>
              </div>
            ))}
            <div className="flex justify-between"><span>Contradicciones</span><span className="font-semibold">{conteos?.contradicciones ?? 0}</span></div>
            <div className="flex justify-between"><span>Entrevistados sugeridos</span><span className="font-semibold">{sugeridosSesion}</span></div>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Objetivo actual</p>
            <p className="text-xs text-muted-foreground">{objetivo?.objetivo ?? "Por determinar"}</p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar esta sesión de entrevista?</AlertDialogTitle>
            <AlertDialogDescription>
              La información capturada quedará guardada. Podrás continuar en una nueva sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => enviar("cerrar", { completion_reason: "user_closed" })}>
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
