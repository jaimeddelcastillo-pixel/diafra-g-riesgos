// supabase/functions/folio-workflow/index.ts v3
// Maneja 4 acciones (multi-norma: NOM-241 / NOM-059, "frozen" en folios.norma_folio):
//   1. enviar-a-firma   → valida completitud según norma + cambia estado + correos al comité
//   2. firmar           → registra firma con hash + IP + texto_compromiso + notifica aprobador
//   3. dictamen         → aprobador final aprueba o rechaza + correo al capturista
//   4. reabrir          → archiva versión actual, regresa a Borrador, incrementa versión

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://tu-app.lovable.app";

// ─── Configuración multi-norma (espejo simplificado de src/config/normas.ts) ──
// Edge functions no pueden importar de src/; mantenemos los valores aquí.
type NormaKey = "NOM-241" | "NOM-059";

interface NormaWorkflowConfig {
  nombre: string;
  nombreLargo: string;
  normasReferencia: string[];
  metodologia: string;
  usarDetectabilidad: boolean;
  umbralNPRMedio: number;
  umbralNPRAlto: number;
  umbralSeveridadCritica: number;
  terminologia: {
    beneficio: string;
    aprobadorFinal: string;
    procesoEquipo: string;
    objetoAnalisis: string;
    efectoDano: string;
    documento: string; // p.ej. "Análisis de Gestión de Riesgos"
  };
  textoCompromiso: string;
}

const NORMAS: Record<NormaKey, NormaWorkflowConfig> = {
  "NOM-241": {
    nombre: "NOM-241",
    nombreLargo: "NOM-241-SSA1-2025",
    normasReferencia: ["ISO 14971:2019", "NOM-241-SSA1-2025"],
    metodologia: "AMEF",
    usarDetectabilidad: true,
    umbralNPRMedio: 60,
    umbralNPRAlto: 150,
    umbralSeveridadCritica: 9,
    terminologia: {
      beneficio: "Beneficio clínico",
      aprobadorFinal: "Responsable Sanitario",
      procesoEquipo: "Proceso / Equipo",
      objetoAnalisis: "Dispositivo médico",
      efectoDano: "Efecto / Daño potencial",
      documento: "Archivo de Gestión de Riesgos",
    },
    textoCompromiso:
      "Declaro bajo protesta de decir verdad que he revisado el contenido íntegro de este Análisis de Gestión de Riesgos, que la información es correcta y completa conforme a la NOM-241-SSA1-2025 e ISO 14971:2019, y que mi firma electrónica registrada en este sistema tiene el mismo valor legal que mi firma autógrafa.",
  },
  "NOM-059": {
    nombre: "NOM-059",
    nombreLargo: "NOM-059-SSA1-2015",
    normasReferencia: ["ICH Q9 (R1)", "NOM-059-SSA1-2015"],
    metodologia: "ICH-Q9",
    usarDetectabilidad: true,
    umbralNPRMedio: 60,
    umbralNPRAlto: 150,
    umbralSeveridadCritica: 9,
    terminologia: {
      beneficio: "Beneficio terapéutico",
      aprobadorFinal: "Director Técnico",
      procesoEquipo: "Etapa de fabricación",
      objetoAnalisis: "Producto / Lote",
      efectoDano: "Efecto sobre calidad / paciente",
      documento: "Análisis de Gestión de Riesgos de Calidad",
    },
    textoCompromiso:
      "Declaro bajo protesta de decir verdad que he revisado el contenido íntegro de este Análisis de Gestión de Riesgos de Calidad, que la información es correcta y completa conforme a la NOM-059-SSA1-2015 e ICH Q9 (R1), y que mi firma electrónica registrada en este sistema tiene el mismo valor legal que mi firma autógrafa.",
  },
};

function getNorma(normaFolio: unknown): NormaWorkflowConfig {
  const k = (normaFolio === "NOM-059" ? "NOM-059" : "NOM-241") as NormaKey;
  return NORMAS[k];
}

