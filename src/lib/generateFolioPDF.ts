import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Folio, Riesgo, FolioComite } from "@/hooks/useFolios";
import { getNPRLevel } from "@/hooks/useFolios";

function getNPRSymbol(npr: number, severidad: number): string {
  const level = getNPRLevel(npr, severidad);
  if (level.label === "Crítico") return "● ";
  if (level.label === "Mayor") return "◐ ";
  return "○ ";
}

export function generateFolioPDF(folio: Folio, riesgos: Riesgo[], comite: FolioComite[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let pageNum = 0;

  const totalPages = () => (doc as any).internal.getNumberOfPages();

  function addHeader() {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("DIAFRA S.A. DE C.V.", pageW / 2, 12, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD", pageW / 2, 17, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ARCHIVO MAESTRO DE GESTIÓN DE RIESGOS", pageW / 2, 23, { align: "center" });
    doc.setDrawColor(0);
    doc.line(margin, 26, pageW - margin, 26);
  }

  function addFooter() {
    const pn = (doc as any).internal.getCurrentPageInfo().pageNumber;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SGC-11-01 (02)", pageW / 2, pageH - 8, { align: "center" });
    doc.setFontSize(5.5);
    doc.text(
      "Documento confidencial propiedad de Diafra S.A. de C.V., queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.",
      pageW / 2, pageH - 5, { align: "center" }
    );
    doc.setFontSize(7);
    doc.text(`Página ${pn}`, pageW - margin, pageH - 8, { align: "right" });
  }

  function newPage() {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    addHeader();
    addFooter();
    return 30;
  }

  // ==================== PAGE 1: Descripción + Comité ====================
  let y = newPage();

  // Section I - Descripción
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, pageW - 2 * margin, 7, "F");
  doc.text("I.  DESCRIPCIÓN", margin + 3, y + 5);
  y += 9;

  const descRows = [
    [{ content: "Folio de Gestión:", styles: { fontStyle: "bold" as const, cellWidth: 35 } }, { content: folio.codigo, colSpan: 5 }],
    [
      { content: "Proceso / Equipo:", styles: { fontStyle: "bold" as const, cellWidth: 35 } }, folio.proceso_equipo,
      { content: "Origen:", styles: { fontStyle: "bold" as const } }, folio.origen,
      { content: "Desviación:", styles: { fontStyle: "bold" as const } }, folio.desviacion_id || "—",
    ],
    [
      { content: "Control de Cambios:", styles: { fontStyle: "bold" as const, cellWidth: 35 } }, folio.control_cambios_id || "—",
      { content: "Fecha Inicio:", styles: { fontStyle: "bold" as const } }, folio.fecha_inicio,
      { content: "Fecha Cierre:", styles: { fontStyle: "bold" as const } }, folio.fecha_cierre || "—",
    ],
    [{ content: "Alcance:", styles: { fontStyle: "bold" as const, cellWidth: 35 } }, { content: folio.alcance || "—", colSpan: 5 }],
  ];

  autoTable(doc, {
    startY: y,
    body: descRows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Section II - Comité
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, pageW - 2 * margin, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("II.  FORMACIÓN Y APROBACIÓN DEL COMITÉ TÉCNICO", margin + 3, y + 5);
  y += 9;

  autoTable(doc, {
    startY: y,
    head: [["NOMBRE", "CARGO", "RESPONSABILIDAD", "FIRMA"]],
    body: comite.map((m) => [
      m.nombre,
      m.cargo,
      m.responsabilidad,
      m.firmado ? `✓ Firmado\n${m.fecha_firma ? new Date(m.fecha_firma).toLocaleDateString("es-MX") : ""}` : "Pendiente",
    ]),
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { cellWidth: 100 },
      3: { cellWidth: 35, halign: "center" },
    },
    margin: { left: margin, right: margin },
  });

  // ==================== RIESGOS PAGES ====================
  riesgos.forEach((r, idx) => {
    y = newPage();

    const sectionNum = idx + 3; // III, IV, V, VI...
    const romanNums = ["III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const roman = romanNums[idx] || `${sectionNum}`;

    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y, pageW - 2 * margin, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${roman}.  GESTIÓN DE RIESGOS`, margin + 3, y + 5);
    y += 9;

    const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
    const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
    const nprSym = getNPRSymbol(npr, r.severidad);
    const nprResSym = getNPRSymbol(nprRes, r.sev_residual);

    // Build the risk table matching the official format
    const riskData = [
      // Header row
      [
        { content: "ID", rowSpan: 6, styles: { halign: "center" as const, valign: "middle" as const, fontStyle: "bold" as const, cellWidth: 12 } },
        { content: "1. IDENTIFICACIÓN DE PELIGRO Y FALLA", colSpan: 1, styles: { fontStyle: "bold" as const, halign: "center" as const } },
        { content: "2. EVALUACIÓN INICIAL", colSpan: 2, styles: { fontStyle: "bold" as const, halign: "center" as const } },
        { content: "3. CONTROLES Y GESTIÓN", colSpan: 1, styles: { fontStyle: "bold" as const, halign: "center" as const } },
        { content: "4. EVALUACIÓN FINAL (RESIDUAL)", colSpan: 2, styles: { fontStyle: "bold" as const, halign: "center" as const } },
      ],
      // Etapa + S + Controles + Acción implementada
      [
        { content: `Etapa del Proceso:\n${r.etapa_proceso}` },
        { content: "S:", styles: { fontStyle: "bold" as const } }, { content: String(r.severidad), styles: { fontStyle: "bold" as const, halign: "center" as const } },
        { content: `Controles Actuales:\n${r.controles_actuales || "—"}` },
        { content: `Acción Implementada:\n${r.accion_implementada || "—"}`, colSpan: 2 },
      ],
      // Peligro + O + Requiere acción + Fecha evidencia
      [
        { content: `Peligro / Modo de Falla:\n${r.peligro_modo_falla}` },
        { content: "O:", styles: { fontStyle: "bold" as const } }, { content: String(r.ocurrencia), styles: { halign: "center" as const } },
        { content: `¿Requiere Acción?\n${r.requiere_accion ? "■ Si    □ No" : "□ Si    ■ No"}` },
        { content: `Fecha y Evidencia:\n${r.fecha_evidencia || "—"}`, colSpan: 2 },
      ],
      // Causa + D + Acción propuesta + Residuales
      [
        { content: `Causa Potencial:\n${r.causa_potencial}` },
        { content: "D:", styles: { fontStyle: "bold" as const } }, { content: String(r.deteccion), styles: { halign: "center" as const } },
        { content: `Acción Propuesta:\n${r.accion_propuesta || "—"}` },
        { content: `S: ${r.sev_residual}\nO: ${r.ocu_residual}\nD: ${r.det_residual}`, styles: { halign: "center" as const } },
        "",
      ],
      // Efecto + NPR + Responsable + NPR Residual
      [
        { content: `Efecto / Daño:\n${r.efecto_dano}` },
        { content: `NPR: (S x O x D):\n${nprSym}${npr}`, colSpan: 2, styles: { halign: "center" as const, fontStyle: "bold" as const } },
        { content: `Responsable:\n${r.responsable || "—"}` },
        { content: `NPR RESIDUAL:\n${nprResSym}${nprRes}`, colSpan: 2, styles: { halign: "center" as const, fontStyle: "bold" as const } },
      ],
      // Leyenda NPR + Fecha + Dictamen
      [
        "",
        { content: "● Crítico (> 150 ó S ≥ 9)\n◐ Mayor (60-149)\n○ Menor (< 60)", colSpan: 2, styles: { fontSize: 6 } },
        { content: `Fecha:\n${r.fecha_compromiso || "—"}` },
        { content: `DICTAMEN:\n${r.dictamen === "Aceptable" ? "■ Aceptable\n□ No Aceptable" : "□ Aceptable\n■ No Aceptable"}`, colSpan: 2 },
      ],
    ];

    autoTable(doc, {
      startY: y,
      body: riskData,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 70 },
        2: { cellWidth: 15 },
        3: { cellWidth: 15 },
        4: { cellWidth: 70 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 },
      },
      didParseCell: (data: any) => {
        // ID column
        if (data.column.index === 0 && data.row.index === 0) {
          data.cell.text = [];
        }
        if (data.column.index === 0 && data.row.index === 1) {
          data.cell.text = [String(r.numero_id).padStart(2, "0")];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "center";
          data.cell.styles.valign = "middle";
          data.cell.styles.fontSize = 14;
        }
      },
      margin: { left: margin, right: margin },
    });
  });

  // ==================== DICTAMEN PAGE ====================
  y = newPage();

  const dictamenRoman = ["III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][riesgos.length] || `${riesgos.length + 3}`;

  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, pageW - 2 * margin, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`${dictamenRoman}.  DICTAMEN DE BENEFICIO-RIESGO`, margin + 3, y + 5);
  y += 10;

  const hasNoAceptables = riesgos.some((r) => r.dictamen === "No Aceptable");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("¿Existen riesgos residuales clasificados como NO ACEPTABLES o CONDICIONADOS?", margin + 3, y + 3);
  const qx = margin + 175;
  doc.text(`SÍ  ${hasNoAceptables ? "■" : "□"}     NO  ${!hasNoAceptables ? "■" : "□"}`, qx, y + 3);
  y += 8;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("JUSTIFICACIÓN TÉCNICA:", margin + 3, y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.text("(Explicar por qué el beneficio médico supera el riesgo residual identificado, citando evidencia clínica o técnica).", margin + 50, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const justText = folio.justificacion_tecnica || "Sin justificación registrada.";
  const justLines = doc.splitTextToSize(justText, pageW - 2 * margin - 6);
  doc.text(justLines, margin + 3, y);
  y += justLines.length * 3.5 + 6;

  // Conclusión
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - 2 * margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CONCLUSIÓN:", margin + 5, y + 7);
  const conclusion = folio.conclusion || "Aprobado";
  doc.text(`APROBADO  ${conclusion === "Aprobado" ? "■" : "□"}`, margin + 80, y + 7);
  doc.text(`RECHAZADO  ${conclusion === "Rechazado" ? "■" : "□"}`, margin + 150, y + 7);

  // Save
  doc.save(`${folio.codigo}_${folio.proceso_equipo.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}
