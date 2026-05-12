import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import type { Folio, Riesgo, FolioComite } from "@/hooks/useFolios";
import { fetchOrgLogoDataUrl } from "@/lib/orgLogo";
import { getNormaConfig, calcularNPR, getNPRLevelByNorma } from "@/config/normas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chk(checked: boolean): string {
  return checked ? "(X)" : "( )";
}

// Normaliza espacios unicode (NBSP, etc.) a espacio normal y colapsa whitespace
// para evitar que jsPDF-autotable rompa palabras carácter por carácter.
function normalizarTexto(s: string | null | undefined): string {
  if (!s) return "—";
  return s
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const safe = d.length === 10 ? `${d}T12:00:00` : d;
    return new Date(safe).toLocaleDateString("es-MX");
  } catch {
    return d;
  }
}

function getNPRText(npr: number, severidad: number, norma: string | null | undefined): string {
  const level = getNPRLevelByNorma(npr, severidad, norma);
  return `${level.label}  ${npr}`;
}

function getNPRColor(npr: number, severidad: number, norma: string | null | undefined): [number, number, number] {
  const level = getNPRLevelByNorma(npr, severidad, norma);
  if (level.label === "Crítico") return [180, 0, 0];
  if (level.label === "Mayor") return [160, 120, 0];
  return [0, 130, 0];
}

// Banda azul claro como el modelo TRACEA
const BAND_FILL: [number, number, number] = [220, 232, 244];
const BAND_BORDER: [number, number, number] = [140, 170, 200];

// ─── Tipos para Sección VII ──────────────────────────────────────────────────
interface VersionRow {
  version_de: string;
  version_a: string;
  fecha: string;
  descripcion: string;
  realizado_por: string;
}

async function fetchVersiones(folioId: string, currentVersion: string): Promise<VersionRow[]> {
  const { data: versiones } = await supabase
    .from("folio_versiones")
    .select("version, motivo_revision, created_at, creado_por")
    .eq("folio_id", folioId)
    .order("created_at", { ascending: true });

  if (!versiones || versiones.length === 0) return [];

  // Resolver nombres de usuarios
  const userIds = Array.from(new Set(versiones.map((v) => v.creado_por).filter(Boolean))) as string[];
  const nombresMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nombre")
      .in("id", userIds);
    profs?.forEach((p) => nombresMap.set(p.id, p.nombre));
  }

  // Para cada versión archivada: De=esa versión, A=siguiente (o currentVersion si es la última)
  const rows: VersionRow[] = [];
  versiones.forEach((v, idx) => {
    const next = versiones[idx + 1];
    const versionA = next ? next.version : currentVersion;
    rows.push({
      version_de: v.version,
      version_a: versionA,
      fecha: fmtDate(v.created_at),
      descripcion: v.motivo_revision || "—",
      realizado_por: (v.creado_por && nombresMap.get(v.creado_por)) || "—",
    });
  });

  return rows;
}

