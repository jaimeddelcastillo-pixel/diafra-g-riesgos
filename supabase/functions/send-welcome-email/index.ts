// supabase/functions/send-welcome-email/index.ts
// Genera un enlace de "recovery" (Supabase) para que el usuario defina su
// contraseña inicial y dispara la plantilla transaccional "bienvenida-usuario".
// Solo super_admin (TRACEA) o admin de la misma organización pueden invocarla.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Forzamos el dominio productivo para que los correos siempre apunten a
// tracea.com.mx, sin importar lo que tenga la variable APP_URL heredada de
// despliegues anteriores (p.ej. *.lovable.app).
const APP_URL = "https://tracea.com.mx";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validar caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "No autorizado" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const target_user_id: string | undefined = body?.target_user_id;
    if (!target_user_id) return json({ error: "Falta target_user_id" }, 400);

    // ¿caller es super_admin?
    const { data: saRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const isSuperAdmin = !!saRow;

    // Datos del destinatario
    const { data: targetAuth, error: tErr } = await admin.auth.admin.getUserById(target_user_id);
    if (tErr || !targetAuth?.user?.email) {
      return json({ error: "Usuario destino no encontrado" }, 404);
    }
    const recipientEmail = targetAuth.user.email;

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("nombre, cargo")
      .eq("id", target_user_id)
      .maybeSingle();

    // Empresa de la sesión (C2b). super_admin sin soporte: empresa más antigua del destinatario.
    let sesionOrgId: string | null = null;
    let sesionAdmin = false;
    try { const ctx = await resolverContextoOrg(req); sesionOrgId = ctx.orgId; sesionAdmin = ctx.rolesEfectivos.includes("admin"); }
    catch (e) { if (!(e instanceof ContextoOrgError) || !isSuperAdmin) {
      return json({ error: e instanceof ContextoOrgError ? e.message : "Error" }, e instanceof ContextoOrgError ? e.status : 500);
    } }

    let tq = admin
      .from("org_members")
      .select("org_id, role, organizations(nombre, slug)")
      .eq("user_id", target_user_id);
    if (sesionOrgId) tq = tq.eq("org_id", sesionOrgId);
    const { data: targetMember } = await tq.order("created_at", { ascending: true }).limit(1).maybeSingle();

    // Permisos: super_admin SIEMPRE puede; admin de org solo a usuarios de SU empresa activa
    if (!isSuperAdmin) {
      if (!sesionAdmin) return json({ error: "Se requiere rol de administrador" }, 403);
      if (!targetMember) {
        return json({ error: "El usuario no pertenece a tu organización" }, 403);
      }
    }

    // Generar enlace de recovery (sirve como "definir contraseña por primera vez")
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: recipientEmail,
      options: { redirectTo: `${APP_URL}/login` },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return json({ error: linkErr?.message ?? "No se pudo generar el enlace" }, 500);
    }
    const setupUrl = linkData.properties.action_link;

    // Datos para la plantilla
    const orgNombre =
      (targetMember?.organizations as any)?.nombre ?? null;
    const rolLabelMap: Record<string, string> = {
      admin: "Administrador",
      responsable_sanitario: "Responsable Sanitario",
      comite_tecnico: "Comité Técnico",
      operador: "Operador",
      lectura: "Lectura",
      super_admin: "Super Administrador (TRACEA)",
    };
    const rolDB = (targetMember?.role as string) ?? "";
    const rolHumano = rolLabelMap[rolDB] ?? "";

    const { error: sendErr } = await enviarYRegistrar({
      templateName: "bienvenida-usuario",
      recipientEmail,
      idempotencyKey: `welcome-${target_user_id}-${Date.now()}`,
      templateData: {
        nombre: targetProfile?.nombre ?? "",
        organizacion: orgNombre ?? "",
        rol: rolHumano,
        setupUrl,
        loginUrl: `${APP_URL}/login`,
      },
    });

    if (sendErr) {
      console.error("bienvenida-usuario send failed:", sendErr.message);
      return json({ error: "Error enviando correo", detail: sendErr.message }, 502);
    }

    return json({
      success: true,
      recipient: recipientEmail,
      org: orgNombre,
    });
  } catch (err: any) {
    console.error("send-welcome-email error:", err);
    return json({ error: err?.message ?? "Error interno" }, 500);
  }
});