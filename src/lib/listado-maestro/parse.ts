/**
 * Parsers del Listado Maestro de Documentos.
 * Lógica pura: sin React ni Supabase. Recibe ArrayBuffer/texto y devuelve una TablaCruda.
 */
import * as XLSX from "xlsx";
import { LIMITES, MENSAJES, type FormatoImport, type MotivoFallo, type ParseResult, type TablaCruda } from "./tipos";

const TOKENS_ENCABEZADO = [
  "codigo", "clave", "documento", "nombre", "titulo", "procedimiento",
  "revision", "version", "edicion", "fecha", "vigencia", "area",
  "departamento", "responsable", "estado", "tipo",
];

export function normalizar(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fail(reason: MotivoFallo, diagnostico?: string): ParseResult {
  return { ok: false, reason, message: MENSAJES[reason], diagnostico };
}

export function detectarFormato(nombreArchivo: string): FormatoImport | null {
  const n = nombreArchivo.toLowerCase();
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "xlsx";
  if (n.endsWith(".csv")) return "csv";
  if (n.endsWith(".md")) return "md";
  if (n.endsWith(".txt")) return "txt";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".pdf")) return "pdf";
  return null;
}

/** Parser CSV propio: comillas dobles, separador , o ; autodetectado. */
export function parseCsv(texto: string): string[][] {
  const muestra = texto.slice(0, 5000);
  const sep = (muestra.split(";").length > muestra.split(",").length) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i++; } else enComillas = false;
      } else celda += c;
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === sep) { fila.push(celda); celda = ""; continue; }
    if (c === "\n") { fila.push(celda); filas.push(fila); fila = []; celda = ""; continue; }
    if (c === "\r") continue;
    celda += c;
  }
  if (celda !== "" || fila.length > 0) { fila.push(celda); filas.push(fila); }
  return filas.map((f) => f.map((x) => x.trim()));
}

/** TXT/MD: tablas markdown (| … |) o columnas separadas por tabulación. */
export function parseTextoTabular(texto: string): string[][] {
  const lineas = texto.split(/\r?\n/);
  const esMd = lineas.some((l) => l.trim().startsWith("|") && l.includes("|", 1));
  if (esMd) {
    return lineas
      .filter((l) => l.trim().startsWith("|"))
      .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
      .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
  }
  return lineas
    .filter((l) => l.trim() !== "")
    .map((l) => (l.includes("\t") ? l.split("\t") : l.split(/\s{2,}/)).map((c) => c.trim()));
}

/**
 * Detecta la fila de encabezado dentro de las primeras 20 filas:
 * primera fila con >=3 celdas no vacías, mayoría de texto y sin repeticiones,
 * priorizando la que contenga tokens conocidos.
 */
export function detectarEncabezado(filas: string[][]): number {
  const ventana = filas.slice(0, 20);
  let mejor = -1;
  let mejorPuntaje = 0;
  ventana.forEach((fila, idx) => {
    const celdas = fila.map((c) => (c ?? "").trim()).filter((c) => c !== "");
    if (celdas.length < 3) return;
    const texto = celdas.filter((c) => !/^-?\d+([.,]\d+)?$/.test(c)).length;
    if (texto < celdas.length / 2) return;
    const unicas = new Set(celdas.map(normalizar));
    if (unicas.size < celdas.length) return;
    const tokens = celdas.filter((c) =>
      TOKENS_ENCABEZADO.some((t) => normalizar(c).includes(t)),
    ).length;
    const puntaje = tokens * 10 + celdas.length;
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = idx; }
  });
  return mejor;
}

/** Convierte una grilla cruda en TablaCruda validando límites. */
export function construirTabla(grilla: string[][], formato: FormatoImport): ParseResult {
  const limpias = grilla.filter((f) => f.some((c) => (c ?? "").trim() !== ""));
  if (limpias.length === 0) return fail("empty");

  const idx = detectarEncabezado(limpias);
  if (idx < 0) return fail("no_headers");

  const encabezados = limpias[idx].map((c, i) => ((c ?? "").trim() || `Columna ${i + 1}`));
  if (encabezados.length > LIMITES.MAX_COLUMNAS) return fail("too_many_cols");

  const clave = normalizar(encabezados.join("|"));
  const filas = limpias
    .slice(idx + 1)
    .filter((f) => normalizar(f.join("|")) !== clave)
    .map((f) => encabezados.map((_, i) => (f[i] ?? "").toString().trim()))
    .filter((f) => f.some((c) => c !== ""));

  if (filas.length === 0) return fail("empty");
  if (filas.length > LIMITES.MAX_FILAS) return fail("too_many_rows");

  const tabla: TablaCruda = { encabezados, filas, filaEncabezado: idx };
  return { ok: true, formato, tabla };
}

export function parseXlsxBuffer(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  if (!hoja) return fail("empty");
  const grilla = XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, raw: false, defval: "" });
  return construirTabla(grilla.map((f) => (f ?? []).map((c) => String(c ?? ""))), "xlsx");
}

/** Punto de entrada para formatos que ya se resolvieron a texto o grilla. */
export function parseDesdeTexto(texto: string, formato: FormatoImport): ParseResult {
  const grilla = formato === "csv" ? parseCsv(texto) : parseTextoTabular(texto);
  return construirTabla(grilla, formato);
}

/** Valida tamaño antes de leer el archivo. */
export function validarTamano(bytes: number): ParseResult | null {
  if (bytes > LIMITES.MAX_BYTES) return fail("too_large");
  return null;
}

export { fail as falloParse };
