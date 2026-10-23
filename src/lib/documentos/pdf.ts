import type jsPDF from 'jspdf';
import { datosFormato, lineaGenerado, type ContextoDocumento } from './index';

const M = 12, HEADER_H = 22;
export const PDF_TOP = M + HEADER_H + 6;
export const PDF_BOTTOM = 18;
const limpio = (s: string) => s.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '');

/** Draws header (logo or company name, title, code/version/validity, page X of Y) and footer on every page. */
export function encabezadoPiePdf(doc: jsPDF, c: ContextoDocumento) {
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const logoW = 40, derW = 48, cenW = W - 2 * M - logoW - derW;
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.setTextColor(0);
    doc.rect(M, M, logoW, HEADER_H);
    if (c.logo) {
      const pr = doc.getImageProperties(c.logo.dataUrl); const r = Math.min((logoW - 4) / pr.width, (HEADER_H - 4) / pr.height);
      doc.addImage(c.logo.dataUrl, c.logo.format, M + (logoW - pr.width * r) / 2, M + (HEADER_H - pr.height * r) / 2, pr.width * r, pr.height * r);
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.text(doc.splitTextToSize(limpio(c.razonSocial), logoW - 4).slice(0, 3), M + logoW / 2, M + HEADER_H / 2, { align: 'center' });
    }
    const cx = M + logoW; doc.rect(cx, M, cenW, HEADER_H);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(doc.splitTextToSize(limpio(c.razonSocial.toUpperCase()), cenW - 4).slice(0, 2), cx + cenW / 2, M + 7, { align: 'center' });
    doc.setFontSize(10.5); doc.text(limpio(c.titulo), cx + cenW / 2, M + 16, { align: 'center' });
    const rx = cx + cenW; doc.rect(rx, M, derW, HEADER_H);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
    datosFormato(c).forEach((t, i) => doc.text(limpio(t), rx + derW / 2, M + 5 + i * 4.5, { align: 'center' }));
    doc.setFont('helvetica', 'bold'); doc.text(`Página ${p} de ${total}`, rx + derW / 2, M + HEADER_H - 2.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(80);
    const pie = [...c.leyendas, lineaGenerado(c)].map(limpio);
    doc.text(doc.splitTextToSize(pie.join(' · '), W - 2 * M).slice(0, 3), W / 2, H - 12, { align: 'center' });
    doc.setTextColor(0);
  }
}

/** Signature block (Elaboró / Revisó / Autorizó) with name and position; returns the new y. */
export function firmasPdf(doc: jsPDF, c: ContextoDocumento, y: number): number {
  if (!c.firmas.length) return y;
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  if (y + 30 > H - PDF_BOTTOM) { doc.addPage(); y = PDF_TOP; }
  const ancho = (W - 2 * M) / c.firmas.length;
  c.firmas.forEach((f, i) => {
    const x = M + i * ancho;
    doc.rect(x, y, ancho, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(f.rol.toUpperCase(), x + ancho / 2, y + 5, { align: 'center' });
    doc.line(x + 6, y + 18, x + ancho - 6, y + 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(limpio(f.nombre || ''), x + ancho / 2, y + 22, { align: 'center' });
    doc.text(limpio(f.cargo || ''), x + ancho / 2, y + 26, { align: 'center' });
  });
  return y + 32;
}
