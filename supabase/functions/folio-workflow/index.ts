// supabase/functions/folio-workflow/index.ts
// Maneja 3 acciones:
//   1. enviar-a-firma   → cambia estado + correos al comité
//   2. firmar           → registra firma + notifica RS si todos firmaron
//   3. dictamen         → RS aprueba o rechaza + correo al capturista

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://tu-app.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "No autorizado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Cliente del usuario actual (para verificar identidad)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "No autorizado" }, 401);

  // Cliente admin (para operaciones de sistema)
  const admin = createClient(supabaseUrl, serviceKey);

  const { accion, folio_id, motivo } = await req.json();

  // ─────────────────────────────────────────────
  // ACCIÓN 1: Enviar folio a firma
  // ─────────────────────────────────────────────
  if (accion === "enviar-a-firma") {
    // Verificar que el folio existe y está en Borrador
    const { data: folio, error: fErr } = await admin
      .from("folios")
      .select("id, codigo, proceso_equipo, estado, created_by")
      .eq("id", folio_id)
      .single();

    if (fErr || !folio) return json({ error: "Folio no encontrado" }, 404);
    if (folio.estado !== "Borrador") return json({ error: "El folio no está en Borrador" }, 400);
    if (folio.created_by !== user.id) {
      // Verificar si es admin
      const { data: rol } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "responsable_sanitario"])
        .maybeSingle();
      if (!rol) return json({ error: "Sin permiso para enviar este folio" }, 403);
    }

    // Cambiar estado a En Firma
    await admin.from("folios").update({ estado: "En Firma" }).eq("id", folio_id);

    // Obtener miembros del comité con email
    const { data: comite } = await admin
      .from("folio_comite")
      .select("id, nombre, cargo, user_id")
      .eq("folio_id", folio_id);

    if (comite && comite.length > 0) {
      // Obtener emails de los miembros
      for (const miembro of comite) {
        if (!miembro.user_id) continue;

        const { data: perfil } = await admin
          .from("profiles")
          .select("email, nombre")
          .eq("id", miembro.user_id)
          .single();

        if (!perfil?.email) continue;

        // Enviar correo a cada miembro
        await enviarCorreo(admin, {
          to: perfil.email,
          subject: `[DIAFRA] Solicitud de firma — ${folio.codigo}`,
          html: plantillaFirma({
            nombre: perfil.nombre || miembro.nombre,
            folio_codigo: folio.codigo,
            proceso: folio.proceso_equipo,
            link: `${APP_URL}/folios/${folio_id}`,
          }),
        });
      }
    }

    return json({ success: true, mensaje: `Folio ${folio.codigo} enviado a firma` });
  }

  // ─────────────────────────────────────────────
  // ACCIÓN 2: Registrar firma de un miembro
  // ─────────────────────────────────────────────
  if (accion === "firmar") {
    // Verificar que el miembro pertenece al comité de este folio
    const { data: entrada } = await admin
      .from("folio_comite")
      .select("id, nombre, folio_id, firmado")
      .eq("folio_id", folio_id)
      .eq("user_id", user.id)
      .single();

    if (!entrada) return json({ error: "No eres miembro del comité de este folio" }, 403);
    if (entrada.firmado) return json({ error: "Ya firmaste este folio" }, 400);

    // Verificar que el folio está En Firma
    const { data: folio } = await admin
      .from("folios")
      .select("codigo, proceso_equipo, estado")
      .eq("id", folio_id)
      .single();

    if (folio?.estado !== "En Firma") {
      return json({ error: "El folio no está en estado En Firma" }, 400);
    }

    // Registrar firma
    await admin
      .from("folio_comite")
      .update({ firmado: true, fecha_firma: new Date().toISOString() })
      .eq("id", entrada.id);

    // Verificar si todos firmaron
    const { data: todosOk } = await admin.rpc("todos_firmaron", { p_folio_id: folio_id });

    if (todosOk) {
      // Buscar al Responsable Sanitario y notificarle
      const { data: rsRoles } = await admin.from("user_roles").select("user_id").eq("role", "responsable_sanitario");

      for (const rs of rsRoles || []) {
        const { data: rsPerfil } = await admin.from("profiles").select("email, nombre").eq("id", rs.user_id).single();

        if (!rsPerfil?.email) continue;

        await enviarCorreo(admin, {
          to: rsPerfil.email,
          subject: `[DIAFRA] ✅ Folio listo para dictamen — ${folio.codigo}`,
          html: plantillaListoParaDictamen({
            nombre: rsPerfil.nombre,
            folio_codigo: folio.codigo,
            proceso: folio.proceso_equipo,
            link: `${APP_URL}/folios/${folio_id}`,
          }),
        });
      }
    }

    return json({
      success: true,
      todos_firmaron: todosOk,
      mensaje: todosOk
        ? "Todos firmaron — Responsable Sanitario notificado"
        : "Firma registrada — esperando otros miembros",
    });
  }

  // ─────────────────────────────────────────────
  // ACCIÓN 3: Dictamen del Responsable Sanitario
  // ─────────────────────────────────────────────
  if (accion === "dictamen") {
    const { conclusion } = await req.json().catch(() => ({}));
    // conclusion debe ser "Aprobado" o "Rechazado"

    // Verificar que el usuario es Responsable Sanitario
    const { data: esRS } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "responsable_sanitario")
      .maybeSingle();

    if (!esRS) {
      return json(
        {
          error: "Solo el Responsable Sanitario puede emitir dictamen",
        },
        403,
      );
    }

    const { data: folio } = await admin
      .from("folios")
      .select("codigo, proceso_equipo, estado, created_by")
      .eq("id", folio_id)
      .single();

    if (!folio) return json({ error: "Folio no encontrado" }, 404);
    if (folio.estado !== "En Firma") {
      return json({ error: "El folio no está en estado En Firma" }, 400);
    }

    const nuevoEstado = conclusion === "Aprobado" ? "Aprobado" : "Borrador";

    // Actualizar folio
    await admin
      .from("folios")
      .update({
        estado: nuevoEstado,
        conclusion: conclusion,
      })
      .eq("id", folio_id);

    // Notificar al capturista
    if (folio.created_by) {
      const { data: capturista } = await admin
        .from("profiles")
        .select("email, nombre")
        .eq("id", folio.created_by)
        .single();

      if (capturista?.email) {
        await enviarCorreo(admin, {
          to: capturista.email,
          subject: `[DIAFRA] ${conclusion === "Aprobado" ? "✅ Aprobado" : "⚠ Requiere corrección"} — ${folio.codigo}`,
          html: plantillaDictamen({
            nombre: capturista.nombre,
            folio_codigo: folio.codigo,
            proceso: folio.proceso_equipo,
            conclusion,
            motivo: motivo || "",
            link: `${APP_URL}/folios/${folio_id}`,
          }),
        });
      }
    }

    return json({
      success: true,
      mensaje: `Folio ${folio.codigo} ${conclusion.toLowerCase()}`,
    });
  }

  return json({ error: "Acción no reconocida" }, 400);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function enviarCorreo(admin: any, { to, subject, html }: { to: string; subject: string; html: string }) {
  // Supabase usa Resend internamente cuando configuras SMTP
  // Esta función usa la API de Resend directamente como respaldo
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("RESEND_API_KEY no configurado — correo no enviado a:", to);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DIAFRA SGC <noreply@diafra.mx>",
      to,
      subject,
      html,
    }),
  });
}

