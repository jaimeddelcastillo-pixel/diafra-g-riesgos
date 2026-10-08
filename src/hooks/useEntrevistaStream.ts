import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-interview`;

export type TurnComplete = {
  session_id: string;
  turn_id: string;
  knowledge_created: number;
  gaps_created: number;
  contradictions_created: number;
  interviewees_suggested: number;
  current_objective: any;
  session_status: string;
  resumen_cierre?: any;
};

export type Accion = "iniciar" | "mensaje" | "pausar" | "reanudar" | "cerrar";

interface Opts {
  sessionId: string;
  /** Se llama al finalizar el turno (única fuente de verdad del panel contextual). */
  onTurnComplete: (t: TurnComplete) => void;
  /** Mensaje del asistente ya finalizado — se agrega al transcript en memoria. */
  onAssistantMessage: (texto: string) => void;
}

let currentOrgId: string | null = null;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  };
  // Solo tiene efecto server-side para super_admin (modo soporte)
  if (currentOrgId) h["x-org-id"] = currentOrgId;
  return h;
}

export function useEntrevistaStream({ sessionId, onTurnComplete, onAssistantMessage }: Opts) {
  const [enviando, setEnviando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [streamText, setStreamText] = useState("");
  const bufferRef = useRef("");

  const consultarTurno = useCallback(
    async (turnId: string): Promise<boolean> => {
      const res = await fetch(`${FN_URL}/turn/${turnId}`, { headers: await authHeaders() });
      if (!res.ok) return false;
      const t = await res.json();
      if (t?.estado !== "completado") return false;
      const asistente = (t.messages ?? [])
        .filter((m: any) => m.role === "assistant")
        .map((m: any) => m.content)
        .join("\n");
      if (asistente) onAssistantMessage(asistente);
      onTurnComplete({ ...t, session_id: sessionId, turn_id: turnId } as TurnComplete);
      return true;
    },
    [sessionId, onAssistantMessage, onTurnComplete],
  );

  const ejecutar = useCallback(
    async (accion: Accion, payload: Record<string, unknown>, turnId: string, intento = 0): Promise<void> => {
      bufferRef.current = "";
      setStreamText("");
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ action: accion, session_id: sessionId, turn_id: turnId, ...payload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 && err?.code === "partial_effects") {
          toast.warning(
            "Tu respuesta fue procesada parcialmente. La información capturada está guardada. Puedes continuar con tu siguiente mensaje.",
          );
          return;
        }
        if (res.status === 409) {
          await new Promise((r) => setTimeout(r, 3000));
          const listo = await consultarTurno(turnId);
          if (!listo) toast.info("El asistente está procesando tu respuesta anterior. Por favor espera.");
          return;
        }
        toast.error(err?.error ?? "No se pudo procesar el turno.");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buf = "";
      let reintentar = false;
      let consultar = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const partes = buf.split("\n\n");
        buf = partes.pop() ?? "";
        for (const bloque of partes) {
          const evento = /^event: (.+)$/m.exec(bloque)?.[1];
          const dataLinea = /^data: (.+)$/m.exec(bloque)?.[1];
          if (!evento || !dataLinea) continue;
          let data: any;
          try { data = JSON.parse(dataLinea); } catch { continue; }

          if (evento === "message_delta") {
            bufferRef.current += data.delta ?? "";
            setStreamText(bufferRef.current);
          } else if (evento === "tool_status") {
            setProcesando(true);
          } else if (evento === "turn_complete") {
            setProcesando(false);
            if (bufferRef.current.trim()) onAssistantMessage(bufferRef.current);
            bufferRef.current = "";
            setStreamText("");
            onTurnComplete(data as TurnComplete);
          } else if (evento === "error") {
            setProcesando(false);
            if (data.code === "pre_persist" && data.retryable && intento < 1) {
              toast.info("Ocurrió un error. Reintentando…");
              reintentar = true;
            } else if (data.code === "post_persist") {
              consultar = true;
            } else {
              toast.error(data.message ?? "Ocurrió un error al procesar el turno.");
            }
          }
        }
      }

      if (reintentar) return ejecutar(accion, payload, turnId, intento + 1);
      if (consultar) {
        const listo = await consultarTurno(turnId);
        if (!listo) {
          toast.warning(
            "La respuesta fue procesada pero hubo un problema al recibirla. Tu sesión está guardada. Puedes continuar con tu siguiente pregunta.",
          );
        }
      }
    },
    [sessionId, consultarTurno, onAssistantMessage, onTurnComplete],
  );

  const enviar = useCallback(
    async (accion: Accion, payload: Record<string, unknown> = {}) => {
      if (enviando) return;
      setEnviando(true);
      const turnId = crypto.randomUUID();
      try {
        await ejecutar(accion, payload, turnId);
      } catch (e: any) {
        toast.error(e?.message ?? "Error de conexión con el asistente.");
      } finally {
        setProcesando(false);
        setEnviando(false);
      }
    },
    [ejecutar, enviando],
  );

  return { enviar, enviando, procesando, streamText };
}
