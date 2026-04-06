import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Folio, Riesgo, FolioComite } from "@/hooks/useFolios";
import { getNPRLevel } from "@/hooks/useFolios";

// ─── Helpers de dibujo ────────────────────────────────────────────────────────

// Checkbox dibujado con rect — no depende de fuentes Unicode
function drawCheckbox(doc: jsPDF, x: number, y: number, checked: boolean) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, 3, 3);
  if (checked) {
    doc.setFillColor(0, 0, 0);
    doc.rect(x + 0.5, y + 0.5, 2, 2, "F");
  }
}

// Círculo de semáforo dibujado con colores reales
function drawSemaforoCircle(doc: jsPDF, x: number, y: number, r: number, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.circle(x, y, r, "FD");
}

function getNPRColor(npr: number, severidad: number): [number, number, number] {
  const level = getNPRLevel(npr, severidad);
  if (level.label === "Crítico") return [220, 53, 69]; // rojo
  if (level.label === "Mayor") return [255, 193, 7]; // amarillo
  return [40, 167, 69]; // verde
}

export function generateFolioPDF(folio: Folio, riesgos: Riesgo[], comite: FolioComite[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let pageNum = 0;

  // ─── Encabezado y pie ──────────────────────────────────────────────────────
  function addHeader() {
    // Borde de encabezado
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.rect(margin, 5, pageW - 2 * margin, 18, "S");

    // Columna izquierda: logo área
    doc.setLineWidth(0.3);
    doc.line(margin + 25, 5, margin + 25, 23);

    // Logo texto DIAFRA (fallback sin imagen)
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 31, 61); // azul DIAFRA
    doc.text("DIAFRA", margin + 3, 11);
    doc.text("S.A. DE C.V.", margin + 2, 15);
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.text("Gestión de Calidad", margin + 1, 19);
    doc.setTextColor(0);

    // Columna central: título
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DIAFRA S.A. DE C.V.", pageW / 2, 11, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD", pageW / 2, 15, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ARCHIVO MAESTRO DE GESTIÓN DE RIESGOS", pageW / 2, 20, { align: "center" });

    // Columna derecha: código y página
    doc.line(pageW - margin - 30, 5, pageW - margin - 30, 23);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SGC-11-01 (02)", pageW - margin - 15, 11, { align: "center" });
    const pn = (doc as any).internal.getCurrentPageInfo().pageNumber;
    const total = (doc as any).internal.getNumberOfPages();
    doc.text(`Página ${pn} de ${total}`, pageW - margin - 15, 17, { align: "center" });
  }

  function addFooter() {
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Documento confidencial propiedad de Diafra S.A. de C.V., queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.",
      pageW / 2,
      pageH - 3,
      { align: "center" },
    );
  }

  function newPage(): number {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    addHeader();
    addFooter();
    return 28; // y inicial después del encabezado
  }

  // ─── PÁGINA 1: Descripción + Comité ───────────────────────────────────────
  let y = newPage();

  // Sección I
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, pageW - 2 * margin, 6, "F");
  doc.setDrawColor(0);
  doc.rect(margin, y, pageW - 2 * margin, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("I.  DESCRIPCIÓN", margin + 3, y + 4.2);
  y += 7;

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: "Folio de Gestión:", styles: { fontStyle: "bold", cellWidth: 32 } },
        { content: folio.codigo, colSpan: 5, styles: { fontStyle: "bold", fontSize: 9 } },
      ],
      [
        { content: "Proceso / Equipo\nAnalizado:", styles: { fontStyle: "bold", cellWidth: 32 } },
        { content: folio.proceso_equipo, colSpan: 1 },
        { content: "Origen:", styles: { fontStyle: "bold", cellWidth: 18 } },
        { content: folio.origen || "—" },
        { content: "Desviación:", styles: { fontStyle: "bold", cellWidth: 22 } },
        { content: folio.desviacion_id || "—" },
      ],
      [
        { content: "Control de Cambios:", styles: { fontStyle: "bold", cellWidth: 32 } },
        { content: folio.control_cambios_id || "—" },
        { content: "Fecha Inicio:", styles: { fontStyle: "bold" } },
        { content: folio.fecha_inicio },
        { content: "Fecha Cierre:", styles: { fontStyle: "bold" } },
        { content: folio.fecha_cierre || "—" },
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

  // Sección II - Comité
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, pageW - 2 * margin, 6, "F");
  doc.setDrawColor(0);
  doc.rect(margin, y, pageW - 2 * margin, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("II.  FORMACIÓN Y APROBACIÓN DEL COMITÉ TÉCNICO", margin + 3, y + 4.2);
  y += 7;

  // Tabla comité — FIRMA EN BLANCO (para firma física)
  autoTable(doc, {
    startY: y,
    head: [["NOMBRE", "CARGO", "RESPONSABILIDAD", "FIRMA"]],
    body: comite.map((m) => [
      m.nombre,
      m.cargo,
      m.responsabilidad,
      "", // FIRMA EN BLANCO — se firma en físico después de imprimir
    ]),
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, minCellHeight: 12 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 45 },
      2: { cellWidth: 120 },
      3: { cellWidth: 35, halign: "center" },
    },
    margin: { left: margin, right: margin },
  });

  // ─── PÁGINAS DE RIESGOS ────────────────────────────────────────────────────
  const romanNums = ["III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

  riesgos.forEach((r, idx) => {
    y = newPage();
    const roman = romanNums[idx] || `${idx + 3}`;

    // Encabezado de sección
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, y, pageW - 2 * margin, 6, "F");
    doc.setDrawColor(0);
    doc.rect(margin, y, pageW - 2 * margin, 6, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${roman}.  GESTIÓN DE RIESGOS`, margin + 3, y + 4.2);
    y += 7;

    const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
    const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;

    // Tabla de riesgo
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
        [
          {
            content: String(r.numero_id).padStart(2, "0"),
            rowSpan: 5,
            styles: { halign: "center", valign: "middle", fontSize: 14, fontStyle: "bold" },
          },
          `Etapa del Proceso:\n${r.etapa_proceso}`,
          { content: "S:", styles: { fontStyle: "bold", halign: "right" } },
          { content: String(r.severidad), styles: { fontStyle: "bold", halign: "center", fontSize: 10 } },
          `Controles Actuales:\n${r.controles_actuales || "—"}`,
          { content: `Acción Implementada:\n${r.accion_implementada || "—"}`, colSpan: 2 },
        ],
        [
          `Peligro / Modo de Falla:\n${r.peligro_modo_falla}`,
          { content: "O:", styles: { fontStyle: "bold", halign: "right" } },
          { content: String(r.ocurrencia), styles: { halign: "center", fontSize: 10 } },
          // ¿Requiere Acción? — texto limpio sin checkboxes Unicode
          `¿Requiere Acción?\n   Si       No`,
          { content: `Fecha y Evidencia:\n${r.fecha_evidencia || "—"}`, colSpan: 2 },
        ],
        [
          `Causa Potencial:\n${r.causa_potencial}`,
          { content: "D:", styles: { fontStyle: "bold", halign: "right" } },
          { content: String(r.deteccion), styles: { halign: "center", fontSize: 10 } },
          `Acción Propuesta:\n${r.accion_propuesta || "—"}`,
          { content: `S: ${r.sev_residual}\nO: ${r.ocu_residual}\nD: ${r.det_residual}`, styles: { halign: "center" } },
          "",
        ],
        [
          `Efecto / Daño:\n${r.efecto_dano}`,
          { content: `NPR: (S x O x D):\n${npr}`, colSpan: 2, styles: { halign: "center", fontStyle: "bold" } },
          `Responsable:\n${r.responsable || "—"}`,
          { content: `NPR RESIDUAL:\n${nprRes}`, colSpan: 2, styles: { halign: "center", fontStyle: "bold" } },
        ],
        [
          "",
          // Leyenda sin emojis
          { content: "Critico (> 150 o S >= 9)\nMayor (60-149)\nMenor (< 60)", colSpan: 2, styles: { fontSize: 6 } },
          `Fecha:\n${r.fecha_compromiso || "—"}`,
          // Dictamen — texto limpio sin checkboxes Unicode
          { content: `DICTAMEN:\n   Aceptable\n   No Aceptable`, colSpan: 2 },
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
        4: { cellWidth: 68 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didDrawCell: (data: any) => {
        // Dibujar checkboxes como rectángulos reales
        const { cell, row, column } = data;
        const cx = cell.x;
        const cy = cell.y;

        // Fila ¿Requiere Acción? (row.index=1, col=4 en body)
        if (row.section === "body" && row.index === 1 && column.index === 4) {
          const x0 = cx + 4;
          const y0 = cy + 10;
          drawCheckbox(doc, x0, y0, r.requiere_accion === true);
          drawCheckbox(doc, x0 + 12, y0, r.requiere_accion === false);
        }

        // Fila Dictamen (row.index=4, col=5)
        if (row.section === "body" && row.index === 4 && column.index === 5) {
          const x0 = cx + 4;
          drawCheckbox(doc, x0, cy + 9, r.dictamen === "Aceptable");
          drawCheckbox(doc, x0, cy + 14, r.dictamen === "No Aceptable");
        }

        // Semáforo NPR (row.index=3, col=2) — círculos de color
        if (row.section === "body" && row.index === 3 && column.index === 2) {
          const color = getNPRColor(npr, r.severidad);
          drawSemaforoCircle(doc, cx + 6, cy + cell.height / 2, 2.5, color);
        }

        // Semáforo NPR Residual (row.index=3, col=5)
        if (row.section === "body" && row.index === 3 && column.index === 5) {
          const color = getNPRColor(nprRes, r.sev_residual);
          drawSemaforoCircle(doc, cx + 6, cy + cell.height / 2, 2.5, color);
        }

        // Leyenda semáforo (row.index=4, col=2) — 3 círculos de colores
        if (row.section === "body" && row.index === 4 && column.index === 2) {
          drawSemaforoCircle(doc, cx + 4, cy + 5, 1.8, [220, 53, 69]);
          drawSemaforoCircle(doc, cx + 4, cy + 10, 1.8, [255, 193, 7]);
          drawSemaforoCircle(doc, cx + 4, cy + 15, 1.8, [40, 167, 69]);
        }
      },
    });
  });

  // ─── PÁGINA DICTAMEN ───────────────────────────────────────────────────────
  y = newPage();
  const dictamenRoman = romanNums[riesgos.length] || `${riesgos.length + 3}`;

  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, pageW - 2 * margin, 6, "F");
  doc.setDrawColor(0);
  doc.rect(margin, y, pageW - 2 * margin, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${dictamenRoman}.  DICTAMEN DE BENEFICIO-RIESGO`, margin + 3, y + 4.2);
  y += 10;

  const hasNoAceptables = riesgos.some((r) => r.dictamen === "No Aceptable");

  // Línea ¿Existen riesgos NO ACEPTABLES?
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - 2 * margin, 8, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("¿Existen riesgos residuales clasificados como NO ACEPTABLES o CONDICIONADOS?", margin + 3, y + 5);

  const qx = margin + 190;
  doc.text("SÍ", qx, y + 5);
  drawCheckbox(doc, qx + 6, y + 2, hasNoAceptables);
  doc.text("NO", qx + 18, y + 5);
  drawCheckbox(doc, qx + 24, y + 2, !hasNoAceptables);
  y += 11;

  // Justificación técnica
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageW - 2 * margin, 35, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("JUSTIFICACIÓN TÉCNICA:", margin + 3, y + 4);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.text(
    "(Explicar por qué el beneficio médico supera el riesgo residual identificado, citando evidencia clínica o técnica).",
    margin + 46,
    y + 4,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const justText = folio.justificacion_tecnica || "";
  if (justText) {
    const justLines = doc.splitTextToSize(justText, pageW - 2 * margin - 6);
    doc.text(justLines, margin + 3, y + 9);
  }
  y += 38;

  // Conclusión
  doc.setLineWidth(0.4);
  doc.rect(margin, y, pageW - 2 * margin, 10, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CONCLUSIÓN:", margin + 5, y + 7);

  const conclusion = folio.conclusion || "";
  doc.setFontSize(8);
  doc.text("APROBADO", margin + 65, y + 7);
  drawCheckbox(doc, margin + 84, y + 4, conclusion === "Aprobado");
  doc.text("RECHAZADO", margin + 140, y + 7);
  drawCheckbox(doc, margin + 163, y + 4, conclusion === "Rechazado");

  // Actualizar páginas en encabezados (re-render headers con total correcto)
  const totalPgs = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPgs; i++) {
    doc.setPage(i);
    // Actualizar número de páginas en encabezado
    doc.setFillColor(255, 255, 255);
    doc.rect(pageW - margin - 30, 5, 30, 18, "F");
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(pageW - margin - 30, 5, pageW - margin - 30, 23);
    doc.rect(pageW - margin - 30, 5, 30, 18, "S");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SGC-11-01 (02)", pageW - margin - 15, 11, { align: "center" });
    doc.text(`Página ${i} de ${totalPgs}`, pageW - margin - 15, 17, { align: "center" });
  }

  doc.save(`${folio.codigo}_${folio.proceso_equipo.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}
