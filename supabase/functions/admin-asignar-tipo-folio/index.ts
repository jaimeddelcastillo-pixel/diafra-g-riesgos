// supabase/functions/admin-asignar-tipo-folio/index.ts
// Permite a un super_admin asignar tipo_folio a folios históricos (NULL).
// NUNCA modifica el campo `codigo`. Registra la acción en audit_trail.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIPOS_VALIDOS = ["SGC", "FAB", "SIS", "CAL", "PRD", "PMS", "FV"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAccessToken(token: string, supabaseUrl: string) {
  const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${supabaseUrl}/auth/v1`,
    audience: "authenticated",
  });
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  let userId: string;
  try {
    const payload = await verifyAccessToken(token, supabaseUrl);
    if (typeof payload.sub !== "string") return json({ error: "No autorizado" }, 401);
    userId = payload.sub;
  } catch (e) {
    console.error("jwtVerify error:", e);
    return json({ error: "No autorizado" }, 401);
  }

  const { data: saCheck } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!saCheck) return json({ error: "Se requiere rol super_admin" }, 403);

  let body: { folio_id?: string; tipo?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const folio_id = body.folio_id?.trim();
  const tipo = (body.tipo ?? "").toString().trim().toUpperCase();

  if (!folio_id) return json({ error: "folio_id requerido" }, 400);
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return json({ error: `Tipo inválido. Permitidos: ${TIPOS_VALIDOS.join(", ")}` }, 400);
  }

  // Cargar folio actual
  const { data: folio, error: fErr } = await admin
    .from("folios")
    .select("id, org_id, codigo, tipo_folio")
    .eq("id", folio_id)
    .maybeSingle();
  if (fErr) return json({ error: fErr.message }, 500);
  if (!folio) return json({ error: "Folio no encontrado" }, 404);

  if (folio.tipo_folio) {
    return json({ error: `El folio ya tiene tipo asignado (${folio.tipo_folio})` }, 409);
  }

  // UPDATE — NO se toca `codigo`
  const { error: uErr } = await admin
    .from("folios")
    .update({ tipo_folio: tipo })
    .eq("id", folio_id);
  if (uErr) return json({ error: uErr.message }, 500);

  // Audit trail
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "";

  await admin.from("audit_trail").insert({
    user_id: userId,
    org_id: folio.org_id,
    tabla: "folios",
    registro_id: folio.id,
    accion: "admin_asignar_tipo_folio",
    valor_anterior: { tipo_folio: null, codigo: folio.codigo },
    valor_nuevo: { tipo_folio: tipo, codigo: folio.codigo },
    ip,
  });

  return json({ ok: true, folio_id, tipo, codigo: folio.codigo });
});