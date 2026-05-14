// Edge function: chat-insertar-riesgo
// Inserta un riesgo en un folio. Respeta locks: solo permite si el folio está en 'Borrador'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonErr("no autorizado", 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonErr("sesión inválida", 401);

    const body = await req.json();
    const folio_id: string = body.folio_id;
    if (!folio_id) return jsonErr("folio_id requerido", 400);
    const conversacion_id: string | null = body.conversacion_id ?? null;

    // Validar estado del folio (Borrador)
    const { data: folio, error: fErr } = await userClient
      .from("folios")
      .select("id, estado")
      .eq("id", folio_id)
      .maybeSingle();
    if (fErr) return jsonErr(fErr.message, 500);
    if (!folio) return jsonErr("folio no encontrado", 404);
    if (folio.estado !== "Borrador") {
      return jsonErr(`No se puede insertar: el folio está en estado "${folio.estado}". Solo se permiten cambios en Borrador.`, 409);
    }

    const payload: any = {
      folio_id,
      peligro: body.peligro ?? "",
      situacion_peligrosa: body.situacion_peligrosa ?? "",
      secuencia_eventos: body.secuencia_eventos ?? "",
      efecto_dano: body.efecto_dano ?? "",
      causa_potencial: body.causa_potencial ?? "",
      etapa_proceso: body.etapa_proceso ?? "",
      controles_actuales: body.controles_actuales ?? "",
      controles_prevencion: body.controles_prevencion ?? "",
      controles_deteccion: body.controles_deteccion ?? "",
      severidad: clamp(body.severidad ?? 1),
      ocurrencia: clamp(body.ocurrencia ?? 1),
      deteccion: clamp(body.deteccion ?? 1),
      justificacion_aceptabilidad: body.justificacion ?? body.justificacion_aceptabilidad ?? "",
      requiere_accion: body.requiere_accion === true,
      accion_propuesta: body.accion_propuesta ?? "",
      responsable: body.responsable ?? "",
      fecha_compromiso: body.fecha_compromiso || null,
      sev_residual: clamp(body.sev_residual ?? body.severidad ?? 1),
      ocu_residual: clamp(body.ocu_residual ?? body.ocurrencia ?? 1),
      det_residual: clamp(body.det_residual ?? body.deteccion ?? 1),
    };

    const { data: inserted, error: iErr } = await userClient
      .from("riesgos")
      .insert(payload)
      .select("id, numero_id, npr")
      .single();
    if (iErr) return jsonErr(iErr.message, 500);

    // Marcar conversación con bandera de IDs insertados
    if (conversacion_id) {
      try {
        await userClient
          .from("chat_conversaciones")
          .update({ tiene_riesgos_insertados: true })
          .eq("id", conversacion_id);
      } catch (e) { console.error("flag conv fail", e); }
    }

    return new Response(JSON.stringify({ ok: true, riesgo: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return jsonErr(String(e), 500);
  }
});

function clamp(n: number) { return Math.max(1, Math.min(10, Number(n) || 1)); }
function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}