// Endpoint público llamado desde las landings de lead-magnet (guías/ebooks).
// Crea (o reutiliza) una cuenta trial de 14 días y envía por correo:
//   - link de descarga de la guía
//   - credenciales (email + contraseña temporal)
// Si el email ya existe, no falla: se limita a reenviar la guía con instrucción
// de usar "¿Olvidaste tu contraseña?" para recuperar acceso.
//
// Contrato:
//   POST /lead-magnet-signup
//   Body:
//     { nombre, email, empresa?, cargo?, telefono?, ebook_slug: 'dm'|'farma',
//       titulo_ebook, url_descarga }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRIAL_DAYS = 14;
const BREVO_LIST_ID = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

// Whitelist de ebooks aceptados (evita que se use el endpoint para spam
// enviando cualquier URL). El titulo y URL se validan contra este mapa.
const EBOOKS: Record<string, { titulo: string; url: string; norma: string; origen: string }> = {
  dm: {
    titulo:
      "Los 5 errores que generan observaciones en auditorías COFEPRIS — Dispositivos Médicos",
    url: "https://drive.google.com/file/d/1p1mBh6AyGxTh5tbfg6kfA7KtJ2ewu7DM/view?usp=sharing",
    norma: "NOM-241",
    origen: "Ebook NOM-241",
  },
  farma: {
    titulo:
      "Los 5 errores que generan observaciones en auditorías COFEPRIS — Farmacéutica",
    url: "https://drive.google.com/file/d/1z_dNxaPMabc0mlLsPaFSOQQEXujBJ_EG/view?usp=sharing",
    norma: "NOM-059",
    origen: "Ebook NOM-059",
  },
};

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
    .slice(0, 40) || "lead";
}

// Contraseña temporal legible (12 chars): sin caracteres ambiguos.
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  // Garantizamos al menos un dígito y una mayúscula
  return out.slice(0, 8) + "-" + out.slice(8);
}

async function addToBrevo(payload: {
  email: string;
  nombre: string;
  empresa: string;
  norma: string;
  origen: string;
  cargo?: string;
  telefono?: string;
}) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!lovableKey || !brevoKey) {
    console.warn("Brevo skipped: missing LOVABLE_API_KEY or BREVO_API_KEY");
    return;
  }
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/brevo/contacts", {
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
          ORIGEN: payload.origen,
          CARGO: payload.cargo || "",
          TELEFONO: payload.telefono || "",
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
  const empresaRaw = String(body?.empresa ?? "").trim();
  const cargoRaw = String(body?.cargo ?? "").trim();
  const telefono = String(body?.telefono ?? "").trim();
  const ebookSlug = String(body?.ebook_slug ?? "").trim().toLowerCase();

  const errors: Record<string, string> = {};
  if (!nombre || nombre.length > 120) errors.nombre = "Nombre requerido";
  if (!email || !isValidEmail(email)) errors.email = "Email inválido";
  if (!EBOOKS[ebookSlug]) errors.ebook_slug = "Guía no reconocida";
  if (Object.keys(errors).length) return json({ error: "Validación", fields: errors }, 400);

  const ebook = EBOOKS[ebookSlug];
  const empresa = empresaRaw || "Pendiente de completar";

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

  // Rate-limit por IP (5/hora) usando audit_trail.
  if (clientIp) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("audit_trail")
      .select("*", { count: "exact", head: true })
      .eq("accion", "lead_magnet_signup")
      .eq("ip", clientIp)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return json(
        { error: "Demasiadas solicitudes desde esta IP. Intenta de nuevo en una hora." },
        429,
      );
    }
  }

  // ¿Email ya existe?
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  // Rama A: usuario existente → sólo reenvía la guía + magic link para entrar.
  if (existingProfile) {
    let magicLink = "https://tracea.com.mx/login";
    try {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://tracea.com.mx/" },
      });
      if (linkData?.properties?.action_link) magicLink = linkData.properties.action_link;
    } catch (e) {
      console.error("magic link (existing user) failed:", e);
    }

    // Actualiza Brevo con el nuevo ORIGEN (permite atribuir por ebook).
    addToBrevo({
      email,
      nombre,
      empresa: empresaRaw,
      norma: ebook.norma,
      origen: ebook.origen,
      cargo: cargoRaw,
      telefono,
    }).catch(() => {});

    enviarYRegistrar({
          templateName: "ebook-descarga",
          recipientEmail: email,
          idempotencyKey: `ebook-existing-${email}-${Date.now()}`,
          templateData: {
            nombre,
            email,
            titulo_ebook: ebook.titulo,
            url_descarga: ebook.url,
            password_temporal: "(usa tu contraseña actual o el enlace de acceso directo)",
          },
        })
      .catch((e) => console.error("send-transactional-email error:", e));

    await supabase.from("audit_trail").insert({
      user_id: existingProfile.id,
      tabla: "lead_magnet",
      registro_id: existingProfile.id,
      accion: "lead_magnet_signup",
      ip: clientIp,
      valor_nuevo: {
        nombre, email, empresa: empresaRaw, cargo: cargoRaw, telefono, ebook_slug: ebookSlug,
        user_agent: userAgent, existing_user: true, magic_link_sent: true,
      },
    });

    return json({
      success: true,
      existing_user: true,
      message: "Ya tienes cuenta en TRACEA. Te enviamos la guía y un enlace de acceso directo.",
    });
  }

  // Rama B: usuario nuevo → crear org + user + credenciales.
  const metodologia = ebook.norma === "NOM-059" ? "ICH-Q9" : "AMEF";
  const slug = `${slugify(empresa)}-${Date.now().toString(36).slice(-5)}`;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      nombre: empresa,
      slug,
      plan: "trial",
      activo: true,
      estado: "activo",
      norma_aplicable: ebook.norma,
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
    console.error("lead-magnet-signup org insert error:", orgErr);
    return json({ error: "No se pudo crear la organización", detail: orgErr.message }, 500);
  }

  const tempPassword = generateTempPassword();
  const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { nombre, source: `lead_magnet_${ebookSlug}` },
  });

  if (userErr || !newUser?.user) {
    console.error("lead-magnet-signup createUser error:", userErr);
    await supabase.from("organizations").delete().eq("id", org.id);
    return json({ error: userErr?.message || "No se pudo crear el usuario" }, 500);
  }

  const userId = newUser.user.id;

  await supabase
    .from("profiles")
    .update({ nombre, cargo: cargoRaw })
    .eq("id", userId);

  const { error: memberErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "admin" });
  if (memberErr) {
    console.error("lead-magnet-signup org_members error:", memberErr);
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
    accion: "lead_magnet_signup",
    ip: clientIp,
    valor_nuevo: {
      nombre, email, empresa, cargo: cargoRaw, telefono, ebook_slug: ebookSlug,
      user_agent: userAgent, trial_days: TRIAL_DAYS,
    },
  });

  addToBrevo({
    email,
    nombre,
    empresa,
    norma: ebook.norma,
    origen: ebook.origen,
    cargo: cargoRaw,
    telefono,
  }).catch(() => {});

  enviarYRegistrar({
        templateName: "ebook-descarga",
        recipientEmail: email,
        idempotencyKey: `ebook-${org.id}`,
        templateData: {
          nombre,
          email,
          titulo_ebook: ebook.titulo,
          url_descarga: ebook.url,
          password_temporal: tempPassword,
        },
      })
    .catch((e) => console.error("send-transactional-email error:", e));

  return json({
    success: true,
    existing_user: false,
    org_id: org.id,
    message: "Te enviamos la guía y tus credenciales por correo.",
  });
});