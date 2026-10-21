// Edge function: brain-extract-document (C6a.3)
// Lee un archivo de Recursos enlazado a un registro del Listado Maestro y propone conocimiento
// institucional. EXTRAER ≠ INTERPRETAR ≠ CONFIRMAR ≠ VALIDAR: todo entra como 'por_validar'.
// Reglas:
// - Recalcula el SHA-256 del archivo; si no coincide con el guardado, se detiene y audita.
// - Topes del plan desde plan_limites (datos, no código): documentos_extraidos_max y
//   paginas_por_documento_max. NULL = sin límite.
// - Trazabilidad: cada conocimiento guarda archivo, registro/revisión, página o párrafo/sección,
//   cita textual, método y la persona que extrajo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cargarSkill, interpolar, registrarSkillFaltante } from "../_shared/skills.ts";
import { resolverContextoOrg } from "../_shared/contexto-org.ts";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import {
  bloqueImagen,
  bloquePdf,
  extractDocxParrafos,
  extractPdfPaginas,
  isWordMime,
} from "../_shared/documento-contenido.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLAUDE_MODEL = "claude-sonnet-4-6";

const TIPOS_CONOCIMIENTO = [
  "identidad_organizacional",
  "producto_proceso",
  "rol_responsabilidad",
  "requisito_regulatorio",
  "arquitectura_sgc",
  "criterio_documental",
  "conocimiento_operativo",
  "riesgo_control",
  "validacion_calificacion",
  "desviacion_capa",
  "auditoria_aprendizaje",
  "regla_pno",
];

