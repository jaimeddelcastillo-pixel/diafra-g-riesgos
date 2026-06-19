// supabase/functions/emitir-diploma/index.ts
// Emite el diploma cuando el alumno aprueba el examen final:
//   1. Valida intento aprobado del usuario
//   2. Genera folio único (DIP-YYYY-NNN) y hash de verificación
//   3. Genera PDF "Industrial médico" (navy + teal) con QR
//   4. Sube al bucket privado "diplomas" y registra curso_diplomas
//   5. Dispara correo diploma-emitido con PDF adjunto

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import QRCode from "https://esm.sh/qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://tracea.com.mx";

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

  // Banda superior navy
  doc.setFillColor(nr, ng, nb);
  doc.rect(11, 11, W - 22, 26, "F");

  // Encabezado TRACEA Academy
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("TRACEA ACADEMY", W / 2, 24, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(tr, tg, tb);
  doc.text("Follow the quality.", W / 2, 31, { align: "center" });

  // Título
  doc.setTextColor(nr, ng, nb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Diploma de Aprovechamiento", W / 2, 56, { align: "center" });

  // Línea decorativa teal
  doc.setDrawColor(tr, tg, tb);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 40, 60, W / 2 + 40, 60);

  // Texto "Se otorga a"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text("Se otorga el presente diploma a", W / 2, 72, { align: "center" });

  // Nombre del alumno (grande)
  const [dr, dg, db] = hexToRgb(NAVY_DARK);
  doc.setTextColor(dr, dg, db);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(opts.alumnoNombre.toUpperCase(), W / 2, 85, { align: "center" });

  // Subrayado bajo nombre
  doc.setDrawColor(nr, ng, nb);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 90, 89, W / 2 + 90, 89);

  // Cuerpo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(40, 40, 40);
  const cuerpo =
    `por haber acreditado satisfactoriamente el programa de capacitación`;
  doc.text(cuerpo, W / 2, 100, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(nr, ng, nb);
  doc.text(opts.cursoTitulo, W / 2, 109, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(`conforme a la norma ${opts.norma}`, W / 2, 116, { align: "center" });

  // Datos: 2 columnas
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const colY = 134;
  doc.setFont("helvetica", "bold");
  doc.text("Calificación:", 50, colY);
  doc.text("Duración:", 50, colY + 6);
  doc.text("Fecha de emisión:", 50, colY + 12);
  doc.text("Folio único:", 50, colY + 18);
  doc.setFont("helvetica", "normal");
  doc.text(`${opts.calificacion.toFixed(0)} / 100`, 85, colY);
  doc.text(
    opts.duracionHoras ? `${opts.duracionHoras} horas` : "—",
    85,
    colY + 6,
  );
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

  // QR de verificación (esquina inferior derecha)
  const qrDataUrl = await QRCode.toDataURL(opts.verificacionUrl, {
    width: 200,
    margin: 1,
    color: { dark: NAVY, light: "#ffffff" },
  });
  doc.addImage(qrDataUrl, "PNG", W - 50, H - 60, 28, 28);
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text("Verificación en línea", W - 36, H - 30, { align: "center" });

  // Firma del instructor (líneas + nombre)
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.line(35, H - 40, 110, H - 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(nr, ng, nb);
  doc.text("Ing. Jaime David Del Castillo Couret", 72.5, H - 35, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Instructor — TRACEA Academy", 72.5, H - 30, { align: "center" });

  // Pie legal (banda inferior)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  const pie = doc.splitTextToSize(PIE_LEGAL, W - 50);
  doc.text(pie, W / 2, H - 18, { align: "center" });
  doc.setFontSize(6.5);
  doc.setTextColor(tr, tg, tb);
  doc.text(
    `Verificación en línea: ${opts.verificacionUrl}`,
    W / 2,
    H - 13,
    { align: "center" },
  );

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
    const { intento_id } = await req.json();
    if (!intento_id) return json({ error: "intento_id requerido" }, 400);

    // Validar intento
    const { data: intento } = await admin
      .from("curso_examen_intentos")
      .select("*")
      .eq("id", intento_id)
      .eq("user_id", user.id)
      .single();
    if (!intento) return json({ error: "Intento no encontrado" }, 404);
    if (!intento.aprobado) return json({ error: "El intento no está aprobado" }, 400);

    // ¿Ya hay diploma para este intento?
    const { data: yaExiste } = await admin
      .from("curso_diplomas")
      .select("id, folio, hash_verificacion, pdf_path")
      .eq("intento_id", intento_id)
      .maybeSingle();
    if (yaExiste) {
      const { data: signed } = await admin.storage
        .from("diplomas")
        .createSignedUrl(yaExiste.pdf_path!, 3600);
      return json({
        already_existed: true,
        folio: yaExiste.folio,
        hash: yaExiste.hash_verificacion,
        download_url: signed?.signedUrl ?? null,
      });
    }

    // Curso
    const { data: curso } = await admin
      .from("cursos")
      .select("id, titulo, norma, duracion_horas")
      .eq("id", intento.curso_id)
      .single();
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
    const { data: orgMember } = await admin
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Folio + hash
    const { data: folioData, error: folioErr } = await admin.rpc("next_diploma_folio");
    if (folioErr) return json({ error: folioErr.message }, 500);
    const folio = folioData as unknown as string;

    const hash = (await sha256Hex(`${folio}|${user.id}|${curso.id}|${Date.now()}`)).slice(0, 40);
    const verificacionUrl = `${APP_URL}/diploma/verificar/${hash}`;

    const fecha = new Date();
    const calificacion = Number(intento.calificacion) || 0;

    const pdfBytes = await generarDiplomaPDF({
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

    const pdfPath = `${user.id}/${folio}.pdf`;
    const { error: upErr } = await admin.storage
      .from("diplomas")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return json({ error: `Storage: ${upErr.message}` }, 500);

    const { error: insErr } = await admin.from("curso_diplomas").insert({
      folio,
      user_id: user.id,
      org_id: orgMember?.org_id ?? null,
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
    if (insErr) return json({ error: insErr.message }, 500);

    // Signed URL para descarga
    const { data: signed } = await admin.storage
      .from("diplomas")
      .createSignedUrl(pdfPath, 3600);

    // Email con PDF adjunto
    try {
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
      await admin.functions.invoke("send-transactional-email", {
        body: {
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
            descarga_url: signed?.signedUrl ?? verificacionUrl,
          },
          attachments: [
            { filename: `${folio}.pdf`, content: pdfBase64, contentType: "application/pdf" },
          ],
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
      download_url: signed?.signedUrl ?? null,
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