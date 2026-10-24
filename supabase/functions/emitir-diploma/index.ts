// supabase/functions/emitir-diploma/index.ts
// Emite el diploma cuando el alumno aprueba el examen final:
//   1. Valida intento aprobado del usuario
//   2. Genera folio único por empresa (DIP-YYYY-{SLUG}-NNN) y hash de verificación
//   3. Genera PDF "Industrial médico" (navy + teal) con QR
//   4. Sube al bucket privado "diplomas" y registra curso_diplomas
//   5. Dispara correo diploma-emitido con PDF adjunto

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import QRCode from "https://esm.sh/qrcode@1.5.4";
import { LOGO_TRACEA_PNG_BASE64, LOGO_W, LOGO_H } from "./logo.ts";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// URL pública canónica para verificación del diploma (QR) y links del correo.
// Forzamos el dominio productivo (tracea.com.mx) ignorando cualquier APP_URL
// heredado de despliegues anteriores (p.ej. *.lovable.app) para que el QR
// siempre lleve a una página pública estable.
const VERIFY_BASE_URL = "https://tracea.com.mx";
const APP_URL = VERIFY_BASE_URL;

// Paleta industrial médico
const NAVY = "#0B2545";
const TEAL = "#13A8A8";
const NAVY_DARK = "#0F3C5F";
const BG = "#F5F7FA";

