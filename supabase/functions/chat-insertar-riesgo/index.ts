// Edge function: chat-insertar-riesgo
// Inserta un riesgo en un folio. Respeta locks: solo permite si el folio está en 'Borrador'.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { aListaNumerada, aControlesPrevencionTexto } from "../_shared/listas-riesgo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const InputSchema = z.object({ folio_id: z.string().uuid(), conversacion_id: z.string().uuid().nullish(),
  mensaje_id: z.string().uuid().optional(), tool_id: z.string().min(1).max(200).optional(), force: z.boolean().optional(),
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonErr("no autorizado", 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error: authError } = await userClient.auth.getClaims(authHeader.replace(/^Bearer\s+/i, ""));
    if (authError || !data?.claims?.sub) return jsonErr("sesión inválida", 401);
    const user = { id: data.claims.sub };

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) return jsonErr("Datos de propuesta inválidos", 400);
    const body = parsed.data as any;
    const folio_id: string = body.folio_id;
    if (!folio_id) return jsonErr("folio_id requerido", 400);
    const conversacion_id: string | null = body.conversacion_id ?? null;
    const force: boolean = body.force === true;

    // Validar estado del folio (Borrador)
    const { data: folio, error: fErr } = await userClient
      .from("folios")
      .select("id, estado, org_id")
      .eq("id", folio_id)
      .maybeSingle();
    if (fErr) return jsonErr(fErr.message, 500);
    if (!folio) return jsonErr("folio no encontrado", 404);
    const { data: activeOrg } = await userClient.rpc("get_user_org_id");
    if (folio.org_id !== activeOrg) return jsonErr("Folio fuera de la empresa activa", 403);
    if (folio.estado !== "Borrador") {
      return jsonErr(`No se puede insertar: el folio está en estado "${folio.estado}". Solo se permiten cambios en Borrador.`, 409);
    }

    const payload: any = {
      folio_id,
      peligro: body.peligro ?? "",
      peligro_modo_falla: body.modo_falla ?? body.peligro_modo_falla ?? "",
      situacion_peligrosa: body.situacion_peligrosa ?? "",
      secuencia_eventos: aListaNumerada(body.secuencia_eventos, 8),
      efecto_dano: body.efecto_dano ?? "",
      causa_potencial: aListaNumerada(body.causa_potencial, 8),
      etapa_proceso: body.etapa_proceso ?? "",
      controles_actuales: body.controles_existentes ?? body.controles_actuales ?? "",
      controles_prevencion: aControlesPrevencionTexto(body.controles_prevencion, 12),
      controles_deteccion: aListaNumerada(body.controles_deteccion, 8),
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
      tipo_escala_severidad:
        body.tipo_escala_severidad === "sgc_regulatorio" ? "sgc_regulatorio" : "estandar",
      ...(body.mensaje_id && body.tool_id ? { ia_origen: { mensaje_id: body.mensaje_id, tool_id: body.tool_id } } : {}),
    };

    const { data: duplicate, error: dupErr } = await userClient
      .from("riesgos")
      .select("id, numero_id, npr")
      .eq("folio_id", folio_id)
      .eq("peligro", payload.peligro)
      .eq("situacion_peligrosa", payload.situacion_peligrosa)
      .eq("efecto_dano", payload.efecto_dano)
      .maybeSingle();
    if (dupErr) return jsonErr(dupErr.message, 500);
    if (duplicate) {
      return new Response(JSON.stringify({ ok: true, duplicate: true, riesgo: duplicate }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validación anti-duplicados por similitud (peligro >80% + misma etapa_proceso)
    if (!force) {
      const { data: candidatos, error: cErr } = await userClient
        .from("riesgos")
        .select("id, numero_id, peligro, etapa_proceso")
        .eq("folio_id", folio_id)
        .eq("etapa_proceso", payload.etapa_proceso);
      if (cErr) return jsonErr(cErr.message, 500);
      const similar = (candidatos ?? []).find((r: any) =>
        stringSimilarity(normalize(r.peligro), normalize(payload.peligro)) > 0.8
      );
      if (similar) {
        return new Response(JSON.stringify({
          ok: false,
          inserted: false,
          reason: "duplicate",
          existing_id: similar.numero_id ?? similar.id,
          existing_peligro: similar.peligro,
          message: `Ya existe un ID similar: ${similar.peligro}. ¿Es un riesgo diferente o es el mismo?`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
          .eq("id", conversacion_id).eq("org_id", folio.org_id).eq("created_by", user.id);
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

function normalize(s: string): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Similaridad por bigramas (Dice coefficient) — 0..1
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.substring(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let totalA = 0;
  for (const v of A.values()) totalA += v;
  let totalB = 0;
  for (const [bg, vb] of B.entries()) {
    totalB += vb;
    const va = A.get(bg);
    if (va) inter += Math.min(va, vb);
  }
  return (2 * inter) / (totalA + totalB);
}

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}