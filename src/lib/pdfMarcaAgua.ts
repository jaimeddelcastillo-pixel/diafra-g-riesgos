import type jsPDF from "jspdf";

/**
 * Marca de agua diagonal centrada en la página activa de jsPDF, según su tamaño
 * y orientación reales (vertical u horizontal). `align: "center"` de jsPDF no
 * centra texto girado, así que el punto de inicio se calcula a mano.
 */
export function dibujarMarcaAguaCentrada(doc: jsPDF, texto: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const d: any = doc;
  const gs = d.GState ? new d.GState({ opacity: 0.25 }) : null;
  if (gs) d.setGState(gs);
  doc.setTextColor(180, 0, 0);
  doc.setFont("helvetica", "bold");
  let size = 26;
  doc.setFontSize(size);
  while (size > 8 && doc.getTextWidth(texto) > Math.hypot(W, H) * 0.85) {
    size -= 1;
    doc.setFontSize(size);
  }
  const w = doc.getTextWidth(texto);
  const k = doc.internal.scaleFactor; // pt por unidad
  const capH = (size / k) * 0.72;
  const a = Math.atan2(H, W);
  const x = W / 2 - (w / 2) * Math.cos(a) + (capH / 2) * Math.sin(a);
  const y = H / 2 + (w / 2) * Math.sin(a) + (capH / 2) * Math.cos(a);
  doc.text(texto, x, y, { angle: (a * 180) / Math.PI });
  if (gs) d.setGState(new d.GState({ opacity: 1 }));
  doc.setTextColor(0);
}
