// supabase/functions/admin-reeditar-codigos/index.ts
// Corrección de códigos de folio (solo super_admin). Aplica el lote de forma
// atómica vía la RPC public.reeditar_codigos_folios y registra audit_trail.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  let body: { org_id?: string; motivo?: string; cambios?: { folio_id: string; nuevo_codigo: string }[] } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const org_id = body.org_id?.trim();
  const motivo = (body.motivo ?? "").trim();
  const cambios = Array.isArray(body.cambios) ? body.cambios : [];

  if (!org_id) return json({ error: "org_id requerido" }, 400);
  if (motivo.length < 10) return json({ error: "El motivo de la corrección es obligatorio (mínimo 10 caracteres)" }, 400);
  if (cambios.length === 0) return json({ error: "No se recibieron cambios" }, 400);
  if (cambios.length > 500) return json({ error: "Máximo 500 folios por lote" }, 400);

  const { data, error } = await admin.rpc("reeditar_codigos_folios", {
    p_org_id: org_id,
    p_cambios: cambios,
    p_motivo: motivo,
    p_actor: userId,
  });

  if (error) {
    console.error("reeditar_codigos_folios error:", error);
    return json({ error: error.message }, 400);
  }

  return json({ ok: true, ...(data as Record<string, unknown>) });
});