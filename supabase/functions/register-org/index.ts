// supabase/functions/register-org/index.ts
// Crea org + org_member con service role después de que el cliente hizo signUp.
// Acepta user_id del usuario recién creado (puede estar sin confirmar).

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Opciones requeridas para que service_role bypasee RLS en Edge Functions
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const {
    user_id,
    org_nombre,
    org_slug,
    pending_price_id,
    norma_aplicable,
    acepta_terminos,
    acepta_privacidad,
  } = body ?? {};

  if (!user_id || !org_nombre?.trim() || !org_slug?.trim()) {
    return json({ error: "Faltan campos: user_id, org_nombre, org_slug" }, 400);
  }

  // Validar aceptación de documentos legales (obligatorio)
  if (acepta_terminos !== true || acepta_privacidad !== true) {
    return json(
      { error: "Debes aceptar los Términos y Condiciones y el Aviso de Privacidad" },
      400,
    );
  }

  // Capturar IP del cliente para evidencia legal
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null;

  // Validar norma (default NOM-241 para retro-compatibilidad)
  const normaInput = (norma_aplicable ?? "NOM-241") as string;
  if (!["NOM-241", "NOM-059", "MULTI"].includes(normaInput)) {
    return json({ error: "norma_aplicable inválida" }, 400);
  }
  const metodologia =
    normaInput === "NOM-059" ? "ICH-Q9" : normaInput === "MULTI" ? "MULTI" : "AMEF";

  // Verificar que el user_id existe en auth.users
  const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(user_id);
  if (userErr || !authUser?.user) {
    return json({ error: "Usuario no encontrado" }, 404);
  }

  // Evitar crear duplicados si ya tiene org
  const { data: existing } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", user_id)
    .maybeSingle();

  if (existing) {
    return json({ error: "El usuario ya pertenece a una organización" }, 409);
  }

  // Verificar que el slug no esté en uso
  const { data: slugCheck } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", org_slug.trim())
    .maybeSingle();

  if (slugCheck) {
    return json({ error: "El identificador de empresa ya está en uso" }, 409);
  }

  // Crear organización
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      nombre: org_nombre.trim(),
      slug: org_slug.trim(),
      plan: "trial",
      activo: true,
      // Cuenta nace bloqueada hasta que Stripe confirme el pago
      estado: "pendiente",
      pending_price_id: pending_price_id?.trim() || null,
      norma_aplicable: normaInput,
      metodologia,
      // Trial estándar SaaS: 14 días desde el alta
      trial_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      // Evidencia de aceptación de documentos legales
      terminos_aceptados_en: new Date().toISOString(),
      privacidad_aceptada_en: new Date().toISOString(),
      terminos_version: "1.0",
      privacidad_version: "1.0",
      ip_aceptacion: clientIp,
    })
    .select()
    .single();

  if (orgErr) {
    console.error("org insert error:", orgErr);
    return json({ error: orgErr.message }, 500);
  }

  // Vincular usuario como admin de la org
  const { error: memberErr } = await admin
    .from("org_members")
    .insert({ org_id: org.id, user_id, role: "admin" });

  if (memberErr) {
    console.error("org_members insert error:", memberErr);
    // Rollback: eliminar la org recién creada
    await admin.from("organizations").delete().eq("id", org.id);
    return json({ error: memberErr.message }, 500);
  }

  // Sincronizar user_roles: el trigger handle_new_user insertó 'operador'
  // por defecto. El primer usuario de la org debe ser admin.
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert(
      { user_id, role: "admin" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  if (roleErr) {
    console.error("user_roles upsert error:", roleErr);
    // No es crítico — org_members ya tiene el rol correcto vía has_role()
  } else {
    // Eliminar el rol 'operador' duplicado que insertó el trigger
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", user_id)
      .eq("role", "operador");
  }

  return json({ success: true, org_id: org.id });
});
