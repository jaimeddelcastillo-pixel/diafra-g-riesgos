/** Adaptador de navegador: File -> ParseResult. Aísla mammoth/pdfjs del núcleo puro. */
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { construirTabla, detectarFormato, falloParse, parseDesdeTexto, parseXlsxBuffer, validarTamano } from "./parse";
import type { ParseResult } from "./tipos";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/** Extrae tablas reales del DOCX; si no hay, devuelve diagnóstico de texto. */
async function parseDocx(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tablas = Array.from(doc.querySelectorAll("table"));
  for (const t of tablas) {
    const grilla = Array.from(t.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((td) => (td.textContent ?? "").trim()),
    );
    const res = construirTabla(grilla, "docx");
    if (res.ok) return res;
  }
  const { value: texto } = await mammoth.extractRawText({ arrayBuffer });
  return falloParse("docx_sin_tabla", (texto ?? "").slice(0, 3000));
}

/** PDF digital: agrupa items por posición vertical y ordena por X (mejor esfuerzo). */
async function parsePdf(file: File): Promise<ParseResult> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const grilla: string[][] = [];
  let caracteres = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lineas = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as any[]) {
      const s = String(item.str ?? "").trim();
      if (!s) continue;
      caracteres += s.length;
      const y = Math.round(item.transform[5]);
      const clave = Math.round(y / 4) * 4;
      const arr = lineas.get(clave) ?? [];
      arr.push({ x: item.transform[4], s });
      lineas.set(clave, arr);
    }
    Array.from(lineas.entries())
      .sort((a, b) => b[0] - a[0])
      .forEach(([, celdas]) => {
        grilla.push(celdas.sort((a, b) => a.x - b.x).map((c) => c.s));
      });
  }
  if (caracteres < 100) return falloParse("pdf_sin_texto");
  const res = construirTabla(grilla, "pdf");
  if (!res.ok && res.reason === "no_headers") return falloParse("pdf_sin_texto");
  return res;
}

export async function parseArchivo(file: File): Promise<ParseResult> {
  const limite = validarTamano(file.size);
  if (limite) return limite;
  const formato = detectarFormato(file.name);
  if (!formato) return falloParse("unsupported");
  try {
    if (formato === "xlsx") return parseXlsxBuffer(await file.arrayBuffer());
    if (formato === "docx") return await parseDocx(file);
    if (formato === "pdf") return await parsePdf(file);
    return parseDesdeTexto(await file.text(), formato);
  } catch (err) {
    console.error("parseArchivo", err);
    return falloParse("error");
  }
}
