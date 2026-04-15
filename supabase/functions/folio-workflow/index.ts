// supabase/functions/folio-workflow/index.ts v3
// Maneja 4 acciones:
//   1. enviar-a-firma   → valida completitud NOM-241 + cambia estado + correos al comité
//   2. firmar           → registra firma con hash + IP + texto_compromiso + notifica RS
//   3. dictamen         → RS aprueba o rechaza + correo al capturista
//   4. reabrir          → archiva versión actual, regresa a Borrador, incrementa versión

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://tu-app.lovable.app";

// ─── Texto de compromiso estándar para firma electrónica ─────────────────────
const TEXTO_COMPROMISO =
  "Declaro bajo protesta de decir verdad que he revisado el contenido íntegro de este Análisis de Gestión de Riesgos, que la información es correcta y completa conforme a la NOM-241-SSA1-2025 e ISO 14971:2019, y que mi firma electrónica registrada en este sistema tiene el mismo valor legal que mi firma autógrafa.";

// ─── Validación de completitud NOM-241 ───────────────────────────────────────
interface ValidacionResult {
  valido: boolean;
  errores: string[];
}

async function validarCompletitudNOM241(
  admin: ReturnType<typeof createClient>,
  folio_id: string,
): Promise<ValidacionResult> {
  const errores: string[] = [];

  // Obtener folio
  const { data: folio } = await admin.from("folios").select("*").eq("id", folio_id).single();
  if (!folio) return { valido: false, errores: ["Folio no encontrado"] };

  // Validaciones del folio
  if (!folio.alcance?.trim()) errores.push("Alcance del análisis es obligatorio");
  if (!folio.beneficio_clinico?.trim()) errores.push("Beneficio clínico del dispositivo es obligatorio (ISO 14971 §7)");
  if (!folio.riesgo_residual_global?.trim()) errores.push("Evaluación del riesgo residual global es obligatoria (ISO 14971 §8)");
  if (!folio.numero_modelo?.trim()) errores.push("Número de modelo del dispositivo es obligatorio (NOM-241 §7.5.3)");

  // Verificar que tiene al menos un riesgo
  const { data: riesgos, count } = await admin
    .from("riesgos")
    .select("*", { count: "exact" })
    .eq("folio_id", folio_id);

  if (!count || count === 0) {
    errores.push("El folio debe tener al menos un riesgo analizado");
    return { valido: false, errores };
  }

  // Validaciones por cada riesgo
  for (const r of riesgos || []) {
    const id = `Riesgo #${r.numero_id}`;

    if (!r.peligro?.trim())
      errores.push(`${id}: Peligro (fuente) es obligatorio (ISO 14971 §5.4)`);
    if (!r.situacion_peligrosa?.trim())
      errores.push(`${id}: Situación peligrosa es obligatoria (ISO 14971 §5.4)`);
    if (!r.causa_potencial?.trim())
      errores.push(`${id}: Causa potencial es obligatoria`);
    if (!r.efecto_dano?.trim())
      errores.push(`${id}: Efecto/daño es obligatorio`);

    // Riesgos con acción propuesta deben tener responsable y fecha
    if (r.requiere_accion) {
      if (!r.accion_propuesta?.trim())
        errores.push(`${id}: Acción propuesta es obligatoria cuando se requiere acción`);
      if (!r.responsable?.trim())
        errores.push(`${id}: Responsable de la acción es obligatorio`);
      if (!r.fecha_compromiso)
        errores.push(`${id}: Fecha de compromiso es obligatoria cuando se requiere acción`);
    }

    // NPR crítico (≥200 o S≥9) sin acción es no aceptable
    const nprCritico = (r.npr ?? 0) >= 200 || r.severidad >= 9;
    if (nprCritico && !r.requiere_accion && r.dictamen !== "No Aceptable") {
      errores.push(
        `${id}: NPR crítico (${r.npr}) — debe requerir acción o marcarse como No Aceptable`,
      );
    }

    // Riesgo con acción implementada debe tener verificación
    if (r.accion_implementada?.trim() && !r.verificado_por?.trim()) {
      errores.push(`${id}: Acción implementada requiere verificación (ISO 14971 §6.5)`);
    }

    // Justificación ALARP para riesgos con NPR medio (125-199) aceptados sin acción
    const nprMedio = (r.npr ?? 0) >= 125 && (r.npr ?? 0) < 200;
    if (nprMedio && r.dictamen === "Aceptable" && !r.justificacion_aceptabilidad?.trim()) {
      errores.push(
        `${id}: NPR en zona ALARP (${r.npr}) requiere justificación de aceptabilidad (ISO 14971 §7)`,
      );
    }
  }

  // Verificar que hay miembros en el comité
  const { count: miembrosCount } = await admin
    .from("folio_comite")
    .select("*", { count: "exact" })
    .eq("folio_id", folio_id);

  if (!miembrosCount || miembrosCount === 0) {
    errores.push("Debe agregar al menos un miembro al comité de revisión");
  }

  return { valido: errores.length === 0, errores };
}

