// Extracción de texto de archivos en el frontend para enviar al Asistente IA.
// Soporta PDF (texto digital), XLSX y DOCX. Hasta 8 000 caracteres.

import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_CHARS = 8000;
const MAX_BYTES = 10 * 1024 * 1024;
const TRUNCATED_SUFFIX =
  "\n\n[ARCHIVO TRUNCADO — se procesaron los primeros 8,000 caracteres. Para analizar el resto comparte las secciones adicionales.]";

export type ExtractKind = "pdf" | "xlsx" | "docx";
export type ExtractFailReason =
  | "scanned_pdf"
  | "image"
  | "too_large"
  | "unsupported"
  | "empty"
  | "error";

export type ExtractResult =
  | { ok: true; kind: ExtractKind; text: string; truncated: boolean }
  | { ok: false; reason: ExtractFailReason; message: string };

const ERROR_MESSAGES: Record<ExtractFailReason, string> = {
  scanned_pdf:
    "Este PDF es una imagen escaneada — no puedo extraer el texto automáticamente. Opciones: compártelo en Word o Excel, o copia el contenido manualmente en el chat.",
  image:
    "Las imágenes no son compatibles aún. Por favor comparte tu AMEF en PDF, Excel o Word.",
  too_large:
    "El archivo es demasiado grande — máximo 10MB. Intenta con una versión más ligera o comparte solo las hojas relevantes.",
  unsupported:
    "Formato no compatible. Acepto: PDF, Excel (.xlsx) y Word (.docx).",
  empty:
    "No se pudo extraer texto del archivo. Verifica que no esté vacío o protegido.",
  error:
    "Ocurrió un error procesando el archivo. Intenta de nuevo o comparte el contenido como texto.",
};

function fail(reason: ExtractFailReason): ExtractResult {
  return { ok: false, reason, message: ERROR_MESSAGES[reason] };
}

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_CHARS) + TRUNCATED_SUFFIX, truncated: true };
}

function detectKind(file: File): ExtractKind | "image" | "unsupported" {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".xlsx") || type.includes("spreadsheetml")) return "xlsx";
  if (name.endsWith(".docx") || type.includes("wordprocessingml")) return "docx";
  if (type.startsWith("image/")) return "image";
  return "unsupported";
}

async function extractPdf(file: File): Promise<ExtractResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ");
    pages.push(pageText);
    if (pages.join("\n").length > MAX_CHARS * 2) break;
  }
  const text = pages.join("\n\n").trim();
  if (text.length < 100) return fail("scanned_pdf");
  const { text: out, truncated } = truncate(text);
  return { ok: true, kind: "pdf", text: out, truncated };
}

async function extractXlsx(file: File): Promise<ExtractResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: " | " }).trim();
    if (csv) parts.push(`Hoja ${name}:\n${csv}`);
    if (parts.join("\n\n").length > MAX_CHARS * 2) break;
  }
  const text = parts.join("\n\n").trim();
  if (!text) return fail("empty");
  const { text: out, truncated } = truncate(text);
  return { ok: true, kind: "xlsx", text: out, truncated };
}

async function extractDocx(file: File): Promise<ExtractResult> {
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = (value ?? "").trim();
  if (!text) return fail("empty");
  const { text: out, truncated } = truncate(text);
  return { ok: true, kind: "docx", text: out, truncated };
}

export async function extractFileText(file: File): Promise<ExtractResult> {
  if (file.size > MAX_BYTES) return fail("too_large");
  const kind = detectKind(file);
  if (kind === "image") return fail("image");
  if (kind === "unsupported") return fail("unsupported");
  try {
    if (kind === "pdf") return await extractPdf(file);
    if (kind === "xlsx") return await extractXlsx(file);
    return await extractDocx(file);
  } catch (err) {
    console.error("extractFileText", err);
    return fail("error");
  }
}

export function buildAttachmentPrefix(fileName: string, extractedText: string) {
  return `[ARCHIVO ADJUNTO: ${fileName}]\n[INICIO CONTENIDO]\n${extractedText}\n[FIN CONTENIDO]\n\n`;
}

export const ATTACHMENT_DEFAULT_PROMPT =
  "Analiza este documento y dime qué información contiene relevante para gestión de riesgos.";