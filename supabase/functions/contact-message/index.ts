// Public contact form handler — sends an email to soporte@tracea.com.mx
// No JWT required (verify_jwt = false in config.toml).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORT_EMAIL = "soporte@tracea.com.mx";
const FROM = "TRACEA Contacto <soporte@notify.tracea.com.mx>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_KEY) {
      console.error("RESEND_API_KEY no configurado");
      return new Response(JSON.stringify({ error: "Email no configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const safe = {
      nombre: escapeHtml(nombre),
      empresa: escapeHtml(empresa),
      email: escapeHtml(email),
      telefono: telefono ? escapeHtml(telefono) : "—",
      mensaje: escapeHtml(mensaje).replace(/\n/g, "<br/>"),
    };

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #042C53;">
        <h2 style="color: #042C53; border-bottom: 2px solid #185FA5; padding-bottom: 8px;">Nuevo mensaje desde el formulario de contacto</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 8px 0; font-weight: 600; width: 140px;">Nombre:</td><td>${safe.nombre}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 600;">Empresa:</td><td>${safe.empresa}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 600;">Correo:</td><td><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
          <tr><td style="padding: 8px 0; font-weight: 600;">Teléfono:</td><td>${safe.telefono}</td></tr>
        </table>
        <h3 style="color: #185FA5; margin-top: 24px;">Mensaje</h3>
        <div style="background: #f5f7fb; padding: 16px; border-radius: 8px; line-height: 1.5;">${safe.mensaje}</div>
        <p style="margin-top: 24px; font-size: 12px; color: #888;">Enviado desde tracea.com.mx · ${new Date().toISOString()}</p>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [SUPPORT_EMAIL],
        reply_to: email,
        subject: `[Contacto TRACEA] ${nombre} — ${empresa}`,
        html,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Resend error", resp.status, text);
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