const PIE_LEGAL =
  "Documento de aprovechamiento académico emitido por TRACEA Academy en cumplimiento del programa de capacitación en Gestión de Riesgos conforme a NOM-241-SSA1-2025 y FEUM Suplemento para Dispositivos Médicos 5.0. Instructor: Ing. Jaime David Del Castillo Couret.";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtFechaLarga(d: Date): string {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

async function generarDiplomaPDF(opts: {
  folio: string;
  alumnoNombre: string;
  cursoTitulo: string;
  norma: string;
  fecha: Date;
  calificacion: number;
  duracionHoras?: number | null;
  modulosAprobados: string[];
  verificacionUrl: string;
}): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  // Fondo
  const [br, bg, bb] = hexToRgb(BG);
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, H, "F");

  // Marco doble (industrial)
  const [nr, ng, nb] = hexToRgb(NAVY);
  const [tr, tg, tb] = hexToRgb(TEAL);
  doc.setDrawColor(nr, ng, nb);
  doc.setLineWidth(1.8);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setDrawColor(tr, tg, tb);
  doc.setLineWidth(0.4);
  doc.rect(11, 11, W - 22, H - 22);

  // Banda superior navy con logo TRACEA Academy (PNG original)
  doc.setFillColor(nr, ng, nb);
  doc.rect(11, 11, W - 22, 34, "F");
  try {
    // Logo original, sin recolorear, sin recortar y sin deformar; solo se escala
    // manteniendo su proporción completa dentro de la banda.
    const bandaH = 34;
    const maxH = 19;
    const maxW = 86;
    let logoH = maxH;
    let logoW = logoH * (LOGO_W / LOGO_H);
    if (logoW > maxW) {
      logoW = maxW;
      logoH = logoW * (LOGO_H / LOGO_W);
    }
    doc.addImage(
      LOGO_TRACEA_PNG_BASE64,
      "PNG",
      W / 2 - logoW / 2,
      11 + (bandaH - logoH) / 2,
      logoW,
      logoH,
    );
  } catch (_) {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("TRACEA ACADEMY", W / 2, 24, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(tr, tg, tb);
    doc.text("Follow the quality. Sigue el rastro de la calidad.", W / 2, 31, { align: "center" });
  }

  // Título
  doc.setTextColor(nr, ng, nb);
  doc.setFont("helvetica", "bold");
  doc.setCharSpace(0);
  doc.setFontSize(26);
  doc.text("Diploma de Aprovechamiento", W / 2, 58, { align: "center" });

  // Línea decorativa teal
  doc.setDrawColor(tr, tg, tb);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 40, 62, W / 2 + 40, 62);

  // Texto "Se otorga a"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text("Se otorga el presente diploma a", W / 2, 74, { align: "center" });

  // Nombre del alumno (grande)
  const [dr, dg, db] = hexToRgb(NAVY_DARK);
  doc.setTextColor(dr, dg, db);
  doc.setFont("helvetica", "bold");
  doc.setCharSpace(0);
  doc.setFontSize(22);
  doc.text(opts.alumnoNombre.toUpperCase(), W / 2, 87, { align: "center" });

  // Subrayado bajo nombre
  doc.setDrawColor(nr, ng, nb);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 90, 91, W / 2 + 90, 91);

  // Cuerpo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(40, 40, 40);
  const cuerpo =
    `por haber acreditado satisfactoriamente el programa de capacitación`;
  doc.text(cuerpo, W / 2, 101, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(nr, ng, nb);
  doc.setCharSpace(0);
  doc.text(opts.cursoTitulo, W / 2, 110, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(`conforme a la norma ${opts.norma}`, W / 2, 117, { align: "center" });

  // Datos: 2 columnas (subimos el bloque para dejar aire a la firma)
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const colY = 128;
  doc.setFont("helvetica", "bold");
  doc.text("Calificación:", 50, colY);
  doc.text("Duración:", 50, colY + 6);
  doc.text("Fecha de emisión:", 50, colY + 12);
  doc.text("Folio único:", 50, colY + 18);
  doc.setFont("helvetica", "normal");
  doc.text(`${opts.calificacion.toFixed(0)} / 100`, 85, colY);
  const horas = opts.duracionHoras && opts.duracionHoras > 0 ? opts.duracionHoras : 8;
  doc.text(`${horas} hrs`, 85, colY + 6);
  doc.text(fmtFechaLarga(opts.fecha), 85, colY + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(nr, ng, nb);
  doc.text(opts.folio, 85, colY + 18);

  // Módulos aprobados (col derecha)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Módulos aprobados:", 155, colY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const modulosMostrar = opts.modulosAprobados.slice(0, 5);
  modulosMostrar.forEach((m, i) => {
    doc.text(`• ${m}`, 155, colY + 6 + i * 5);
  });

  // QR de verificación (esquina inferior derecha) — el QR es el único
  // mecanismo de verificación visual; no se imprime la URL en texto.
  const qrDataUrl = await QRCode.toDataURL(opts.verificacionUrl, {
    width: 240,
    margin: 1,
    color: { dark: NAVY, light: "#ffffff" },
  });
  doc.addImage(qrDataUrl, "PNG", W - 50, H - 60, 28, 28);
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text("Escanea para verificar", W - 36, H - 30, { align: "center" });

  // Firma autógrafa en papel: no estampar imágenes en documentos nuevos.
  const firmaCx = 72.5;
  const lineY = H - 34;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.line(firmaCx - 38, lineY, firmaCx + 38, lineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(nr, ng, nb);
  doc.text("Ing. Jaime David Del Castillo Couret", firmaCx, lineY + 5, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Instructor — TRACEA Academy", firmaCx, lineY + 10, { align: "center" });

  // Pie legal (banda inferior). La URL de verificación NO se imprime: el
  // QR de arriba es el mecanismo de validación.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  const pie = doc.splitTextToSize(PIE_LEGAL, W - 60);
  doc.text(pie, W / 2, H - 16, { align: "center" });

  const out = doc.output("arraybuffer");
  return new Uint8Array(out);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const { intento_id, force_regenerate } = body ?? {};
    if (!intento_id) return json({ error: "intento_id requerido" }, 400);

    // Validar intento
    const { data: intento, error: intentoErr } = await admin
      .from("curso_examen_intentos")
      .select("*")
      .eq("id", intento_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (intentoErr) {
      console.error("[emitir-diploma] lookup intento error", intentoErr);
      return json({ error: `Lookup intento: ${intentoErr.message}` }, 500);
    }
    if (!intento) return json({ error: "Intento no encontrado" }, 404);
    if (!intento.aprobado) return json({ error: "El intento no está aprobado" }, 400);

    // P1c.1: emitir un diploma nuevo exige acceso completo (regla única mi_acceso_curso).
    // Un diploma ya emitido siempre se conserva y se puede regenerar.
    const { data: dipPrevio } = await admin
      .from("curso_diplomas").select("id").eq("user_id", user.id).eq("curso_id", intento.curso_id).limit(1).maybeSingle();
    if (!dipPrevio) {
      // P1c.2: con la empresa activa suspendida no se emiten diplomas nuevos (sí se regeneran los propios).
      const { data: orgActiva } = await userClient.rpc("get_user_org_id");
      if (orgActiva) {
        const { data: o } = await admin.from("organizations").select("estado").eq("id", orgActiva).maybeSingle();
        if (o?.estado === "suspendido") {
          return json({ error: "La empresa está suspendida: no se pueden emitir diplomas nuevos" }, 403);
        }
      }
      const { data: acceso, error: accErr } = await userClient.rpc("mi_acceso_curso", { p_curso_id: intento.curso_id });
      if (accErr) return json({ error: "No se pudo validar el acceso al curso" }, 500);
      if (acceso !== "completo") {
        return json({ error: "El diploma requiere acceso completo al curso" }, 403);
      }
    }

    // Idempotencia: dos lookups simples (evita parseo .or con and anidado).
    let yaExiste: any = null;
    {
      const { data, error } = await admin
        .from("curso_diplomas")
        .select("id, folio, hash_verificacion, pdf_path")
        .eq("intento_id", intento_id)
        .maybeSingle();
      if (error) {
        console.error("[emitir-diploma] idempot intento_id error", error);
      }
      yaExiste = data ?? null;
    }
    if (!yaExiste) {
      const { data, error } = await admin
        .from("curso_diplomas")
        .select("id, folio, hash_verificacion, pdf_path")
        .eq("user_id", user.id)
        .eq("curso_id", intento.curso_id)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[emitir-diploma] idempot user/curso error", error);
      }
      yaExiste = data ?? null;
    }
    if (yaExiste) {
      return json({
        already_existed: true,
        folio: yaExiste.folio,
        hash: yaExiste.hash_verificacion,
        verificacion_url: `${APP_URL}/diploma/verificar/${yaExiste.hash_verificacion}`,
      });
    }

    // Curso
    const { data: curso, error: cursoErr } = await admin
      .from("cursos")
      .select("id, titulo, norma, duracion_horas")
      .eq("id", intento.curso_id)
      .maybeSingle();
    if (cursoErr) {
      console.error("[emitir-diploma] curso error", cursoErr);
      return json({ error: `Curso: ${cursoErr.message}` }, 500);
    }
    if (!curso) return json({ error: "Curso no encontrado" }, 404);

    // Módulos
    const { data: modulos } = await admin
      .from("curso_modulos")
      .select("titulo, orden")
      .eq("curso_id", curso.id)
      .order("orden");

    // Perfil
    const { data: perfil } = await admin
      .from("profiles")
      .select("nombre, email")
      .eq("id", user.id)
      .single();
    const alumnoNombre = perfil?.nombre || perfil?.email || "Alumno";
    const alumnoEmail = perfil?.email || user.email!;

    // Org
    let orgIdAlumno: string | null = null;
    try { orgIdAlumno = (await resolverContextoOrg(req)).orgId; }
    catch (e) { if (!(e instanceof ContextoOrgError)) throw e; }

    // Folio + hash: si es regeneración, conservamos folio/hash existentes para que
    // QR y verificación previa sigan siendo válidos. Si no, generamos nuevos.
    let folio: string;
    let hash: string;
    if (yaExiste && force_regenerate) {
      folio = yaExiste.folio as string;
      hash = yaExiste.hash_verificacion as string;
    } else {
      if (!orgIdAlumno) {
        return json({ error: "El alumno no pertenece a ninguna organización; no se puede emitir el folio." }, 400);
      }
      const { data: folioData, error: folioErr } = await admin.rpc("next_diploma_folio", { p_org_id: orgIdAlumno });
      if (folioErr) {
        console.error("[emitir-diploma] folio error", folioErr);
        return json({ error: `Folio: ${folioErr.message}` }, 500);
      }
      folio = folioData as unknown as string;
      hash = (await sha256Hex(`${folio}|${user.id}|${curso.id}|${Date.now()}`)).slice(0, 40);
    }
    const verificacionUrl = `${APP_URL}/diploma/verificar/${hash}`;

    const fecha = new Date();
    const calificacion = Number(intento.calificacion) || 0;

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generarDiplomaPDF({
        folio,
        alumnoNombre,
        cursoTitulo: curso.titulo,
        norma: (curso as any).norma === "NOM-059" ? "NOM-059-SSA1-2015" : "NOM-241-SSA1-2025",
        fecha,
        calificacion,
        duracionHoras: (curso as any).duracion_horas ?? null,
        modulosAprobados: (modulos ?? []).map((m: any) => m.titulo),
        verificacionUrl,
      });
    } catch (pdfErr) {
      console.error("[emitir-diploma] PDF render error", pdfErr);
      return json({ error: `PDF: ${(pdfErr as Error).message}` }, 500);
    }

    const pdfPath = `${user.id}/${folio}.pdf`;
    const { error: upErr } = await admin.storage
      .from("diplomas")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("[emitir-diploma] storage error", upErr);
      return json({ error: `Storage: ${upErr.message}` }, 500);
    }

    if (yaExiste && force_regenerate) {
      const { error: updErr } = await admin
        .from("curso_diplomas")
        .update({
          pdf_path: pdfPath,
          alumno_nombre: alumnoNombre,
          alumno_email: alumnoEmail,
          curso_titulo: curso.titulo,
          curso_norma: (curso as any).norma,
          duracion_horas: (curso as any).duracion_horas ?? null,
          modulos_aprobados: (modulos ?? []).map((m: any) => m.titulo),
        })
        .eq("id", yaExiste.id);
      if (updErr) {
        console.error("[emitir-diploma] update error", updErr);
        return json({ error: `Update: ${updErr.message}` }, 500);
      }
    } else {
      const { error: insErr } = await admin.from("curso_diplomas").insert({
        folio,
        user_id: user.id,
        org_id: orgIdAlumno,
        curso_id: curso.id,
        intento_id,
        fecha_emision: fecha.toISOString(),
        calificacion,
        hash_verificacion: hash,
        pdf_path: pdfPath,
        alumno_nombre: alumnoNombre,
        alumno_email: alumnoEmail,
        curso_titulo: curso.titulo,
        curso_norma: (curso as any).norma,
        duracion_horas: (curso as any).duracion_horas ?? null,
        modulos_aprobados: (modulos ?? []).map((m: any) => m.titulo),
      });
      if (insErr) {
        console.error("[emitir-diploma] insert error", insErr);
        return json({ error: `Insert: ${insErr.message}` }, 500);
      }
    }

    // Email con PDF adjunto
    try {
      await enviarYRegistrar({
          templateName: "diploma-emitido",
          recipientEmail: alumnoEmail,
          idempotencyKey: `diploma-${folio}`,
          templateData: {
            nombre: alumnoNombre,
            curso_titulo: curso.titulo,
            norma: (curso as any).norma === "NOM-059" ? "NOM-059-SSA1-2015" : "NOM-241-SSA1-2025",
            folio_diploma: folio,
            calificacion,
            fecha: fmtFechaLarga(fecha),
            verificacion_url: verificacionUrl,
            plataforma_url: `${APP_URL}/mis-diplomas`,
          },
        });
    } catch (e) {
      console.warn("Email diploma falló (continúa)", e);
    }

    return json({
      success: true,
      folio,
      hash,
      verificacion_url: verificacionUrl,
      regenerated: !!(yaExiste && force_regenerate),
    });
  } catch (err) {
    console.error("emitir-diploma error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}