const MENSAJE_TOPE = "Llegaste al límite del periodo de prueba. Contrata un plan para leer más documentos.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return j({ error: "no autorizado" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "sesión inválida" }, 401);

    let orgId: string;
    let puedeExtraer = false;
    try {
      const ctx = await resolverContextoOrg(req);
      orgId = ctx.orgId;
      puedeExtraer = ctx.esSuperAdmin || ctx.rolesEfectivos.some(r => ["admin", "responsable_sanitario"].includes(r));
    } catch (_e) {
      return j({ error: "sin organización" }, 403);
    }
    // C6a.4: solo admin, RS o super_admin pueden extraer.
    if (!puedeExtraer) {
      return j({ error: "sin_permiso", mensaje: "Solo administradores o responsable sanitario pueden extraer conocimiento." }, 403);
    }

    // La empresa debe tener el módulo Cerebro.
    const { data: tieneModulo } = await admin.rpc("org_tiene_modulo", {
      _org: orgId,
      _modulo: "institutional_brain",
    });
    if (!tieneModulo) return j({ error: "sin_modulo" }, 403);

    const body = await req.json();
    const documentoId = body.documento_id ?? null;
    let archivoId = body.archivo_id ?? null;
    if (!documentoId && !archivoId) return j({ error: "documento_id o archivo_id requerido" }, 400);

    // Registro del Listado Maestro (si se indicó).
    // deno-lint-ignore no-explicit-any
    let brainDoc: any = null;
    if (documentoId) {
      const { data } = await admin.from("brain_documents")
        .select("id, org_id, nombre, codigo, revision, archivo_id")
        .eq("id", documentoId).maybeSingle();
      if (!data || data.org_id !== orgId) return j({ error: "El documento no pertenece a tu organización" }, 403);
      brainDoc = data;
      archivoId = archivoId ?? data.archivo_id;
    }
    if (!archivoId) {
      return j({ error: "sin_archivo", mensaje: "Este registro no tiene archivo enlazado. Enlázalo primero en Cerebro → Documentos." }, 400);
    }

    // Archivo de Recursos: misma empresa, vigente (ni en papelera ni retirado).
    const { data: archivo } = await admin.from("org_documentos")
      .select("id, org_id, nombre, nombre_archivo_original, mime_type, storage_path, sha256, sha256_servidor, deleted_at, retirado_en, usar_en_ia")
      .eq("id", archivoId).maybeSingle();
    if (!archivo || archivo.org_id !== orgId) return j({ error: "El archivo no pertenece a tu organización" }, 403);
    if (archivo.deleted_at || archivo.retirado_en) {
      return j({ error: "archivo_no_vigente", mensaje: "El archivo está en la papelera o retirado." }, 409);
    }

    // C6a.4: "Usar en IA" con efecto real.
    if (archivo.usar_en_ia === false) {
      await admin.from("audit_trail").insert({
        user_id: user.id,
        org_id: orgId,
        tabla: "org_documentos",
        registro_id: archivo.id,
        accion: "EXTRACCION_RECHAZADA_USAR_EN_IA",
        valor_nuevo: { archivo_id: archivo.id, documento_id: documentoId },
      });
      return j({
        error: "no_autorizado_ia",
        mensaje: "Este archivo no está autorizado para lectura por IA. Actívalo en Recursos (Usar en IA)",
      }, 403);
    }

    // Descargar y recalcular huella. Si no coincide, se detiene y queda en bitácora.
    const { data: file, error: dErr } = await admin.storage.from("org-documentos").download(archivo.storage_path);
    if (dErr || !file) return j({ error: "no descargable" }, 500);
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const esperada = archivo.sha256_servidor ?? archivo.sha256;
    if (esperada && hex !== esperada) {
      await admin.from("audit_trail").insert({
        user_id: user.id,
        org_id: orgId,
        tabla: "org_documentos",
        registro_id: archivo.id,
        accion: "HUELLA_NO_COINCIDE",
        valor_nuevo: { archivo_id: archivo.id, documento_id: documentoId, esperada, calculada: hex },
      });
      return j({
        error: "huella_no_coincide",
        mensaje: "La huella del archivo no coincide con la registrada al subirlo. Se detuvo la lectura y quedó registrado en la bitácora.",
      }, 409);
    }

    // Tope de documentos extraídos (plan_limites; NULL = sin límite).
    const { data: limiteDocs } = await admin.rpc("plan_limite", { p_org: orgId, p_clave: "documentos_extraidos_max" });
    if (limiteDocs !== null && limiteDocs !== undefined) {
      const { count } = await admin.from("audit_trail")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId).eq("tabla", "brain_documents").eq("accion", "EXTRACCION_DOCUMENTO");
      if ((count ?? 0) >= Number(limiteDocs)) {
        await admin.from("audit_trail").insert({
          user_id: user.id,
          org_id: orgId,
          tabla: "brain_documents",
          registro_id: documentoId,
          accion: "EXTRACCION_RECHAZADA_LIMITE",
          valor_nuevo: { archivo_id: archivo.id, limite: Number(limiteDocs), extraidos: count ?? 0 },
        });
        return j({ error: "limite_prueba", mensaje: MENSAJE_TOPE }, 403);
      }
    }

    // Tope de páginas por documento (plan_limites; por defecto 60).
    const { data: limitePaginas } = await admin.rpc("plan_limite", { p_org: orgId, p_clave: "paginas_por_documento_max" });
    const paginasMax = limitePaginas !== null && limitePaginas !== undefined ? Number(limitePaginas) : 60;

    const mime = archivo.mime_type ?? "";
    const nombreArchivo = archivo.nombre_archivo_original ?? archivo.nombre;

    // Leer el contenido según el formato.
    let metodo = "";
    let textoPlano = "";
    let totalPaginas: number | null = null;
    let truncado = false;
    // deno-lint-ignore no-explicit-any
    let bloquesVision: any[] = [];

    if (mime === "application/pdf") {
      const pdf = await extractPdfPaginas(buffer, paginasMax);
      totalPaginas = pdf.totalPaginas;
      truncado = pdf.truncado;
      const conTexto = pdf.paginas.filter((p) => p.texto.length > 0);
      if (conTexto.length > 0) {
        metodo = "pdf_texto";
        textoPlano = pdf.paginas.map((p) => `[Página ${p.numero}]\n${p.texto}`).join("\n\n");
      } else {
        // Escaneado sin texto seleccionable: visión sobre las primeras paginasMax páginas (pdf-lib).
        metodo = "vision";
        if (pdf.totalPaginas > paginasMax) {
          const origen = await PDFDocument.load(buffer, { ignoreEncryption: true });
          const recorte = await PDFDocument.create();
          const idx = Array.from({ length: paginasMax }, (_, i) => i);
          const copiadas = await recorte.copyPages(origen, idx);
          copiadas.forEach((pg) => recorte.addPage(pg));
          const bytes = await recorte.save();
          bloquesVision = [bloquePdf(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)];
          truncado = true;
        } else {
          bloquesVision = [bloquePdf(buffer)];
          truncado = false;
        }
      }
    } else if (isWordMime(mime, nombreArchivo)) {
      const parrafos = await extractDocxParrafos(buffer);
      if (parrafos.length === 0) return j({ error: "No se pudo extraer texto del Word" }, 422);
      metodo = "docx";
      textoPlano = parrafos.map((p) =>
        `[Párrafo ${p.parrafo}${p.seccion ? ` · Sección: ${p.seccion}` : ""}]\n${p.texto}`
      ).join("\n\n");
    } else if (mime.startsWith("image/")) {
      metodo = "vision";
      bloquesVision = [bloqueImagen(buffer, mime)];
    } else {
      return j({ error: "no_soportado", mensaje: `Formato ${mime} todavía no soportado para extracción.` }, 422);
    }

    // C4a: la instrucción vive en la base (skill extraccion_documento, vigente).
    const documentoRef = `"${nombreArchivo}"${
      brainDoc ? ` (registro ${brainDoc.codigo ?? "sin código"}${brainDoc.revision ? ` rev. ${brainDoc.revision}` : ""})` : ""
    }`;
    let instruccion = "";
    let skills_usadas: { clave: string; version: string; sha256: string }[] = [];
    try {
      const skill = await cargarSkill(admin, "extraccion_documento");
      instruccion = interpolar(skill.texto, { documento: documentoRef });
      skills_usadas = [{ clave: skill.clave, version: skill.version, sha256: skill.sha256 }];
    } catch (e) {
      console.error("C4a: extraccion_documento no vigente", e);
      await registrarSkillFaltante(admin, orgId, "extraccion_documento", "brain-extract-document");
      return j({ error: "skill_no_vigente", mensaje: "Skill no vigente: extraccion_documento. Publícala en el panel Skills de IA." }, 500);
    }

    // deno-lint-ignore no-explicit-any
    const userContent: any[] = metodo === "vision"
      ? [...bloquesVision, { type: "text", text: instruccion }]
      : [{ type: "text", text: `${instruccion}\n\nContenido del documento:\n\n${textoPlano.slice(0, 120000)}` }];

    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!anthRes.ok) {
      const t = await anthRes.text();
      console.error("anthropic err", t);
      return j({ error: "anthropic_error", detail: t }, 502);
    }
    const anthJson = await anthRes.json();
    const txt = anthJson.content?.[0]?.text ?? "{}";
    // deno-lint-ignore no-explicit-any
    let resultado: any;
    try {
      const cleaned = txt.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      resultado = JSON.parse(cleaned);
    } catch {
      return j({ error: "respuesta_invalida", mensaje: "La IA no devolvió un resultado válido. No se guardó nada." }, 502);
    }

    // C6a.4: registro de lo que la IA leyó.
    const paginasLeidas = totalPaginas === null ? null : Math.min(totalPaginas, paginasMax);
    const { data: extraccion, error: eErr } = await admin.from("brain_extracciones").insert({
      org_id: orgId,
      archivo_id: archivo.id,
      documento_id: brainDoc?.id ?? null,
      sha256: hex,
      metodo,
      modelo: CLAUDE_MODEL,
      paginas_totales: totalPaginas,
      paginas_leidas: paginasLeidas,
      truncado,
      texto: metodo === "vision" ? null : textoPlano.slice(0, 120000),
      skills_usadas,
      modelo_ia: CLAUDE_MODEL,
      solicitado_por: user.id,
    }).select("id").single();
    if (eErr || !extraccion) {
      console.error("insert extraccion", eErr);
      return j({ error: "registro_extraccion", mensaje: "No se pudo registrar la extracción. No se guardó nada." }, 500);
    }

    // deno-lint-ignore no-explicit-any
    const conocimientos: any[] = Array.isArray(resultado.conocimientos) ? resultado.conocimientos.slice(0, 15) : [];
    let creados = 0;
    let itemsSinFuente = 0;
    for (const c of conocimientos) {
      if (!c?.contenido || typeof c.contenido !== "string") continue;
      const tipo = TIPOS_CONOCIMIENTO.includes(c.tipo) ? c.tipo : "criterio_documental";
      const { data: item, error: iErr } = await admin.from("brain_knowledge_items").insert({
        org_id: orgId,
        tipo,
        contenido: c.contenido,
        estado: "por_validar",
        marco_validado: false,
        actualizado_por: user.id,
        contexto: { origen: "extraccion_documento" },
      }).select("id").single();
      if (iErr || !item) {
        console.error("insert item", iErr);
        continue;
      }
      const { error: sErr } = await admin.from("brain_knowledge_sources").insert({
        org_id: orgId,
        knowledge_item_id: item.id,
        tipo_fuente: "archivo",
        documento_id: brainDoc?.id ?? null,
        archivo_id: archivo.id,
        documento_codigo: brainDoc?.codigo ?? null,
        documento_revision: brainDoc?.revision ?? null,
        nombre_fuente: nombreArchivo,
        profile_id: user.id,
        pagina: Number.isInteger(c.pagina) ? c.pagina : null,
        parrafo: Number.isInteger(c.parrafo) ? c.parrafo : null,
        seccion: typeof c.seccion === "string" ? c.seccion : null,
        cita_textual: typeof c.cita === "string" ? c.cita : null,
        metodo,
        extraccion_id: extraccion.id,
        descripcion: `Extracción automática (${metodo}) por ${user.email ?? user.id}`,
      });
      if (sErr) {
        // Sin fuente no hay trazabilidad: se borra el ítem huérfano y se reporta.
        console.error("insert source", sErr);
        await admin.from("brain_knowledge_items").delete().eq("id", item.id);
        itemsSinFuente++;
        continue;
      }
      creados++;
    }

    // C6a.4: propuestas (nunca cambian estados).
    const ed = resultado.estado_documento ?? {};
    const conf = ["alta", "media", "baja"].includes(ed.estado_confianza) ? ed.estado_confianza : "baja";
    const propuestas: string[] = [];
    if (brainDoc && (ed.estado_propuesto === "obsoleto" || ed.estado_propuesto === "cancelado") && ed.estado_evidencia) {
      await admin.from("brain_documents").update({
        estado_propuesto: ed.estado_propuesto,
        estado_evidencia: String(ed.estado_evidencia).slice(0, 1000),
        estado_confianza: conf,
        requiere_confirmacion: true,
        estado_propuesto_en: new Date().toISOString(),
      }).eq("id", brainDoc.id);
      propuestas.push(`estado ${ed.estado_propuesto}`);
    }
    if (ed.copia_no_controlada === true && ed.copia_evidencia) {
      await admin.from("org_documentos").update({
        copia_no_controlada_propuesta: true,
        copia_no_controlada_evidencia: String(ed.copia_evidencia).slice(0, 1000),
      }).eq("id", archivo.id);
      propuestas.push("copia no controlada");
    }
    const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/^(rev\.?|revisi[oó]n)\s*/i, "").replace(/\s+/g, "").replace(/^0+(?=\d)/, "");
    if (brainDoc && ed.revision_detectada && brainDoc.revision && norm(ed.revision_detectada) !== norm(brainDoc.revision)) {
      await admin.from("brain_documents").update({
        enlace_por_confirmar: true,
        enlace_revision_detectada: String(ed.revision_detectada).slice(0, 50),
        enlace_evidencia: `Revisión detectada ${ed.revision_detectada} contra registrada ${brainDoc.revision}${ed.revision_evidencia ? ` (${String(ed.revision_evidencia).slice(0, 300)})` : ""}`,
      }).eq("id", brainDoc.id);
      propuestas.push("revisión distinta");
    }
    if (propuestas.length) {
      await admin.from("audit_trail").insert({
        user_id: user.id, org_id: orgId, tabla: "brain_documents", registro_id: brainDoc?.id ?? null,
        accion: "PROPUESTA_ESTADO_DOCUMENTO",
        valor_nuevo: { extraccion_id: extraccion.id, archivo_id: archivo.id, propuestas, estado_documento: ed },
      });
    }

    // Sugerencia de enlace por primera página (decisión d): solo si no hay registro enlazado.
    // deno-lint-ignore no-explicit-any
    let sugerencia: any = null;
    if (!brainDoc && textoPlano) {
      const primeraPagina = textoPlano.slice(0, 4000).toLowerCase();
      const { data: candidatos } = await admin.from("brain_documents")
        .select("id, codigo, nombre").eq("org_id", orgId).is("archivo_id", null).not("codigo", "is", null);
      // deno-lint-ignore no-explicit-any
      const match = (candidatos ?? []).find((d: any) =>
        d.codigo && d.codigo.length >= 4 && primeraPagina.includes(String(d.codigo).toLowerCase())
      );
      if (match) sugerencia = { documento_id: match.id, codigo: match.codigo, nombre: match.nombre };
    }

    await admin.from("audit_trail").insert({
      user_id: user.id,
      org_id: orgId,
      tabla: "brain_documents",
      registro_id: documentoId,
      accion: "EXTRACCION_DOCUMENTO",
      valor_nuevo: {
        documento_id: documentoId,
        archivo_id: archivo.id,
        items_creados: creados,
        items_sin_fuente: itemsSinFuente,
        metodo,
        paginas_leidas: paginasLeidas,
        extraccion_id: extraccion.id,
        paginas_totales: totalPaginas,
        truncado,
      },
    });

    return j({
      ok: true,
      items_creados: creados,
      items_sin_fuente: itemsSinFuente,
      metodo,
      paginas_totales: totalPaginas,
      truncado,
      sugerencia_enlace: sugerencia,
      extraccion_id: extraccion.id,
      propuestas,
      mensaje: (creados > 0
        ? `Se propusieron ${creados} conocimientos. Quedan en Validación hasta que una persona los valide.`
        : "El documento no aportó conocimiento institucional nuevo.")
        + (truncado ? ` Se leyeron solo las primeras ${paginasMax} de ${totalPaginas} páginas (tope del plan).` : "")
        + (propuestas.length ? ` Hay propuestas por confirmar en Cerebro → Documentos: ${propuestas.join(", ")}.` : ""),
    });
  } catch (e) {
    console.error("brain-extract-document", e);
    return j({ error: String(e) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
