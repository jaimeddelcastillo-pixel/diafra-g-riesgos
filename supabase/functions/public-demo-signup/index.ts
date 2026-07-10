// Public endpoint llamado desde la landing (usetracea.mx) para crear
// cuentas demo de 14 días en TRACEA. Sin JWT — autenticado por HMAC.
//
// Contrato:
//   POST /public-demo-signup
//   Headers:
//     X-Signature: hex(HMAC-SHA256(`${timestamp}.${rawBody}`, DEMO_SIGNUP_HMAC_SECRET))
//     X-Timestamp: unix-ms (rechaza si > 5min)
//   Body JSON:
//     { nombre, email, empresa, norma: 'NOM-241'|'NOM-059'|'MULTI', telefono? }
//
// Flujo:
//   1. Valida HMAC + timestamp
//   2. Rate-limit: máx 3 demos por IP por hora (vía audit_trail)
//   3. Bloquea si el email ya existe en auth.users
//   4. Crea org (plan='trial-demo', estado='activo', trial 14 días)
//   5. Crea auth.user, profile, org_member admin, user_role admin
//   6. Genera magic link (1h) → redirect /dashboard
//   7. Encola correo 'bienvenida-demo'
//   8. Audita en audit_trail con accion='demo_signup_from_landing'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutos
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const RATE_LIMIT_MAX = 3;
const TRIAL_DAYS = 14;
const APP_BASE = Deno.env.get("APP_URL") || "https://tracea.com.mx";

