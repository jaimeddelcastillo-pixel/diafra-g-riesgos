// admin-reset-firmas — Super-admin: resetea todas las firmas de un folio.
// No borra filas de folio_comite; sólo limpia los campos de firma.
// Registra entrada en audit_trail con accion='admin_reset_firmas'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Validar JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: "No autorizado" }, 401);
  const userId = claimsData.claims.sub as string;

  const admin = createClient(supabaseUrl, serviceKey);

  // Verificar super_admin
  const { data: rolRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!rolRow) return json({ error: "Requiere rol super_admin" }, 403);

  // Validar body
  let body: { folio_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const folio_id = body?.folio_id;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!folio_id || !uuidRe.test(folio_id)) return json({ error: "folio_id inválido" }, 400);

  // Cargar folio
  const { data: folio, error: fErr } = await admin
    .from("folios")
    .select("id, codigo, estado, org_id")
    .eq("id", folio_id)
    .maybeSingle();
  if (fErr || !folio) return json({ error: "Folio no encontrado" }, 404);

  // Contar firmas activas antes
  const { count: firmasAntes } = await admin
    .from("folio_comite")
    .select("*", { count: "exact", head: true })
    .eq("folio_id", folio_id)
    .eq("firmado", true);

  // Reset
  const { error: updErr } = await admin
    .from("folio_comite")
    .update({
      firmado: false,
      fecha_firma: null,
      ip_firma: "",
      user_agent: "",
      texto_compromiso: "",
      hash_documento: "",
    })
    .eq("folio_id", folio_id)
    .eq("firmado", true);
  if (updErr) return json({ error: `Error al resetear firmas: ${updErr.message}` }, 500);

  // Audit trail custom
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  await admin.from("audit_trail").insert({
    user_id: userId,
    org_id: folio.org_id,
    tabla: "folio_comite",
    registro_id: folio_id,
    accion: "admin_reset_firmas",
    ip,
    valor_nuevo: {
      folio_codigo: folio.codigo,
      folio_estado: folio.estado,
      firmas_reseteadas: firmasAntes ?? 0,
      motivo: "super_admin_manual_reset",
    },
  });

  return json({
    success: true,
    folio_codigo: folio.codigo,
    firmas_reseteadas: firmasAntes ?? 0,
  });
});