// Pieza compartida C6a.3: lectura de archivos (PDF, Word, imágenes) para las funciones de IA.
// La usa chat-analizar-documento (asistente) y brain-extract-document (Cerebro).
// PDF: pdfjs-dist 4.2.67 (legacy) — corre dentro de la función, sin servicios externos.

import JSZip from "npm:jszip@3.10.1";

/** Reads tenant-private bitacora originals through the authenticated storage client. */
export async function leerBitacoraPrivada(client: any, orgId: string, path: string) {
  if (!path.startsWith(`${orgId}/`) || path.includes('..')) throw new Error('Foto fuera de empresa');
  const { data, error } = await client.storage.from('tend-bitacoras').download(path);
  if (error || !data) throw new Error(error?.message ?? 'Foto no disponible');
  if (!['image/png', 'image/jpeg'].includes(data.type)) throw new Error('Extracción requiere foto PNG o JPEG; PDF queda para carga manual');
  if (!data.size || data.size > 10 * 1024 * 1024) throw new Error('Foto vacía o mayor a 10 MB');
  const bytes = await data.arrayBuffer();
  return { mime: data.type, base64: arrayBufferToBase64(bytes) };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function isWordMime(mimeType: string, fileName: string): boolean {
  return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    || fileName.toLowerCase().endsWith(".docx");
}

// deno-lint-ignore no-explicit-any
export function bloquePdf(buffer: ArrayBuffer): any {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: arrayBufferToBase64(buffer) },
  };
}

// deno-lint-ignore no-explicit-any
export function bloqueImagen(buffer: ArrayBuffer, mimeType: string): any {
  return {
    type: "image",
    source: { type: "base64", media_type: mimeType, data: arrayBufferToBase64(buffer) },
  };
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) return "";
  return documentXml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ParrafoDocx {
  parrafo: number;
  seccion: string | null;
  texto: string;
}

// Word con posición: número de párrafo y encabezado de la sección donde está (decisión c).
export async function extractDocxParrafos(buffer: ArrayBuffer): Promise<ParrafoDocx[]> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) return [];
  const limpiar = (s: string) =>
    s.replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  const bloques = documentXml.split(/<w:p[ >]/).slice(1);
  const parrafos: ParrafoDocx[] = [];
  let seccion: string | null = null;
  bloques.forEach((b, i) => {
    const texto = limpiar(b);
    if (!texto) return;
    const estilo = b.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? "";
    if (/heading|ttulo|titulo/i.test(estilo)) seccion = texto;
    parrafos.push({ parrafo: i + 1, seccion, texto });
  });
  return parrafos;
}

export interface PaginaPdf {
  numero: number;
  texto: string;
}

export interface ResultadoPdf {
  paginas: PaginaPdf[];
  totalPaginas: number;
  truncado: boolean;
}

// Texto por página con número de página, limitado a maxPaginas (tope del plan).
export async function extractPdfPaginas(buffer: ArrayBuffer, maxPaginas: number): Promise<ResultadoPdf> {
  const pdfjs = await import("npm:pdfjs-dist@4.2.67/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useWorkerFetch: false,
  }).promise;
  const total = doc.numPages;
  const hasta = Math.min(total, Math.max(1, maxPaginas));
  const paginas: PaginaPdf[] = [];
  for (let i = 1; i <= hasta; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // deno-lint-ignore no-explicit-any
    const texto = tc.items.map((it: any) => it.str).join(" ").replace(/\s+/g, " ").trim();
    paginas.push({ numero: i, texto });
  }
  await doc.destroy();
  return { paginas, totalPaginas: total, truncado: total > hasta };
}