// ─── Helper: datos identificativos de la organización del folio ─────────────
async function getOrgInfo(
  admin: ReturnType<typeof createClient>,
  org_id: string | null | undefined,
): Promise<{ org_nombre: string; codigo_formato: string; version_formato: string }> {
  const fallback = { org_nombre: "TRACEA", codigo_formato: "", version_formato: "" };
  if (!org_id) return fallback;
  const { data } = await admin
    .from("organizations")
    .select("nombre, codigo_formato, version_formato")
    .eq("id", org_id)
    .maybeSingle();
  if (!data) return fallback;
  return {
    org_nombre: (data as any).nombre || fallback.org_nombre,
    codigo_formato: (data as any).codigo_formato ?? "",
    version_formato: (data as any).version_formato ?? "",
  };
}

// ─── Validación de completitud (multi-norma) ─────────────────────────────────
interface ValidacionResult {
  valido: boolean;
  errores: string[];
}

async function validarCompletitudFolio(
  admin: ReturnType<typeof createClient>,
  folio_id: string,
): Promise<ValidacionResult> {
  const errores: string[] = [];

  // Obtener folio
  const { data: folio } = await admin.from("folios").select("*").eq("id", folio_id).single();
  if (!folio) return { valido: false, errores: ["Folio no encontrado"] };

  const norma = getNorma((folio as any).norma_folio);
  const t = norma.terminologia;
  const refs = norma.normasReferencia.join(" / ");

  // Validaciones del folio
  if (!folio.alcance?.trim()) errores.push("Alcance del análisis es obligatorio");
  if (!folio.beneficio_clinico?.trim())
    errores.push(`${t.beneficio} del ${t.objetoAnalisis.toLowerCase()} es obligatorio (${refs})`);
  if (!folio.riesgo_residual_global?.trim())
    errores.push(`Evaluación del riesgo residual global es obligatoria (${refs})`);
  if (!folio.numero_modelo?.trim())
    errores.push(`Identificación del ${t.objetoAnalisis.toLowerCase()} es obligatoria (${norma.nombreLargo})`);

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
      errores.push(`${id}: Peligro (fuente) es obligatorio (${refs})`);
    if (!r.situacion_peligrosa?.trim())
      errores.push(`${id}: Situación peligrosa es obligatoria (${refs})`);
    if (!r.causa_potencial?.trim())
      errores.push(`${id}: Causa potencial es obligatoria`);
    if (!r.efecto_dano?.trim())
      errores.push(`${id}: ${t.efectoDano} es obligatorio`);

    // Riesgos con acción propuesta deben tener responsable y fecha
    if (r.requiere_accion) {
      if (!r.accion_propuesta?.trim())
        errores.push(`${id}: Acción propuesta es obligatoria cuando se requiere acción`);
      if (!r.responsable?.trim())
        errores.push(`${id}: Responsable de la acción es obligatorio`);
      if (!r.fecha_compromiso)
        errores.push(`${id}: Fecha de compromiso es obligatoria cuando se requiere acción`);
    }

    // NPR crítico según umbrales de la norma
    const npr = r.npr ?? 0;
    const nprCritico = npr > norma.umbralNPRAlto || (r.severidad ?? 0) >= norma.umbralSeveridadCritica;
    if (nprCritico && !r.requiere_accion && r.dictamen !== "No Aceptable") {
      errores.push(
        `${id}: Riesgo crítico (NPR=${npr}, S=${r.severidad}) — debe requerir acción o marcarse como No Aceptable`,
      );
    }

    // Riesgo con acción implementada debe tener verificación
    if (r.accion_implementada?.trim() && !r.verificado_por?.trim()) {
      errores.push(`${id}: Acción implementada requiere verificación (${refs})`);
    }

    // Justificación ALARP para riesgos en zona media aceptados sin acción
    const nprMedio = npr >= norma.umbralNPRMedio && npr <= norma.umbralNPRAlto;
    if (nprMedio && r.dictamen === "Aceptable" && !r.justificacion_aceptabilidad?.trim()) {
      errores.push(
        `${id}: NPR en zona ALARP (${npr}) requiere justificación de aceptabilidad (${refs})`,
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

  // Get caller's org membership
  const { data: callerMember } = await admin
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  const callerOrgId = callerMember?.org_id ?? null;
  const callerRole = callerMember?.role ?? null;

  // ─── ACCIÓN 1: Enviar folio a firma ──────────────────────────────────────────
  if (accion === "enviar-a-firma") {
    const { data: folio, error: fErr } = await admin
      .from("folios")
      .select("id, codigo, proceso_equipo, estado, created_by, org_id, norma_folio")
      .eq("id", folio_id)
      .single();

    if (fErr || !folio) return json({ error: "Folio no encontrado" }, 404);
    if (folio.org_id !== callerOrgId) return json({ error: "Sin permiso para este folio" }, 403);
    if (folio.estado !== "Borrador") return json({ error: "El folio no está en Borrador" }, 400);

    if (folio.created_by !== user.id) {
      if (!["admin", "responsable_sanitario"].includes(callerRole ?? "")) {
        return json({ error: "Sin permiso para enviar este folio" }, 403);
      }
    }

    // ── Validación de completitud (multi-norma) antes de enviar ────────────
    const norma = getNorma((folio as any).norma_folio);
    const validacion = await validarCompletitudFolio(admin, folio_id);
    if (!validacion.valido) {
      return json(
        {
          error: `El folio no cumple los requisitos de ${norma.nombre} para enviarse a firma`,
          errores_norma: validacion.errores,
          // Alias retro-compatible para clientes existentes
          errores_nom241: validacion.errores,
          norma: norma.nombre,
        },
        422,
      );
    }

    await admin.from("folios").update({ estado: "En Firma" }).eq("id", folio_id);

    const { data: comite } = await admin
      .from("folio_comite")
      .select("id, nombre, cargo, user_id")
      .eq("folio_id", folio_id);

    const orgInfo = await getOrgInfo(admin, folio.org_id);

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
          subject: `[${orgInfo.org_nombre}] Solicitud de firma — ${folio.codigo}`,
          html: plantillaFirma({
            nombre: perfil.nombre || miembro.nombre,
            folio_codigo: folio.codigo,
            proceso: folio.proceso_equipo,
            link: `${APP_URL}/folios/${folio_id}`,
            norma,
            ...orgInfo,
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
      .select("codigo, proceso_equipo, estado, org_id, norma_folio")
      .eq("id", folio_id)
      .single();

    if (folio?.org_id !== callerOrgId) return json({ error: "Sin permiso para este folio" }, 403);
    if (folio?.estado !== "En Firma") {
      return json({ error: "El folio no está en estado En Firma" }, 400);
    }

    const norma = getNorma((folio as any).norma_folio);

    // Generar hash del documento al momento de la firma
    const hashDocumento = await generarHashDocumento(admin, folio_id);

    // Capturar contexto de la firma
    const ipFirma =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "desconocida";
    const userAgent = req.headers.get("user-agent") || "";

    // Texto de compromiso conforme a la norma del folio
    const textoCompromiso = body.texto_compromiso || norma.textoCompromiso;

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
      const orgInfo = await getOrgInfo(admin, folio?.org_id);
      // Notificar al aprobador final (Responsable Sanitario / Director Técnico)
      const { data: rsRoles } = await admin
        .from("org_members")
        .select("user_id")
        .eq("org_id", folio?.org_id)
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
          subject: `[${orgInfo.org_nombre}] ✅ Folio listo para dictamen — ${folio.codigo}`,
          html: plantillaListoParaDictamen({
            nombre: rsPerfil.nombre,
            folio_codigo: folio.codigo,
            proceso: folio.proceso_equipo,
            link: `${APP_URL}/folios/${folio_id}`,
            norma,
            ...orgInfo,
          }),
        });
      }
    }

    return json({
      success: true,
      todos_firmaron: todosOk,
      hash_documento: hashDocumento,
      mensaje: todosOk
        ? `Todos firmaron — ${norma.terminologia.aprobadorFinal} notificado`
        : "Firma registrada — esperando otros miembros",
    });
  }

  // ─── ACCIÓN 3: Dictamen del Responsable Sanitario ────────────────────────────
  if (accion === "dictamen") {
    const { conclusion } = body;

    if (callerRole !== "responsable_sanitario") {
      return json({ error: "Solo el Responsable Sanitario puede emitir dictamen" }, 403);
    }

    const { data: folio } = await admin
      .from("folios")
      .select("codigo, proceso_equipo, estado, created_by, numero_version, org_id, norma_folio")
      .eq("id", folio_id)
      .single();

    if (!folio) return json({ error: "Folio no encontrado" }, 404);
    if (folio.org_id !== callerOrgId) return json({ error: "Sin permiso para este folio" }, 403);
    if (folio.estado !== "En Firma") return json({ error: "El folio no está en estado En Firma" }, 400);

    const norma = getNorma((folio as any).norma_folio);

    const nuevoEstado = conclusion === "Aprobado" ? "Aprobado" : "Borrador";

    await admin.from("folios").update({
      estado: nuevoEstado,
      conclusion: conclusion,
    }).eq("id", folio_id);

    // Si fue rechazado, archivar versión y preparar nueva revisión
    if (conclusion !== "Aprobado") {
      await admin.rpc("archivar_version_folio", {
        p_folio_id: folio_id,
        p_motivo: motivo || `Rechazado por ${norma.terminologia.aprobadorFinal} — requiere corrección`,
      });
    }

    if (folio.created_by) {
      const { data: capturista } = await admin
        .from("profiles")
        .select("email, nombre")
        .eq("id", folio.created_by)
        .single();

      if (capturista?.email) {
        const orgInfo = await getOrgInfo(admin, folio.org_id);
        await enviarCorreo(admin, {
          to: capturista.email,
          subject: `[${orgInfo.org_nombre}] ${conclusion === "Aprobado" ? "✅ Aprobado" : "⚠ Requiere corrección"} — ${folio.codigo}`,
          html: plantillaDictamen({
            nombre: capturista.nombre,
            folio_codigo: folio.codigo,
            proceso: folio.proceso_equipo,
            conclusion,
            motivo: motivo || "",
            version: folio.numero_version,
            link: `${APP_URL}/folios/${folio_id}`,
            norma,
            ...orgInfo,
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
      .select("estado, codigo, org_id")
      .eq("id", folio_id)
      .single();

    if (!folio) return json({ error: "Folio no encontrado" }, 404);
    if (folio.org_id !== callerOrgId) return json({ error: "Sin permiso para este folio" }, 403);
    if (!["Aprobado", "Cerrado"].includes(folio.estado)) {
      return json({ error: "Solo se pueden reabrir folios Aprobados o Cerrados" }, 400);
    }

    if (!["admin", "responsable_sanitario"].includes(callerRole ?? "")) {
      return json({ error: "Solo admin o RS puede reabrir un folio aprobado" }, 403);
    }

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
      from: "TRACEA <noreply@tracea.mx>",
      to,
      subject,
      html,
    }),
  });
}

// ─── Plantillas de correo ──────────────────────────────────────────────────────

function footerLinea(org_nombre?: string, codigo_formato?: string, version_formato?: string) {
  const cf = (codigo_formato || "").trim();
  const vf = (version_formato || "").trim();
  const code = cf ? (vf ? `${cf} (${vf})` : cf) : "";
  const name = (org_nombre || "Organización").trim();
  return code
    ? `${code} · ${name} · Documento confidencial`
    : `${name} · Documento confidencial`;
}

function plantillaFirma({ nombre, folio_codigo, proceso, link, norma, org_nombre, codigo_formato, version_formato }: any) {
  const n: NormaWorkflowConfig = norma || NORMAS["NOM-241"];
  const procesoLabel = n.terminologia.procesoEquipo;
  const docLabel = n.terminologia.documento;
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#042C53;padding:20px;text-align:center">
    <h2 style="color:#fff;margin:0">${(org_nombre || "TRACEA").toUpperCase()}</h2>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Plataforma de Gestión de Riesgos</p>
  </div>
  <div style="padding:28px;background:#f9f9f9">
    <p style="margin:0 0 16px">Estimado(a) <strong>${nombre}</strong>,</p>
    <p>Se te solicita firmar el siguiente <strong>${docLabel}</strong> (${n.nombre} · ${n.metodologia}):</p>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Folio:</strong> ${folio_codigo}</p>
      <p style="margin:0 0 6px"><strong>${procesoLabel}:</strong> ${proceso}</p>
      <p style="margin:0"><strong>Marco normativo:</strong> ${n.normasReferencia.join(" · ")}</p>
    </div>
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin:16px 0;font-size:12px">
      <strong>Importante:</strong> Al firmar, usted declara haber revisado el contenido íntegro y que su firma electrónica tiene el mismo valor legal que su firma autógrafa conforme a ${n.nombreLargo}.
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${link}" style="background:#042C53;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
        Ver y Firmar Folio
      </a>
    </div>
    <p style="color:#888;font-size:12px">Si no puedes hacer clic, copia esta URL: ${link}</p>
  </div>
  <div style="background:#eee;padding:12px;text-align:center;font-size:11px;color:#888">
    ${footerLinea(org_nombre, codigo_formato, version_formato)}
  </div>
</div>`;
}

function plantillaListoParaDictamen({ nombre, folio_codigo, proceso, link, norma, org_nombre, codigo_formato, version_formato }: any) {
  const n: NormaWorkflowConfig = norma || NORMAS["NOM-241"];
  const procesoLabel = n.terminologia.procesoEquipo;
  const aprobador = n.terminologia.aprobadorFinal;
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#042C53;padding:20px;text-align:center">
    <h2 style="color:#fff;margin:0">${(org_nombre || "TRACEA").toUpperCase()}</h2>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Plataforma de Gestión de Riesgos</p>
  </div>
  <div style="padding:28px;background:#f9f9f9">
    <p style="margin:0 0 16px">Estimado(a) <strong>${nombre}</strong>,</p>
    <div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px 16px;border-radius:4px;margin-bottom:16px">
      <strong style="color:#2e7d32">✅ Todos los miembros del comité han firmado</strong>
    </div>
    <p>El siguiente folio está listo para su dictamen de <strong>${aprobador}</strong> (${n.nombre} · ${n.metodologia}):</p>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Folio:</strong> ${folio_codigo}</p>
      <p style="margin:0"><strong>${procesoLabel}:</strong> ${proceso}</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${link}" style="background:#2e7d32;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
        Emitir Dictamen
      </a>
    </div>
  </div>
  <div style="background:#eee;padding:12px;text-align:center;font-size:11px;color:#888">
    ${footerLinea(org_nombre, codigo_formato, version_formato)}
  </div>
</div>`;
}

function plantillaDictamen({ nombre, folio_codigo, proceso, conclusion, motivo, version, link, norma, org_nombre, codigo_formato, version_formato }: any) {
  const n: NormaWorkflowConfig = norma || NORMAS["NOM-241"];
  const procesoLabel = n.terminologia.procesoEquipo;
  const aprobador = n.terminologia.aprobadorFinal;
  const aprobado = conclusion === "Aprobado";
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#042C53;padding:20px;text-align:center">
    <h2 style="color:#fff;margin:0">${(org_nombre || "TRACEA").toUpperCase()}</h2>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Plataforma de Gestión de Riesgos</p>
  </div>
  <div style="padding:28px;background:#f9f9f9">
    <p style="margin:0 0 16px">Estimado(a) <strong>${nombre}</strong>,</p>
    <div style="background:${aprobado ? "#e8f5e9" : "#fff3e0"};border-left:4px solid ${aprobado ? "#2e7d32" : "#e65100"};padding:12px 16px;border-radius:4px;margin-bottom:16px">
      <strong style="color:${aprobado ? "#2e7d32" : "#e65100"}">
        ${aprobado ? `✅ Folio APROBADO por ${aprobador}` : "⚠ Folio RECHAZADO — Requiere corrección"}
      </strong>
    </div>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Folio:</strong> ${folio_codigo}</p>
      <p style="margin:0 0 6px"><strong>${procesoLabel}:</strong> ${proceso}</p>
      <p style="margin:0 0 6px"><strong>Norma:</strong> ${n.nombre} (${n.metodologia})</p>
      <p style="margin:0 0 6px"><strong>Versión:</strong> ${version}</p>
      <p style="margin:0"><strong>Dictamen:</strong> ${conclusion}</p>
      ${motivo ? `<p style="margin:8px 0 0;color:#555"><strong>Observaciones:</strong> ${motivo}</p>` : ""}
    </div>
    ${!aprobado ? `<p style="color:#666;font-size:13px">Se ha archivado la versión ${version} del documento. Se ha creado una nueva revisión para corrección.</p>` : ""}
    <div style="text-align:center;margin:24px 0">
      <a href="${link}" style="background:#042C53;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
        Ver Folio
      </a>
    </div>
  </div>
  <div style="background:#eee;padding:12px;text-align:center;font-size:11px;color:#888">
    ${footerLinea(org_nombre, codigo_formato, version_formato)}
  </div>
</div>`;
}
