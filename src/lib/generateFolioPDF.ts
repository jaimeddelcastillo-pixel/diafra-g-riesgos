import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Folio, Riesgo, FolioComite } from "@/hooks/useFolios";
import { getNPRLevel } from "@/hooks/useFolios";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chk(checked: boolean): string {
  return checked ? "(X)" : "( )";
}

function getNPRText(npr: number, severidad: number): string {
  const level = getNPRLevel(npr, severidad);
  if (level.label === "Crítico") return `Crítico  ${npr}`;
  if (level.label === "Mayor") return `Mayor  ${npr}`;
  return `Menor  ${npr}`;
}

function getNPRColor(npr: number, severidad: number): [number, number, number] {
  const level = getNPRLevel(npr, severidad);
  if (level.label === "Crítico") return [180, 0, 0];
  if (level.label === "Mayor") return [160, 120, 0];
  return [0, 130, 0];
}

export async function generateFolioPDF(folio: Folio, riesgos: Riesgo[], comite: FolioComite[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let pageNum = 0;

  // Cargar logo desde carpeta pública
  let logoData: string | null = null;
  try {
    const resp = await fetch("/logo-diafra.png");
    if (resp.ok) {
      const blob = await resp.blob();
      logoData = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    /* continúa sin logo */
  }

  // ─── Encabezado ─────────────────────────────────────────────────────────────
  function addHeader(pageIndex: number, totalPages: number) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.rect(margin, 5, pageW - 2 * margin, 18);
    doc.setLineWidth(0.3);
    doc.line(margin + 28, 5, margin + 28, 23);
    doc.line(pageW - margin - 32, 5, pageW - margin - 32, 23);

    if (logoData) {
      doc.addImage(logoData, "PNG", margin + 1, 6.5, 24, 13);
    } else {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 31, 61);
      doc.text("DIAFRA", margin + 3, 12);
      doc.text("S.A. DE C.V.", margin + 2, 17);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");
      doc.text("Gestión de Calidad", margin + 1, 21);
      doc.setTextColor(0);
    }

    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DIAFRA S.A. DE C.V.", pageW / 2, 11, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD", pageW / 2, 16, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ARCHIVO MAESTRO DE GESTIÓN DE RIESGOS", pageW / 2, 21, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SGC-11-01 (02)", pageW - margin - 16, 12, { align: "center" });
    doc.text(`Página ${pageIndex} de ${totalPages}`, pageW - margin - 16, 18, { align: "center" });
  }

  function addFooter() {
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(
      "Documento confidencial propiedad de Diafra S.A. de C.V., queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.",
      pageW / 2,
      pageH - 3,
      { align: "center" },
    );
    doc.setTextColor(0);
  }

  function newPage(): number {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    addFooter();
    return 28;
  }

  function sectionHeader(y: number, text: string): number {
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, y, pageW - 2 * margin, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(text, margin + 3, y + 4.2);
    return y + 7;
  }

  // ─── PÁGINA 1: Descripción + Comité ─────────────────────────────────────────
  let y = newPage();
  y = sectionHeader(y, "I.  DESCRIPCIÓN");

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: "Folio de Gestión:", styles: { fontStyle: "bold", cellWidth: 32 } },
        { content: folio.codigo, colSpan: 5, styles: { fontStyle: "bold", fontSize: 9 } },
      ],
      [
        { content: "Proceso / Equipo\nAnalizado:", styles: { fontStyle: "bold", cellWidth: 32 } },
        folio.proceso_equipo,
        { content: "Origen:", styles: { fontStyle: "bold", cellWidth: 18 } },
        folio.origen || "—",
        { content: "Desviación:", styles: { fontStyle: "bold", cellWidth: 22 } },
        folio.desviacion_id || "—",
      ],
      [
        { content: "Control de Cambios:", styles: { fontStyle: "bold", cellWidth: 32 } },
        folio.control_cambios_id || "—",
        { content: "Fecha Inicio:", styles: { fontStyle: "bold" } },
        folio.fecha_inicio,
        { content: "Fecha Cierre:", styles: { fontStyle: "bold" } },
        folio.fecha_cierre || "—",
      ],
      [
        { content: "Alcance:", styles: { fontStyle: "bold", cellWidth: 32 } },
        { content: folio.alcance || "—", colSpan: 5 },
      ],
    ],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak" },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 5;
  y = sectionHeader(y, "II.  FORMACIÓN Y APROBACIÓN DEL COMITÉ TÉCNICO");

  autoTable(doc, {
    startY: y,
    head: [["NOMBRE", "CARGO", "RESPONSABILIDAD", "FIRMA"]],
    body: comite.map((m) => [m.nombre, m.cargo, m.responsabilidad, ""]),
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, minCellHeight: 14 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 45 },
      2: { cellWidth: 120 },
      3: { cellWidth: 35, halign: "center" },
    },
    margin: { left: margin, right: margin },
  });

  // ─── PÁGINAS DE RIESGOS ──────────────────────────────────────────────────────
  const romanNums = [
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
    "XVII",
    "XVIII",
    "XIX",
    "XX",
  ];

  riesgos.forEach((r, idx) => {
    y = newPage();
    y = sectionHeader(y, `${romanNums[idx] ?? idx + 3}.  GESTIÓN DE RIESGOS`);

    const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
    const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;

    autoTable(doc, {
      startY: y,
      head: [
        [
          { content: "ID", styles: { halign: "center", valign: "middle" } },
          { content: "1. IDENTIFICACIÓN DE PELIGRO Y FALLA", styles: { halign: "center" } },
          { content: "2. EVALUACIÓN\nINICIAL", colSpan: 2, styles: { halign: "center" } },
          { content: "3. CONTROLES Y GESTIÓN", styles: { halign: "center" } },
          { content: "4. EVALUACIÓN FINAL (RESIDUAL)", colSpan: 2, styles: { halign: "center" } },
        ],
      ],
      body: [
        // Fila 1: Etapa / S / Controles / Acción
        [
          {
            content: String(r.numero_id).padStart(2, "0"),
            rowSpan: 5,
            styles: { halign: "center", valign: "middle", fontSize: 14, fontStyle: "bold" },
          },
          `Etapa del Proceso:\n${r.etapa_proceso}`,
          { content: "S:", styles: { fontStyle: "bold", halign: "right" } },
          { content: String(r.severidad), styles: { fontStyle: "bold", halign: "center", fontSize: 11 } },
          `Controles Actuales:\n${r.controles_actuales || "—"}`,
          { content: `Acción Implementada:\n${r.accion_implementada || "—"}`, colSpan: 2 },
        ],
        // Fila 2: Peligro / O / Requiere / Fecha
        [
          `Peligro / Modo de Falla:\n${r.peligro_modo_falla}`,
          { content: "O:", styles: { fontStyle: "bold", halign: "right" } },
          { content: String(r.ocurrencia), styles: { halign: "center", fontSize: 11 } },
          `¿Requiere Acción?\n${chk(r.requiere_accion === true)} Si    ${chk(r.requiere_accion === false)} No`,
          { content: `Fecha y Evidencia:\n${r.fecha_evidencia || "—"}`, colSpan: 2 },
        ],
        // Fila 3: Causa / D / Acción propuesta / Residuales
        [
          `Causa Potencial:\n${r.causa_potencial}`,
          { content: "D:", styles: { fontStyle: "bold", halign: "right" } },
          { content: String(r.deteccion), styles: { halign: "center", fontSize: 11 } },
          `Acción Propuesta:\n${r.accion_propuesta || "—"}`,
          { content: `S: ${r.sev_residual}\nO: ${r.ocu_residual}\nD: ${r.det_residual}`, styles: { halign: "center" } },
          "",
        ],
        // Fila 4: Efecto / NPR coloreado / Responsable / NPR Residual coloreado
        [
          `Efecto / Daño:\n${r.efecto_dano}`,
          {
            content: `NPR: (S x O x D):\n${getNPRText(npr, r.severidad)}`,
            colSpan: 2,
            styles: { halign: "center", fontStyle: "bold", textColor: getNPRColor(npr, r.severidad) },
          },
          `Responsable:\n${r.responsable || "—"}`,
          {
            content: `NPR RESIDUAL:\n${getNPRText(nprRes, r.sev_residual)}`,
            colSpan: 2,
            styles: { halign: "center", fontStyle: "bold", textColor: getNPRColor(nprRes, r.sev_residual) },
          },
        ],
        // Fila 5: Leyenda / Fecha / Dictamen
        [
          "",
          { content: "Crítico (> 150 ó S >= 9)\nMayor (60-149)\nMenor (< 60)", colSpan: 2, styles: { fontSize: 6.5 } },
          `Fecha:\n${r.fecha_compromiso || "—"}`,
          {
            content: `DICTAMEN:\n${chk(r.dictamen === "Aceptable")} Aceptable\n${chk(r.dictamen === "No Aceptable")} No Aceptable`,
            colSpan: 2,
          },
        ],
      ],
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak" },
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 68 },
        2: { cellWidth: 8 },
        3: { cellWidth: 12 },
        4: { cellWidth: 70 },
        5: { cellWidth: 28 },
        6: { cellWidth: 28 },
      },
      margin: { left: margin, right: margin },
    });
  });

  // ─── PÁGINA DICTAMEN ─────────────────────────────────────────────────────────
  y = newPage();
  const dictamenRoman = romanNums[riesgos.length] ?? `${riesgos.length + 3}`;
  const hasNoAceptables = riesgos.some((r) => r.dictamen === "No Aceptable");
  const conclusion = folio.conclusion || "";

  y = sectionHeader(y, `${dictamenRoman}.  DICTAMEN DE BENEFICIO-RIESGO`);
  y += 3;

  // ¿Existen NO ACEPTABLES?
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - 2 * margin, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("¿Existen riesgos residuales clasificados como NO ACEPTABLES o CONDICIONADOS?", margin + 3, y + 5.5);
  doc.text(`SÍ  ${chk(hasNoAceptables)}     NO  ${chk(!hasNoAceptables)}`, margin + 192, y + 5.5);
  y += 11;

  // Justificación técnica
  doc.rect(margin, y, pageW - 2 * margin, 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("JUSTIFICACIÓN TÉCNICA:", margin + 3, y + 4.5);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.text(
    "(Explicar por qué el beneficio médico supera el riesgo residual identificado, citando evidencia clínica o técnica).",
    margin + 47,
    y + 4.5,
  );
  const justText = folio.justificacion_tecnica || "";
  if (justText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const lines = doc.splitTextToSize(justText, pageW - 2 * margin - 6);
    doc.text(lines, margin + 3, y + 9);
  }
  y += 38;

  // Conclusión
  doc.setLineWidth(0.4);
  doc.rect(margin, y, pageW - 2 * margin, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CONCLUSIÓN:", margin + 5, y + 7);
  doc.setFontSize(8);
  doc.text(`APROBADO   ${chk(conclusion === "Aprobado")}`, margin + 65, y + 7);
  doc.text(`RECHAZADO   ${chk(conclusion === "Rechazado")}`, margin + 140, y + 7);

  // ─── Renderizar encabezados con total de páginas correcto ────────────────────
  const totalPgs = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPgs; i++) {
    doc.setPage(i);
    addHeader(i, totalPgs);
  }

  doc.save(`${folio.codigo}_${folio.proceso_equipo.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}
