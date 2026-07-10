// Registers a Trial (14 days, no card) account.
// Creates auth user (email pre-confirmed), org (plan=trial, estado=activo),
// org_member admin, and pushes contact to Brevo list 3 via connector gateway.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRIAL_DAYS = 14;
const BREVO_LIST_ID = 3;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function addToBrevo(payload: {
  email: string;
  nombre: string;
  empresa: string;
  norma: string;
  cargo: string;
}) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!lovableKey || !brevoKey) {
    console.warn("Brevo skipped: missing LOVABLE_API_KEY or BREVO_API_KEY");
    return;
  }
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/brevo/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": brevoKey,
      },
      body: JSON.stringify({
        email: payload.email,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
        attributes: {
          NOMBRE: payload.nombre,
          EMPRESA: payload.empresa,
          NORMA: payload.norma,
          ORIGEN: "Trial tracea.com.mx",
          CARGO: payload.cargo,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Brevo add contact failed [${res.status}]: ${body}`);
    }
  } catch (e) {
    console.error("Brevo add contact threw:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const nombre = String(body?.nombre ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const empresa = String(body?.empresa ?? "").trim();
  const orgSlugRaw = String(body?.org_slug ?? "").trim();
  const cargo = String(body?.cargo ?? "").trim();
  const norma = String(body?.norma ?? "NOM-241").trim();
  const aceptaTerminos = body?.acepta_terminos === true;
  const aceptaPrivacidad = body?.acepta_privacidad === true;

  const errors: Record<string, string> = {};
  if (!nombre) errors.nombre = "Nombre requerido";
  if (!email || !isValidEmail(email)) errors.email = "Email inválido";
  if (!password || password.length < 8) errors.password = "Contraseña ≥ 8 caracteres";
  if (!empresa) errors.empresa = "Empresa requerida";
  if (!orgSlugRaw || orgSlugRaw.length < 3) errors.org_slug = "Identificador inválido";
  if (!["NOM-241", "NOM-059", "MULTI"].includes(norma)) errors.norma = "Norma inválida";
  if (!aceptaTerminos || !aceptaPrivacidad) errors.legal = "Debes aceptar los documentos legales";
  if (Object.keys(errors).length) return json({ error: "Validación", fields: errors }, 400);

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null;

  const metodologia =
    norma === "NOM-059" ? "ICH-Q9" : norma === "MULTI" ? "MULTI" : "AMEF";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Email duplicado
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    // En vez de bloquear, enviamos magic link para que el usuario entre sin fricción.
    let magicLinkSent = false;
    try {
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://tracea.com.mx/" },
      });
      if (linkErr) throw linkErr;
      const actionLink = linkData?.properties?.action_link;
      if (actionLink) {
        // Reutilizamos la plantilla bienvenida-demo con el link.
        supabase.functions
          .invoke("send-transactional-email", {
            body: {
              templateName: "bienvenida-demo",
              recipientEmail: email,
              idempotencyKey: `magic-existing-${email}-${Date.now()}`,
              templateData: {
                nombre,
                empresa: empresa || "TRACEA",
                norma: norma === "NOM-059" ? "NOM-059 y FEUM" : norma === "MULTI" ? "NOM-241, NOM-059 y FEUM" : "NOM-241 y FEUM",
                trial_days: TRIAL_DAYS,
                link: actionLink,
              },
            },
          })
          .catch((e) => console.error("send-transactional-email magic-link error:", e));
        magicLinkSent = true;
      }
    } catch (e) {
      console.error("magic link (existing user) failed:", e);
    }
    return json({
      success: true,
      existing_user: true,
      magic_link_sent: magicLinkSent,
      message: magicLinkSent
        ? "Ya tienes cuenta TRACEA con este correo. Te enviamos un enlace de acceso directo a tu bandeja."
        : "Ya tienes cuenta TRACEA con este correo. Inicia sesión desde /login.",
    });
  }

  // Slug único
  const orgSlug = `${orgSlugRaw}-${Date.now().toString(36).slice(-4)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);

  // Crear org
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      nombre: empresa,
      slug: orgSlug,
      plan: "trial",
      activo: true,
      estado: "activo",
      norma_aplicable: norma,
      metodologia,
      trial_expires_at: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      terminos_aceptados_en: new Date().toISOString(),
      privacidad_aceptada_en: new Date().toISOString(),
      terminos_version: "1.0",
      privacidad_version: "1.0",
      ip_aceptacion: clientIp,
    })
    .select()
    .single();

  if (orgErr) {
    console.error("register-trial org insert error:", orgErr);
    return json({ error: "No se pudo crear la organización", detail: orgErr.message }, 500);
  }

  // Crear auth user (email confirmado; inicia sesión inmediatamente)
  const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, source: "trial_register" },
  });

  if (userErr || !newUser?.user) {
    console.error("register-trial createUser error:", userErr);
    await supabase.from("organizations").delete().eq("id", org.id);
    const msg = (userErr?.message || "").toLowerCase();
    const dup =
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      (userErr as any)?.code === "email_exists";
    if (dup) {
      return json(
        { error: "Ya existe una cuenta con este correo. Inicia sesión en tracea.com.mx" },
        409,
      );
    }
    return json({ error: userErr?.message || "No se pudo crear el usuario" }, 500);
  }

  const userId = newUser.user.id;

  await supabase
    .from("profiles")
    .update({ nombre, cargo })
    .eq("id", userId);

  const { error: memberErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "admin" });
  if (memberErr) {
    console.error("register-trial org_members error:", memberErr);
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from("organizations").delete().eq("id", org.id);
    return json({ error: memberErr.message }, 500);
  }

  await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "operador");

  await supabase.from("audit_trail").insert({
    user_id: userId,
    org_id: org.id,
    tabla: "organizations",
    registro_id: org.id,
    accion: "trial_signup",
    ip: clientIp,
    valor_nuevo: { nombre, email, empresa, norma, cargo, trial_days: TRIAL_DAYS },
  });

  // Brevo (async, no bloqueante)
  addToBrevo({ email, nombre, empresa, norma, cargo }).catch((e) =>
    console.error("addToBrevo error:", e),
  );

  return json({ success: true, org_id: org.id });
});