// Solo super_admin: inicia sesión como un usuario de una empresa de PRUEBA (nombre empieza con "QA ").
// Queda registrado en la bitácora (quién, cuándo, como quién, motivo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "No autorizado" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: u, error: uErr } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (uErr || !u?.user) return json({ error: "No autorizado" }, 401);
    const caller = u.user;

    const { data: sa } = await admin.from("user_roles").select("role")
      .eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();
    if (!sa) return json({ error: "Solo super admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const { user_id, org_id } = body ?? {};
    const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
    if (!UUID_RE.test(user_id ?? "") || !UUID_RE.test(org_id ?? "")) return json({ error: "Datos inválidos" }, 400);
    if (motivo.length < 10 || motivo.length > 1000) return json({ error: "Motivo de 10 a 1000 caracteres" }, 400);
    if (user_id === caller.id) return json({ error: "No puedes entrar como tú mismo" }, 400);

    const { data: org } = await admin.from("organizations").select("id, nombre, estado").eq("id", org_id).maybeSingle();
    if (!org || !/^QA\s/i.test(org.nombre) || org.estado === "cancelado") {
      return json({ error: "Solo disponible para empresas de prueba (QA) activas" }, 403);
    }
    const { data: mem } = await admin.from("org_members").select("user_id")
      .eq("org_id", org_id).eq("user_id", user_id).maybeSingle();
    if (!mem) return json({ error: "El usuario no pertenece a esa empresa" }, 403);

    const { data: target, error: tErr } = await admin.auth.admin.getUserById(user_id);
    if (tErr || !target?.user?.email) return json({ error: "Usuario no encontrado" }, 404);

    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: "magiclink", email: target.user.email,
    });
    if (lErr || !link?.properties?.hashed_token) return json({ error: "No se pudo generar el acceso" }, 500);

    const { error: audErr } = await admin.from("audit_trail").insert({
      accion: "ENTRAR_COMO_USUARIO",
      tabla: "profiles",
      registro_id: user_id,
      org_id,
      user_id: caller.id,
      valor_nuevo: { motivo, como_usuario: target.user.email, super_admin: caller.email },
      ip: req.headers.get("x-forwarded-for") ?? null,
    });
    if (audErr) return json({ error: "No se pudo registrar en bitácora" }, 500);

    return json({ token_hash: link.properties.hashed_token, email: target.user.email });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