// ─── Plantillas de correo ──────────────────────────────────────────────────────

function plantillaFirma({ nombre, folio_codigo, proceso, link }: any) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0f1f3d;padding:20px;text-align:center">
    <h2 style="color:#fff;margin:0">DIAFRA S.A. de C.V.</h2>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Sistema de Gestión de Calidad</p>
  </div>
  <div style="padding:28px;background:#f9f9f9">
    <p style="margin:0 0 16px">Estimado(a) <strong>${nombre}</strong>,</p>
    <p>Se te solicita firmar el siguiente Archivo Maestro de Gestión de Riesgos:</p>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Folio:</strong> ${folio_codigo}</p>
      <p style="margin:0"><strong>Proceso:</strong> ${proceso}</p>
    </div>
    <p>Haz clic en el botón para revisar el folio y registrar tu firma:</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${link}" style="background:#0f1f3d;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
        Ver y Firmar Folio
      </a>
    </div>
    <p style="color:#888;font-size:12px">Si no puedes hacer clic, copia esta URL: ${link}</p>
  </div>
  <div style="background:#eee;padding:12px;text-align:center;font-size:11px;color:#888">
    FOR-SGC-11-01 · DIAFRA S.A. de C.V. · Documento confidencial
  </div>
</div>`;
}

function plantillaListoParaDictamen({ nombre, folio_codigo, proceso, link }: any) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0f1f3d;padding:20px;text-align:center">
    <h2 style="color:#fff;margin:0">DIAFRA S.A. de C.V.</h2>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Sistema de Gestión de Calidad</p>
  </div>
  <div style="padding:28px;background:#f9f9f9">
    <p style="margin:0 0 16px">Estimado(a) <strong>${nombre}</strong>,</p>
    <div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px 16px;border-radius:4px;margin-bottom:16px">
      <strong style="color:#2e7d32">✅ Todos los miembros del comité han firmado</strong>
    </div>
    <p>El siguiente folio está listo para su dictamen de Responsable Sanitario:</p>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Folio:</strong> ${folio_codigo}</p>
      <p style="margin:0"><strong>Proceso:</strong> ${proceso}</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${link}" style="background:#2e7d32;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
        Emitir Dictamen
      </a>
    </div>
  </div>
  <div style="background:#eee;padding:12px;text-align:center;font-size:11px;color:#888">
    FOR-SGC-11-01 · DIAFRA S.A. de C.V. · Documento confidencial
  </div>
</div>`;
}

