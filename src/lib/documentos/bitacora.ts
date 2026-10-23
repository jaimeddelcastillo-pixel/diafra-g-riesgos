import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ContextoDocumento } from './index';
import { encabezadoPiePdf, firmasPdf, PDF_BOTTOM, PDF_TOP } from './pdf';
import { XLSX, escribirLibro, hojaConIdentidad } from './excel';

/** D1: general audit log exports (Excel and PDF) with the company document identity. */
export const ENCABEZADOS_BITACORA = ['Fecha/hora', 'Usuario', 'A nombre de (suplencia)', 'Módulo', 'Catálogo', 'Registro', 'Acción', 'Antes → después', 'Motivo'];

export function bitacoraExcel(ctx: ContextoDocumento, filtros: string, filas: string[][]): Uint8Array {
  const ws = hojaConIdentidad(ctx, ENCABEZADOS_BITACORA, filas, 1, 1, [[filtros], [`Eventos: ${filas.length}`]]);
  ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 60 }, { wch: 34 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
  return escribirLibro(wb);
}

export function bitacoraPdf(ctx: ContextoDocumento, filtros: string, filas: string[][]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  doc.setFontSize(8); doc.text(doc.splitTextToSize(`${filtros} · Eventos: ${filas.length}`, doc.internal.pageSize.getWidth() - 24), 12, PDF_TOP);
  autoTable(doc, {
    startY: PDF_TOP + 6, head: [ENCABEZADOS_BITACORA], body: filas, theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' }, headStyles: { fillColor: [220, 230, 241], textColor: 0 },
    columnStyles: { 7: { cellWidth: 70 } }, margin: { top: PDF_TOP, bottom: PDF_BOTTOM + 4, left: 12, right: 12 },
  });
  const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? PDF_TOP;
  firmasPdf(doc, ctx, y + 6);
  encabezadoPiePdf(doc, ctx);
  return doc;
}
