/** Tipos compartidos de la importación de Listado Maestro de Documentos. */

export type FormatoImport = "xlsx" | "csv" | "txt" | "md" | "docx" | "pdf";

export type CampoTracea =
  | "codigo"
  | "nombre"
  | "revision"
  | "fecha"
  | "area"
  | "responsable"
  | "estado"
  | "tipo";

export type Confianza = "alta" | "media" | "baja";

export interface TablaCruda {
  encabezados: string[];
  /** Filas de datos; cada fila alineada a `encabezados`. */
  filas: string[][];
  /** Índice (0-based) de la fila de encabezado dentro del archivo original. */
  filaEncabezado: number;
}

export type MotivoFallo =
  | "too_large"
  | "too_many_rows"
  | "too_many_cols"
  | "unsupported"
  | "no_headers"
  | "docx_sin_tabla"
  | "pdf_sin_texto"
  | "empty"
  | "error";

export interface ParseFail {
  ok: false;
  reason: MotivoFallo;
  message: string;
  /** Texto extraído para previsualización diagnóstica (docx/pdf sin tabla). */
  diagnostico?: string;
}

export interface ParseOk {
  ok: true;
  formato: FormatoImport;
  tabla: TablaCruda;
}

export type ParseResult = ParseOk | ParseFail;

export interface MapeoColumna {
  /** Encabezado tal como viene en el archivo. */
  origen: string;
  indice: number;
  campo: CampoTracea | null;
  confianza: Confianza;
}

export interface RegistroImport {
  fila: number;
  codigo?: string;
  nombre: string;
  revision?: string;
  fecha?: string;
  area?: string;
  responsable?: string;
  estado?: string;
  tipo?: string;
}

export type ClasificacionRegistro =
  | "nuevo"
  | "posible_actualizacion"
  | "posible_duplicado"
  | "requiere_revision";

export interface RegistroClasificado extends RegistroImport {
  clasificacion: ClasificacionRegistro;
  documento_existente_id?: string;
  motivo?: string;
}

export interface DocumentoExistente {
  id: string;
  nombre: string;
  codigo?: string | null;
  revision?: string | null;
}

export const LIMITES = {
  MAX_BYTES: 10 * 1024 * 1024,
  MAX_FILAS: 2000,
  MAX_COLUMNAS: 40,
} as const;

export const MENSAJES: Record<MotivoFallo, string> = {
  too_large: "El archivo supera el límite de 10 MB. Divide el listado y vuelve a intentarlo.",
  too_many_rows:
    "El archivo supera las 2,000 filas permitidas por importación. Divide el listado por área o por rango de códigos.",
  too_many_cols:
    "El archivo supera las 40 columnas permitidas. Conserva solo las columnas relevantes del listado.",
  unsupported: "Formato no compatible. Acepto: Excel (.xlsx), CSV, TXT, Markdown, Word (.docx) y PDF con texto.",
  no_headers:
    "No se detectó una fila de encabezados. Verifica que el archivo tenga una fila con los nombres de las columnas.",
  docx_sin_tabla:
    "Este archivo no contiene una estructura tabular que TRACEA pueda importar con suficiente confiabilidad. Para una importación más precisa, utiliza preferentemente Excel (.xlsx) o CSV (.csv).",
  pdf_sin_texto:
    "Este archivo parece requerir reconocimiento de texto (OCR). Para esta versión, utiliza preferentemente Excel, CSV, Word, TXT, Markdown o un PDF con texto seleccionable.",
  empty: "El archivo no contiene filas de datos.",
  error: "Ocurrió un error procesando el archivo. Intenta de nuevo o utiliza Excel o CSV.",
};