// ─── Generador principal ─────────────────────────────────────────────────────
export async function generateFolioPDF(
  folio: Folio,
  riesgos: Riesgo[],
  comite: FolioComite[],
  org?: {
    nombre?: string | null;
    logo_url?: string | null;
    codigo_formato?: string | null;
    version_formato?: string | null;
  } | null,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  // Cargar logo y datos
  const orgLogo = await fetchOrgLogoDataUrl(org?.logo_url);
  const orgNombre = (org?.nombre || "ORGANIZACIÓN").trim();
  const codigoFormato = (org?.codigo_formato || "").trim();
  const versionFormato = (org?.version_formato || "").trim();
  const codigoLabel = codigoFormato
    ? versionFormato
      ? `${codigoFormato} (${versionFormato})`
      : codigoFormato
    : "";
  const versiones = await fetchVersiones(folio.id, folio.numero_version || "1.0");

  // ── Configuración por norma del folio (congelada al crear) ────────────────
  const normaConfig = getNormaConfig(folio.norma_folio);
  const usaDeteccion = normaConfig.usarDetectabilidad;
  const t = normaConfig.terminologia;
  const nprFormula = usaDeteccion ? "S × O × D" : "S × O";
  const nprResFormula = usaDeteccion ? "S' × O' × D'" : "S' × O'";
  const umbralLeyenda =
    `Crítico (>${normaConfig.umbralNPRAlto} ó S≥${normaConfig.umbralSeveridadCritica})\n` +
    `Mayor (${normaConfig.umbralNPRMedio}-${normaConfig.umbralNPRAlto})\n` +
    `Menor (<${normaConfig.umbralNPRMedio})`;

  let pageNum = 0;

  // ─── Encabezado: 3 cajas como el modelo TRACEA ──────────────────────────────
  function addHeader(pageIndex: number, totalPages: number) {
    const headerH = 16;
    const logoW = 38;
    const codigoW = codigoLabel ? 32 : 24; // si no hay código, solo paginación
    const centerW = pageW - 2 * margin - logoW - codigoW;

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);

    // Caja 1: Logo
    doc.rect(margin, margin, logoW, headerH);
    if (orgLogo) {
      // Centrar el logo dentro de la caja, mantener proporción
      const maxImgW = logoW - 4;
      const maxImgH = headerH - 3;
      doc.addImage(
        orgLogo.dataUrl,
        orgLogo.format,
        margin + 2,
        margin + 1.5,
        maxImgW,
        maxImgH,
      );
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 31, 61);
      const nombreCorto = orgNombre.slice(0, 14).toUpperCase();
      doc.text(nombreCorto, margin + logoW / 2, margin + headerH / 2 + 1, {
        align: "center",
      });
      doc.setTextColor(0);
    }

    // Caja 2: Centro - EMPRESA / FORMATO / ARCHIVO MAESTRO
    const cx = margin + logoW;
    doc.rect(cx, margin, centerW, headerH);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(orgNombre.toUpperCase(), cx + centerW / 2, margin + 4.5, {
      align: "center",
    });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      "FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD",
      cx + centerW / 2,
      margin + 9,
      { align: "center" },
    );
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(9);
    doc.text(
      "ARCHIVO MAESTRO DE GESTIÓN DE RIESGOS",
      cx + centerW / 2,
      margin + 12.5,
      { align: "center" },
    );
    // Línea de norma + metodología
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text(
      `${normaConfig.nombre} · ${normaConfig.metodologia} · ${normaConfig.normasReferencia.join(" / ")}`,
      cx + centerW / 2,
      margin + 15.5,
      { align: "center" },
    );

    // Caja 3: Código + Página
    const rx = pageW - margin - codigoW;
    doc.rect(rx, margin, codigoW, headerH);
    if (codigoLabel) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("CÓDIGO", rx + codigoW / 2, margin + 5.5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(codigoLabel, rx + codigoW / 2, margin + 9.5, { align: "center" });
      doc.text(`Página ${pageIndex} de ${totalPages}`, rx + codigoW / 2, margin + 13.5, {
        align: "center",
      });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`Página ${pageIndex} de ${totalPages}`, rx + codigoW / 2, margin + headerH / 2 + 1, {
        align: "center",
      });
    }
  }

  function addFooter() {
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    const txt = `Documento confidencial propiedad de ${orgNombre.toUpperCase()}, queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.`;
    doc.text(txt, pageW / 2, pageH - 4, { align: "center" });
    doc.setTextColor(0);
  }

  function newPage(): number {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    addFooter();
    return margin + 16 + 6; // debajo del header con margen
  }

  // Banda de sección (azul claro tipo modelo)
  function sectionHeader(y: number, romano: string, text: string): number {
    const h = 7;
    doc.setFillColor(...BAND_FILL);
    doc.setDrawColor(...BAND_BORDER);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, pageW - 2 * margin, h, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(romano, margin + 4, y + 4.8);
    doc.text(text, margin + 18, y + 4.8);
    return y + h + 0.5;
  }

  // ─── PÁGINA 1: I. DESCRIPCIÓN + II. COMITÉ ──────────────────────────────────
  let y = newPage();
  y = sectionHeader(y, "I.", "DESCRIPCIÓN");

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: "Folio de Gestión:", styles: { fontStyle: "bold", cellWidth: 36, fillColor: [248, 248, 248] } },
        { content: folio.codigo, styles: { fontStyle: "bold", fontSize: 9 } },
        { content: "Versión:", styles: { fontStyle: "bold", cellWidth: 22, fillColor: [248, 248, 248] } },
        { content: folio.numero_version || "1.0", styles: { fontStyle: "bold" } },
        { content: "Clase Dispositivo:", styles: { fontStyle: "bold", cellWidth: 32, fillColor: [248, 248, 248] } },
        { content: folio.clase_dispositivo || "—" },
      ],
      [
        { content: "Proceso / Equipo Analizado:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        folio.proceso_equipo,
        { content: "Origen:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        folio.origen || "—",
        { content: "Desviación:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        folio.desviacion_id || "—",
      ],
      [
        { content: "Número de Modelo:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        folio.numero_modelo || "—",
        { content: "Número de Lote:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        folio.numero_lote || "—",
        { content: "Control de Cambios:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        folio.control_cambios_id || "—",
      ],
      [
        { content: "Fecha Inicio:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        fmtDate(folio.fecha_inicio),
        { content: "Fecha Cierre:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        fmtDate(folio.fecha_cierre),
        { content: "Estado:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        folio.estado,
      ],
      [
        { content: "Alcance:", styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
        { content: folio.alcance || "—", colSpan: 5 },
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      overflow: "linebreak",
      valign: "middle",
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  y = sectionHeader(y, "II.", "FORMACIÓN Y APROBACIÓN DEL COMITÉ TÉCNICO");

  autoTable(doc, {
    startY: y,
    head: [["NOMBRE", "CARGO", "RESPONSABILIDAD", "FIRMA", "FECHA FIRMA"]],
    body:
      comite.length === 0
        ? [["—", "—", "—", "—", "—"]]
        : comite.map((m) => [
            m.nombre,
            m.cargo,
            m.responsabilidad,
            m.firmado ? "✓ Firmado" : "Pendiente",
            m.fecha_firma ? fmtDate(m.fecha_firma) : "—",
          ]),
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 11,
      valign: "middle",
    },
    headStyles: {
      fillColor: BAND_FILL,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 45 },
      2: { cellWidth: "auto" as any },
      3: { cellWidth: 32, halign: "center" },
      4: { cellWidth: 32, halign: "center" },
    },
    margin: { left: margin, right: margin },
  });

  // ─── PÁGINAS DE RIESGOS (SECCIÓN III) ───────────────────────────────────────
  riesgos.forEach((r, idx) => {
    y = newPage();
    const npr =
      r.npr ?? calcularNPR(r.severidad, r.ocurrencia, r.deteccion, folio.norma_folio);
    const nprRes =
      r.npr_residual ??
      calcularNPR(r.sev_residual, r.ocu_residual, r.det_residual, folio.norma_folio);

    const label =
      riesgos.length > 1
        ? `GESTIÓN DE RIESGOS — Riesgo ${idx + 1} de ${riesgos.length}`
        : "GESTIÓN DE RIESGOS";
    y = sectionHeader(y, "III.", label);

    autoTable(doc, {
      startY: y,
      head: [
        [
          { content: "ID", styles: { halign: "center", valign: "middle" } },
          { content: "IDENTIFICACIÓN DE PELIGRO", styles: { halign: "center" } },
          { content: "EVALUACIÓN INICIAL", colSpan: 2, styles: { halign: "center" } },
          { content: "CONTROLES Y GESTIÓN", styles: { halign: "center" } },
          { content: "EVALUACIÓN RESIDUAL", colSpan: 2, styles: { halign: "center" } },
        ],
      ],
      body: [
        [
          {
            content: String(r.numero_id).padStart(2, "0"),
            rowSpan: 6,
            styles: { halign: "center", valign: "middle", fontSize: 16, fontStyle: "bold", fillColor: [248, 248, 248] },
          },
          `${t.procesoEquipo}:\n${r.etapa_proceso || "—"}`,
          { content: "S:", styles: { fontStyle: "bold", halign: "right", valign: "middle" } },
          { content: String(r.severidad), styles: { fontStyle: "bold", halign: "center", valign: "middle", fontSize: 11 } },
          `Controles Actuales:\n${r.controles_actuales || "—"}`,
          { content: `Acción Implementada:\n${r.accion_implementada || "—"}`, colSpan: 2 },
        ],
        [
          `Peligro (fuente):\n${r.peligro || "—"}`,
          { content: "O:", styles: { fontStyle: "bold", halign: "right", valign: "middle" } },
          { content: String(r.ocurrencia), styles: { halign: "center", valign: "middle", fontSize: 11 } },
          `Controles de Prevención:\n${r.controles_prevencion || "—"}`,
          { content: `Fecha y Evidencia:\n${r.fecha_evidencia || "—"}`, colSpan: 2 },
        ],
        [
          `Situación Peligrosa:\n${r.situacion_peligrosa || "—"}`,
          usaDeteccion
            ? { content: "D:", styles: { fontStyle: "bold", halign: "right", valign: "middle" } as any }
            : { content: "—", styles: { halign: "right", valign: "middle", textColor: [160, 160, 160] } as any },
          usaDeteccion
            ? { content: String(r.deteccion), styles: { halign: "center", valign: "middle", fontSize: 11 } as any }
            : { content: "n/a", styles: { halign: "center", valign: "middle", fontSize: 9, textColor: [160, 160, 160] } as any },
          `Controles de Detección:\n${r.controles_deteccion || (usaDeteccion ? "—" : "No aplica para esta norma")}`,
          {
            content: usaDeteccion
              ? `S': ${r.sev_residual}\nO': ${r.ocu_residual}\nD': ${r.det_residual}`
              : `S': ${r.sev_residual}\nO': ${r.ocu_residual}`,
            colSpan: 2,
            styles: { halign: "center", valign: "middle" },
          },
        ],
        [
          {
            content: `Secuencia de Eventos:\n${normalizarTexto(r.secuencia_eventos)}\n\nModo de Falla:\n${normalizarTexto(r.peligro_modo_falla)}\n\nCausa:\n${normalizarTexto(r.causa_potencial)}`,
            styles: { halign: "left", valign: "top", fontSize: 7, overflow: "linebreak", cellPadding: 2 },
          },
          {
            content: `NPR: (${nprFormula})\n${getNPRText(npr, r.severidad, folio.norma_folio)}`,
            colSpan: 2,
            styles: { halign: "center", valign: "middle", fontStyle: "bold", textColor: getNPRColor(npr, r.severidad, folio.norma_folio) },
          },
          `Acción Propuesta:\n${r.accion_propuesta || "—"}\n\nResponsable: ${r.responsable || "—"}\nFecha: ${fmtDate(r.fecha_compromiso)}`,
          {
            content: `NPR RESIDUAL: (${nprResFormula})\n${getNPRText(nprRes, r.sev_residual, folio.norma_folio)}`,
            colSpan: 2,
            styles: { halign: "center", valign: "middle", fontStyle: "bold", textColor: getNPRColor(nprRes, r.sev_residual, folio.norma_folio) },
          },
        ],
        [
          `${t.efectoDano}:\n${r.efecto_dano || "—"}`,
          { content: umbralLeyenda, colSpan: 2, styles: { fontSize: 7, valign: "middle" } },
          `Verificado por: ${r.verificado_por || "—"}\nFecha: ${fmtDate(r.fecha_verificacion)}\nResultado: ${r.resultado_verificacion || "—"}`,
          {
            content: `Dictamen:\n${chk(r.dictamen === "Aceptable")} Aceptable\n${chk(r.dictamen === "No Aceptable")} No Aceptable`,
            colSpan: 2,
          },
        ],
        [
          `¿Requiere Acción?  ${chk(r.requiere_accion)} Sí   ${chk(!r.requiere_accion)} No`,
          {
            content: `Justificación de Aceptabilidad:\n${r.justificacion_aceptabilidad || "—"}`,
            colSpan: 5,
          },
        ],
      ],
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak" },
      headStyles: { fillColor: BAND_FILL, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 70 },
        2: { cellWidth: 10 },
        3: { cellWidth: 14 },
        4: { cellWidth: 72 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
    });
  });

  // ─── PÁGINA: IV. EVIDENCIAS + V. EVAL GLOBAL + VI. DICTAMEN ─────────────────
  y = newPage();

  // IV. Evidencias
  y = sectionHeader(y, "IV.", "EVIDENCIAS Y DOCUMENTACIÓN SOPORTE");
  const riesgosConAnexos = riesgos.filter((r) => {
    const ax = (r as any).anexos;
    return ax && Array.isArray(ax) && ax.length > 0;
  });

  if (riesgosConAnexos.length === 0) {
    autoTable(doc, {
      startY: y,
      body: [[{ content: "Sin evidencias adjuntas registradas en el sistema.", styles: { fontStyle: "italic", textColor: [120, 120, 120] } }]],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, minCellHeight: 10 },
      margin: { left: margin, right: margin },
    });
  } else {
    autoTable(doc, {
      startY: y,
      head: [["RIESGO ID", "NOMBRE DEL ARCHIVO", "TIPO"]],
      body: riesgosConAnexos.flatMap((r) => {
        const anexos = (r as any).anexos as { nombre?: string; url?: string; tipo?: string }[];
        return anexos.map((a) => [
          `Riesgo ${String(r.numero_id).padStart(2, "0")}`,
          a.nombre || a.url || "—",
          a.tipo || "PDF",
        ]);
      }),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: BAND_FILL, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 30, halign: "center" }, 1: { cellWidth: "auto" as any }, 2: { cellWidth: 30, halign: "center" } },
      margin: { left: margin, right: margin },
    });
  }
  y = (doc as any).lastAutoTable.finalY + 4;

  // V. Evaluación Global
  const beneficioUpper = t.beneficio.toUpperCase();
  y = sectionHeader(y, "V.", `EVALUACIÓN GLOBAL DE ${beneficioUpper} vs RIESGO`);
  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: `${t.beneficio} Documentado:`, styles: { fontStyle: "bold", cellWidth: 70, fillColor: [248, 248, 248] } },
        {
          content: folio.beneficio_clinico || "Sin capturar",
          styles: { textColor: folio.beneficio_clinico ? [0, 0, 0] : [160, 0, 0] },
        },
      ],
      [
        { content: "Evaluación de Riesgo Residual Global:", styles: { fontStyle: "bold", cellWidth: 70, fillColor: [248, 248, 248] } },
        {
          content: folio.riesgo_residual_global || "Sin capturar",
          styles: { textColor: folio.riesgo_residual_global ? [0, 0, 0] : [160, 0, 0] },
        },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak" },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Salto si no entra Sección VI
  if (y > pageH - 70) {
    y = newPage();
  }

  // VI. Dictamen
  y = sectionHeader(y, "VI.", `DICTAMEN DE ${beneficioUpper} vs RIESGO`);

  const hasNoAceptables = riesgos.some((r) => r.dictamen === "No Aceptable");
  const conclusion = folio.conclusion || "";

  autoTable(doc, {
    startY: y,
    body: [
      [
        {
          content: "¿Existen riesgos residuales clasificados como NO ACEPTABLES o CONDICIONADOS?",
          styles: { fontStyle: "bold" },
        },
        {
          content: `SÍ  ${chk(hasNoAceptables)}      NO  ${chk(!hasNoAceptables)}`,
          styles: { fontStyle: "bold", halign: "center", cellWidth: 80 },
        },
      ],
      [
        {
          content:
            `JUSTIFICACIÓN TÉCNICA — ${normaConfig.nombre} (${normaConfig.metodologia}): (Explicar por qué el ${t.beneficio.toLowerCase()} supera el riesgo residual identificado, citando evidencia clínica o técnica).`,
          colSpan: 2,
          styles: { fontStyle: "bold", fontSize: 7.5 },
        },
      ],
      [
        {
          content: folio.justificacion_tecnica || "—",
          colSpan: 2,
          styles: { minCellHeight: 26, valign: "top" },
        },
      ],
      [
        {
          content: `CONCLUSIÓN:        APROBADO  ${chk(conclusion === "Aprobado")}        RECHAZADO  ${chk(conclusion === "Rechazado")}`,
          colSpan: 2,
          styles: { fontStyle: "bold", fontSize: 9, halign: "center", fillColor: [248, 248, 248] },
        },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak" },
    margin: { left: margin, right: margin },
  });

  // ─── PÁGINA FINAL: VII. CONTROL DE CAMBIOS ──────────────────────────────────
  y = newPage();
  y = sectionHeader(y, "VII.", "CONTROL DE CAMBIOS");

  // Tabla con encabezado agrupado: Versiones de Documento (De / A) | Fecha | Descripción | Realizado por
  const versionRows: (string | number)[][] = versiones.length === 0
    ? [["—", folio.numero_version || "1.0", fmtDate(folio.created_at), "Versión inicial del documento.", "—"]]
    : versiones.map((v) => [v.version_de, v.version_a, v.fecha, v.descripcion, v.realizado_por]);

  autoTable(doc, {
    startY: y,
    head: [
      [
        { content: "Versiones de Documento", colSpan: 2, styles: { halign: "center" } },
        { content: "Fecha", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "Descripción del Cambio", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "Realizado por", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
      ],
      [
        { content: "De:", styles: { halign: "center" } },
        { content: "A:", styles: { halign: "center" } },
      ],
    ],
    body: versionRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: BAND_FILL, textColor: [0, 0, 0], fontStyle: "bold", lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 32, halign: "center" },
      3: { cellWidth: "auto" as any },
      4: { cellWidth: 50 },
    },
    margin: { left: margin, right: margin },
  });

  // ─── Renderizar encabezados con total de páginas correcto ────────────────────
  const totalPgs = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPgs; i++) {
    doc.setPage(i);
    addHeader(i, totalPgs);
  }

  doc.save(`${folio.codigo}_${folio.proceso_equipo.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}