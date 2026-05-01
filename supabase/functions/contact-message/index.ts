// Public contact form handler — envía mensaje al soporte vía Lovable Emails
// (send-transactional-email + plantilla 'contacto-soporte').
// No JWT required (verify_jwt = false in config.toml).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const nombre = String(body?.nombre ?? "").trim();
    const empresa = String(body?.empresa ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const telefono = String(body?.telefono ?? "").trim();
    const mensaje = String(body?.mensaje ?? "").trim();

    // Basic validation
    const errors: Record<string, string> = {};
    if (!nombre || nombre.length > 120) errors.nombre = "Nombre requerido (máx 120)";
    if (!empresa || empresa.length > 120) errors.empresa = "Empresa requerida (máx 120)";
    if (!email || !isValidEmail(email) || email.length > 200) errors.email = "Email inválido";
    if (telefono && telefono.length > 40) errors.telefono = "Teléfono demasiado largo";
    if (!mensaje || mensaje.length > 4000) errors.mensaje = "Mensaje requerido (máx 4000)";

    if (Object.keys(errors).length) {
      return new Response(JSON.stringify({ error: "Validación", fields: errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: hash sencillo del payload + minuto, para evitar duplicados
    // si el usuario hace doble-click o reintenta en pocos segundos.
    const idempotencyKey = `contacto-${email}-${nombre}-${Date.now().toString().slice(0, -4)}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: invokeErr } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "contacto-soporte",
          // recipientEmail se omite: la plantilla define `to: 'soporte@tracea.com.mx'`
          recipientEmail: "soporte@tracea.com.mx",
          idempotencyKey,
          templateData: {
            nombre,
            empresa,
            email,
            telefono: telefono || "—",
            mensaje,
            fecha: new Date().toISOString(),
          },
        },
      },
    );

    if (invokeErr) {
      console.error("contact-message: send-transactional-email error", invokeErr);
      return new Response(JSON.stringify({ error: "No se pudo enviar el mensaje" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("contact-message error", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});