function plantillaDictamen({ nombre, folio_codigo, proceso, conclusion, motivo, link }: any) {
  const aprobado = conclusion === "Aprobado";
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0f1f3d;padding:20px;text-align:center">
    <h2 style="color:#fff;margin:0">DIAFRA S.A. de C.V.</h2>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Sistema de Gestión de Calidad</p>
  </div>
  <div style="padding:28px;background:#f9f9f9">
    <p style="margin:0 0 16px">Estimado(a) <strong>${nombre}</strong>,</p>
    <div style="background:${aprobado ? "#e8f5e9" : "#fff3e0"};border-left:4px solid ${aprobado ? "#2e7d32" : "#e65100"};padding:12px 16px;border-radius:4px;margin-bottom:16px">
      <strong style="color:${aprobado ? "#2e7d32" : "#e65100"}">
        ${aprobado ? "✅ Folio APROBADO por Responsable Sanitario" : "⚠ Folio RECHAZADO — Requiere corrección"}
      </strong>
    </div>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Folio:</strong> ${folio_codigo}</p>
      <p style="margin:0 0 6px"><strong>Proceso:</strong> ${proceso}</p>
      <p style="margin:0"><strong>Dictamen:</strong> ${conclusion}</p>
      ${motivo ? `<p style="margin:8px 0 0;color:#555"><strong>Observaciones:</strong> ${motivo}</p>` : ""}
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${link}" style="background:#0f1f3d;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
        Ver Folio
      </a>
    </div>
  </div>
  <div style="background:#eee;padding:12px;text-align:center;font-size:11px;color:#888">
    FOR-SGC-11-01 · DIAFRA S.A. de C.V. · Documento confidencial
  </div>
</div>`;
}