// ─── Función hash SHA-256 del contenido del folio ────────────────────────────
async function generarHashDocumento(
  admin: ReturnType<typeof createClient>,
  folio_id: string,
): Promise<string> {
  const { data: folio } = await admin.from("folios").select("*").eq("id", folio_id).single();
  const { data: riesgos } = await admin.from("riesgos").select("*").eq("folio_id", folio_id);
  const { data: comite } = await admin.from("folio_comite").select("*").eq("folio_id", folio_id);

  const contenido = JSON.stringify({
    folio,
    riesgos: riesgos ?? [],
    comite: comite ?? [],
    timestamp: new Date().toISOString(),
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(contenido);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Servidor ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "No autorizado" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json();
  const { accion, folio_id, motivo } = body;

  // ─── ACCIÓN 1: Enviar folio a firma ──────────────────────────────────────────
  if (accion === "enviar-a-firma") {
    const { data: folio, error: fErr } = await admin
      .from("folios")
      .select("id, codigo, proceso_equipo, estado, created_by")
      .eq("id", folio_id)
      .single();

    if (fErr || !folio) return json({ error: "Folio no encontrado" }, 404);
    if (folio.estado !== "Borrador") return json({ error: "El folio no está en Borrador" }, 400);

    if (folio.created_by !== user.id) {
      const { data: rol } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "responsable_sanitario"])
        .maybeSingle();
      if (!rol) return json({ error: "Sin permiso para enviar este folio" }, 403);
    }

    // ── Validación NOM-241 antes de enviar ─────────────────────────────────
    const validacion = await validarCompletitudNOM241(admin, folio_id);
    if (!validacion.valido) {
      return json(
        {
          error: "El folio no cumple los requisitos NOM-241 para enviarse a firma",
          errores_nom241: validacion.errores,
        },
        422,
      );
    }

    await admin.from("folios").update({ estado: "En Firma" }).eq("id", folio_id);

    const { data: comite } = await admin
      .from("folio_comite")
      .select("id, nombre, cargo, user_id")
      .eq("folio_id", folio_id);

    if (comite && comite.length > 0) {
      for (const miembro of comite) {
        if (!miembro.user_id) continue;
        const { data: perfil } = await admin
          .from("profiles")
          .select("email, nombre")
          .eq("id", miembro.user_id)
          .single();
        if (!perfil?.email) continue;

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

  // ─── ACCIÓN 2: Registrar firma ────────────────────────────────────────────────
  if (accion === "firmar") {
    const { data: entrada } = await admin
      .from("folio_comite")
      .select("id, nombre, folio_id, firmado")
      .eq("folio_id", folio_id)
      .eq("user_id", user.id)
      .single();

    if (!entrada) return json({ error: "No eres miembro del comité de este folio" }, 403);
    if (entrada.firmado) return json({ error: "Ya firmaste este folio" }, 400);

    const { data: folio } = await admin
      .from("folios")
      .select("codigo, proceso_equipo, estado")
      .eq("id", folio_id)
      .single();

    if (folio?.estado !== "En Firma") {
      return json({ error: "El folio no está en estado En Firma" }, 400);
    }

    // Generar hash del documento al momento de la firma
    const hashDocumento = await generarHashDocumento(admin, folio_id);

    // Capturar contexto de la firma
    const ipFirma =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "desconocida";
    const userAgent = req.headers.get("user-agent") || "";

    // Verificar que el usuario envió texto de compromiso (debe ser el estándar)
    const textoCompromiso = body.texto_compromiso || TEXTO_COMPROMISO;

    await admin.from("folio_comite").update({
      firmado: true,
      fecha_firma: new Date().toISOString(),
      ip_firma: ipFirma,
      user_agent: userAgent,
      texto_compromiso: textoCompromiso,
      hash_documento: hashDocumento,
    }).eq("id", entrada.id);

    const { data: todosOk } = await admin.rpc("todos_firmaron", { p_folio_id: folio_id });

    if (todosOk) {
      const { data: rsRoles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "responsable_sanitario");

      for (const rs of rsRoles || []) {
        const { data: rsPerfil } = await admin
          .from("profiles")
          .select("email, nombre")
          .eq("id", rs.user_id)
          .single();

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
      hash_documento: hashDocumento,
      mensaje: todosOk
        ? "Todos firmaron — Responsable Sanitario notificado"
        : "Firma registrada — esperando otros miembros",
    });
  }

  // ─── ACCIÓN 3: Dictamen del Responsable Sanitario ────────────────────────────
  if (accion === "dictamen") {
    const { conclusion } = body;

    const { data: esRS } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "responsable_sanitario")
      .maybeSingle();

    if (!esRS) return json({ error: "Solo el Responsable Sanitario puede emitir dictamen" }, 403);

    const { data: folio } = await admin
      .from("folios")
      .select("codigo, proceso_equipo, estado, created_by, numero_version")
      .eq("id", folio_id)
      .single();

    if (!folio) return json({ error: "Folio no encontrado" }, 404);
    if (folio.estado !== "En Firma") return json({ error: "El folio no está en estado En Firma" }, 400);

    const nuevoEstado = conclusion === "Aprobado" ? "Aprobado" : "Borrador";

    await admin.from("folios").update({
      estado: nuevoEstado,
      conclusion: conclusion,
    }).eq("id", folio_id);

    // Si fue rechazado, archivar versión y preparar nueva revisión
    if (conclusion !== "Aprobado") {
      await admin.rpc("archivar_version_folio", {
        p_folio_id: folio_id,
        p_motivo: motivo || "Rechazado por Responsable Sanitario — requiere corrección",
      });
    }

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
            version: folio.numero_version,
            link: `${APP_URL}/folios/${folio_id}`,
          }),
        });
      }
    }

    return json({ success: true, mensaje: `Folio ${folio.codigo} ${conclusion.toLowerCase()}` });
  }

  // ─── ACCIÓN 4: Reabrir folio (archivar versión + regresar a Borrador) ────────
  if (accion === "reabrir") {
    const { data: folio } = await admin
      .from("folios")
      .select("estado, codigo")
      .eq("id", folio_id)
      .single();

    if (!folio) return json({ error: "Folio no encontrado" }, 404);
    if (!["Aprobado", "Cerrado"].includes(folio.estado)) {
      return json({ error: "Solo se pueden reabrir folios Aprobados o Cerrados" }, 400);
    }

    // Solo admin puede reabrir
    const { data: esAdmin } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "responsable_sanitario"])
      .maybeSingle();

    if (!esAdmin) return json({ error: "Solo admin o RS puede reabrir un folio aprobado" }, 403);

    const versionArchivada = await admin.rpc("archivar_version_folio", {
      p_folio_id: folio_id,
      p_motivo: motivo || "Reabierto para revisión",
    });

    await admin.from("folios").update({
      estado: "Borrador",
      conclusion: null,
    }).eq("id", folio_id);

    // Resetear firmas del comité para la nueva ronda
    await admin.from("folio_comite").update({
      firmado: false,
      fecha_firma: null,
      ip_firma: "",
      user_agent: "",
      texto_compromiso: "",
      hash_documento: "",
    }).eq("folio_id", folio_id);

    return json({
      success: true,
      version_archivada: versionArchivada.data,
      mensaje: `Folio ${folio.codigo} reabierto para nueva revisión`,
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

async function enviarCorreo(
  admin: ReturnType<typeof createClient>,
  { to, subject, html }: { to: string; subject: string; html: string },
) {
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
    <p>Se te solicita firmar el siguiente Archivo de Gestión de Riesgos:</p>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Folio:</strong> ${folio_codigo}</p>
      <p style="margin:0"><strong>Proceso:</strong> ${proceso}</p>
    </div>
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin:16px 0;font-size:12px">
      <strong>Importante:</strong> Al firmar, usted declara haber revisado el contenido íntegro y que su firma electrónica tiene el mismo valor legal que su firma autógrafa conforme a la NOM-241-SSA1-2025.
    </div>
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

function plantillaDictamen({ nombre, folio_codigo, proceso, conclusion, motivo, version, link }: any) {
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
      <p style="margin:0 0 6px"><strong>Versión:</strong> ${version}</p>
      <p style="margin:0"><strong>Dictamen:</strong> ${conclusion}</p>
      ${motivo ? `<p style="margin:8px 0 0;color:#555"><strong>Observaciones:</strong> ${motivo}</p>` : ""}
    </div>
    ${!aprobado ? `<p style="color:#666;font-size:13px">Se ha archivado la versión ${version} del documento. Se ha creado una nueva revisión para corrección.</p>` : ""}
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