const NORMAS_OK = new Set(["NOM-241", "NOM-059", "MULTI"]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "demo";
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("DEMO_SIGNUP_HMAC_SECRET");
  if (!secret) {
    console.error("DEMO_SIGNUP_HMAC_SECRET no configurado");
    return json({ error: "Servidor no configurado" }, 500);
  }

  // --- 1. HMAC + timestamp ---
  const sigHeader = req.headers.get("x-signature") || "";
  const tsHeader = req.headers.get("x-timestamp") || "";
  const ts = Number.parseInt(tsHeader, 10);
  if (!sigHeader || !ts || Number.isNaN(ts)) {
    return json({ error: "Firma o timestamp ausente" }, 401);
  }
  if (Math.abs(Date.now() - ts) > MAX_TIMESTAMP_SKEW_MS) {
    return json({ error: "Timestamp expirado" }, 401);
  }

  const rawBody = await req.text();
  const expected = await hmacHex(secret, `${tsHeader}.${rawBody}`);
  if (!timingSafeEqual(expected, sigHeader.toLowerCase())) {
    return json({ error: "Firma inválida" }, 401);
  }

  // --- 2. Parse + validación ---
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const nombre = String(body?.nombre ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const empresa = String(body?.empresa ?? "").trim();
  const telefono = String(body?.telefono ?? "").trim();
  const norma = String(body?.norma ?? "NOM-241").trim();

  const errors: Record<string, string> = {};
  if (!nombre || nombre.length > 120) errors.nombre = "Nombre requerido";
  if (!email || !isValidEmail(email) || email.length > 200) errors.email = "Email inválido";
  if (!empresa || empresa.length > 120) errors.empresa = "Empresa requerida";
  if (telefono && telefono.length > 40) errors.telefono = "Teléfono demasiado largo";
  if (!NORMAS_OK.has(norma)) errors.norma = "Norma inválida";
  if (Object.keys(errors).length) return json({ error: "Validación", fields: errors }, 400);

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "";

  const userAgent = req.headers.get("user-agent") || "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // --- 3. Rate-limit por IP (ad-hoc, vía audit_trail) ---
  if (clientIp) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("audit_trail")
      .select("*", { count: "exact", head: true })
      .eq("accion", "demo_signup_from_landing")
      .eq("ip", clientIp)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return json(
        { error: "Demasiadas solicitudes desde esta IP. Intenta de nuevo en una hora." },
        429,
      );
    }
  }

  // --- 4. ¿Email ya existe? ---
  // listUsers no soporta filtro server-side de email, así que usamos getUserByEmail vía signInWithOtp not available.
  // En su lugar consultamos profiles (tiene email único en práctica).
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    return json(
      { error: "Ya existe una cuenta con este correo. Inicia sesión en tracea.com.mx" },
      409,
    );
  }

  // --- 5. Crear org demo ---
  const metodologia = norma === "NOM-059" ? "ICH-Q9" : norma === "MULTI" ? "MULTI" : "AMEF";
  const slugBase = slugify(empresa);
  const slug = `${slugBase}-${Date.now().toString(36).slice(-5)}`;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      nombre: empresa,
      slug,
      plan: "trial-demo",
      activo: true,
      estado: "activo",
      norma_aplicable: norma,
      metodologia,
      trial_expires_at: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      terminos_aceptados_en: new Date().toISOString(),
      privacidad_aceptada_en: new Date().toISOString(),
      terminos_version: "1.0",
      privacidad_version: "1.0",
      ip_aceptacion: clientIp || null,
    })
    .select()
    .single();

  if (orgErr) {
    console.error("org insert error:", orgErr);
    return json({
      error: "No se pudo crear la organización demo",
      detail: orgErr.message,
      code: orgErr.code,
    }, 500);
  }

  // --- 6. Crear auth user (password aleatoria; entra con magic link) ---
  const tempPassword = crypto.randomUUID() + crypto.randomUUID();
  const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { nombre, source: "landing_demo" },
  });

  if (userErr || !newUser?.user) {
    console.error("createUser error:", userErr);
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

  // Profile (handle_new_user trigger ya lo insertó; actualizamos)
  await supabase
    .from("profiles")
    .update({ nombre, cargo: telefono ? `Tel: ${telefono}` : "" })
    .eq("id", userId);

  // org_members admin
  const { error: memberErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "admin" });
  if (memberErr) {
    console.error("org_members insert error:", memberErr);
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from("organizations").delete().eq("id", org.id);
    return json({ error: memberErr.message }, 500);
  }

  // user_roles admin (limpiar 'operador' default)
  await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "operador");

  // --- 7. Magic link ---
  let magicLink = `${APP_BASE}/login`;
  try {
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${APP_BASE}/dashboard` },
    });
    if (linkErr) console.error("generateLink error:", linkErr);
    if (linkData?.properties?.action_link) magicLink = linkData.properties.action_link;
  } catch (e) {
    console.error("generateLink threw:", e);
  }

  // --- 8. Audit trail ---
  await supabase.from("audit_trail").insert({
    user_id: userId,
    org_id: org.id,
    tabla: "organizations",
    registro_id: org.id,
    accion: "demo_signup_from_landing",
    ip: clientIp,
    valor_nuevo: {
      nombre,
      email,
      empresa,
      norma,
      telefono,
      user_agent: userAgent,
      trial_days: TRIAL_DAYS,
    },
  });

  // --- 9. Enviar correo bienvenida-demo (async; no bloquea respuesta) ---
  const normaLabel =
    norma === "NOM-059"
      ? "NOM-059 y FEUM"
      : norma === "MULTI"
      ? "NOM-241, NOM-059 y FEUM"
      : "NOM-241 y FEUM";

  supabase.functions
    .invoke("send-transactional-email", {
      body: {
        templateName: "bienvenida-demo",
        recipientEmail: email,
        idempotencyKey: `demo-${org.id}`,
        templateData: {
          nombre,
          empresa,
          norma: normaLabel,
          trial_days: TRIAL_DAYS,
          link: magicLink,
        },
      },
    })
    .catch((e) => console.error("send-transactional-email error:", e));

  return json({
    success: true,
    org_id: org.id,
    message: "Cuenta demo creada. Revisa tu correo.",
  });
});