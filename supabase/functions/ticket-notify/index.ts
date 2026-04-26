// Edge Function: ticket-notify
// Envía emails relacionados a tickets de soporte usando Resend.
// Tres eventos:
//   - "ticket_creado": cliente abre ticket → notifica a soporte
//   - "respuesta_soporte": soporte responde → notifica al cliente
//   - "estado_cambiado": cambio de estado → notifica al cliente

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOPORTE_EMAIL = "soporte@tracea.com.mx";
// Remitente configurable via secret EMAIL_FROM (formato: "Nombre <correo@dominio>").
// Dominio verificado: notify.tracea.com.mx
const FROM = Deno.env.get("EMAIL_FROM") ?? "TRACEA Soporte <soporte@notify.tracea.com.mx>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://tracea.com.mx";

interface ReqBody {
  evento: "ticket_creado" | "respuesta_soporte" | "estado_cambiado" | "auto_cerrado";
  ticket_id: string;
  mensaje?: string;
  estado_nuevo?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY no configurado");

    const body = (await req.json()) as ReqBody;
    if (!body.evento || !body.ticket_id) {
      return json({ error: "Parámetros faltantes" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cargar ticket + organización
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*, organizations(nombre, slug)")
      .eq("id", body.ticket_id)
      .single();

    if (tErr || !ticket) {
      return json({ error: "Ticket no encontrado" }, 404);
    }

    const orgNombre = (ticket as any).organizations?.nombre ?? "Organización";
    const ticketUrl = `${APP_URL}/soporte/${ticket.id}`;
    const adminUrl = `${APP_URL}/admin/tickets/${ticket.id}`;

    let to = "";
    let subject = "";
    let html = "";

    switch (body.evento) {
      case "ticket_creado":
        to = SOPORTE_EMAIL;
        subject = `[${ticket.codigo}] Nuevo ticket de ${orgNombre} — ${ticket.prioridad}`;
        html = renderEmail({
          titulo: `Nuevo ticket de soporte`,
          subtitulo: `${orgNombre} • ${ticket.codigo}`,
          cuerpo: `
            <p><strong>Asunto:</strong> ${escape(ticket.asunto)}</p>
            <p><strong>Categoría:</strong> ${ticket.categoria} &nbsp;•&nbsp; <strong>Prioridad:</strong> ${ticket.prioridad}</p>
            <p><strong>Solicitante:</strong> ${escape(ticket.created_by_nombre)} (${escape(ticket.created_by_email)})</p>
            <p><strong>SLA respuesta:</strong> ${formatFecha(ticket.sla_respuesta_at)}</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
            <p style="white-space:pre-wrap">${escape(ticket.descripcion)}</p>
          `,
          ctaUrl: adminUrl,
          ctaLabel: "Atender ticket",
        });
        break;

      case "respuesta_soporte":
        to = ticket.created_by_email;
        subject = `[${ticket.codigo}] Nueva respuesta de TRACEA Soporte`;
        html = renderEmail({
          titulo: `Tienes una nueva respuesta`,
          subtitulo: `${ticket.codigo} • ${escape(ticket.asunto)}`,
          cuerpo: `
            <p>El equipo de soporte ha respondido a tu ticket:</p>
            <div style="background:#f8fafc;border-left:3px solid #185FA5;padding:12px 16px;margin:16px 0;border-radius:4px">
              <p style="white-space:pre-wrap;margin:0">${escape(body.mensaje ?? "")}</p>
            </div>
          `,
          ctaUrl: ticketUrl,
          ctaLabel: "Ver conversación",
        });
        break;

      case "estado_cambiado":
        to = ticket.created_by_email;
        subject = `[${ticket.codigo}] Estado actualizado: ${body.estado_nuevo}`;
        html = renderEmail({
          titulo: `Estado actualizado`,
          subtitulo: `${ticket.codigo} • ${escape(ticket.asunto)}`,
          cuerpo: `
            <p>Tu ticket cambió a estado: <strong>${body.estado_nuevo}</strong></p>
          `,
          ctaUrl: ticketUrl,
          ctaLabel: "Ver ticket",
        });
        break;

      case "auto_cerrado":
        to = ticket.created_by_email;
        subject = `[${ticket.codigo}] Ticket cerrado automáticamente`;
        html = renderEmail({
          titulo: `Ticket cerrado por inactividad`,
          subtitulo: `${ticket.codigo} • ${escape(ticket.asunto)}`,
          cuerpo: `
            <p>Tu ticket permaneció en estado <strong>Resuelto</strong> sin actividad por más de 7 días, por lo que se cerró automáticamente.</p>
            <p style="font-size:13px;color:#475569">Si el problema persiste o necesitas reabrirlo, crea un nuevo ticket referenciando el folio <strong>${ticket.codigo}</strong>.</p>
          `,
          ctaUrl: `${APP_URL}/soporte`,
          ctaLabel: "Crear nuevo ticket",
        });
        break;
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });

    if (!r.ok) {
      const errTxt = await r.text();
      console.error("Resend error:", errTxt);
      return json({ error: "Email no enviado", detail: errTxt }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("ticket-notify error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function renderEmail(p: {
  titulo: string;
  subtitulo: string;
  cuerpo: string;
  ctaUrl: string;
  ctaLabel: string;
}) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#185FA5;color:#fff;padding:18px 24px">
        <h1 style="margin:0;font-size:18px;font-weight:600">${p.titulo}</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:.85">${p.subtitulo}</p>
      </div>
      <div style="padding:22px 24px;font-size:14px;line-height:1.55">
        ${p.cuerpo}
        <div style="margin-top:24px">
          <a href="${p.ctaUrl}" style="display:inline-block;background:#185FA5;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px">${p.ctaLabel}</a>
        </div>
      </div>
      <div style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:11px;text-align:center;border-top:1px solid #e2e8f0">
        TRACEA — Sistema de Gestión de Riesgos<br/>
        Este correo es transaccional y se envió por una acción registrada en el sistema.
      </div>
    </div>
  </body></html>`;
}