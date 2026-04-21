// supabase/functions/send-welcome-email/index.ts
// Genera un enlace de "recovery" (Supabase) para que el usuario defina su
// contraseña inicial y dispara la plantilla transaccional "bienvenida-usuario".
// Solo super_admin (TRACEA) o admin de la misma organización pueden invocarla.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

const APP_URL = Deno.env.get("APP_URL") ?? "https://tracea.com.mx";

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

    const { data: targetMember } = await admin
      .from("org_members")
      .select("org_id, role, organizations(nombre, slug)")
      .eq("user_id", target_user_id)
      .maybeSingle();

    // Permisos: super_admin SIEMPRE puede; admin de org solo a usuarios de SU org
    if (!isSuperAdmin) {
      const { data: callerMember } = await admin
        .from("org_members")
        .select("org_id, role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!callerMember) return json({ error: "Se requiere rol de administrador" }, 403);
      if (!targetMember || targetMember.org_id !== callerMember.org_id) {
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

    // Disparar plantilla transaccional
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
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
      }),
    });

    if (!sendRes.ok) {
      const errTxt = await sendRes.text();
      console.error("send-transactional-email failed:", errTxt);
      return json({ error: "Error enviando correo", detail: errTxt }, 502);
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