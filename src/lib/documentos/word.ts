import { AlignmentType, Footer, Header, ImageRun, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { datosFormato, lineaGenerado, type ContextoDocumento } from './index';

const base64 = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1] ?? ''), ch => ch.charCodeAt(0));

/** Word header: logo (or company name), company + title, code/version/validity and page X of Y. */
export function encabezadoWord(c: ContextoDocumento): Header {
  return new Header({ children: encabezadoWordHijos(c) });
}

/** Header content (to add extra rows such as a draft watermark). */
export function encabezadoWordHijos(c: ContextoDocumento): Table[] {
  const logo = c.logo
    ? new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: c.logo.format === 'PNG' ? 'png' : 'jpg', data: base64(c.logo.dataUrl), transformation: { width: 110, height: 45 } })] })
    : new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.razonSocial, bold: true, size: 16 })] });
  const celda = (children: Paragraph[], pct: number) => new TableCell({ children, width: { size: pct, type: WidthType.PERCENTAGE } });
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [
    celda([logo], 25),
    celda([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.razonSocial.toUpperCase(), bold: true, size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.titulo, bold: true, size: 20 })] })], 50),
    celda([...datosFormato(c).map(t => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, size: 14 })] })), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], bold: true, size: 14 })] })], 25),
  ] })] })];
}

export function pieWord(c: ContextoDocumento): Footer {
  return new Footer({ children: [...c.leyendas, lineaGenerado(c)].map(t => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, size: 14, color: '555555' })] })) });
}

export function firmasWord(c: ContextoDocumento): Table | null {
  if (!c.firmas.length) return null;
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: c.firmas.map(f => new TableCell({ children: [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.rol.toUpperCase(), bold: true })] }),
    new Paragraph({ text: '' }), new Paragraph({ text: '' }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.nombre ?? '' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.cargo, size: 16 })] }),
  ] })) })] });
}
