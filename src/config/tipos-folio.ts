/**
 * Tipos de análisis de folio (códigos GR-[TIPO]-AAAA-NNN).
 *
 * Cada tipo lleva su propia secuencia independiente por organización y año
 * en la tabla `folio_sequence`. La validación final vive en la función
 * `next_folio_code(p_tipo)` de la base de datos.
 */

export type TipoFolioKey = "SGC" | "FAB" | "SIS" | "CAL" | "PRD" | "PMS" | "FV";

export interface TipoFolioInfo {
  key: TipoFolioKey;
  /** Etiqueta corta para badges y filtros */
  short: string;
  /** Descripción visible en selectores */
  descripcion: string;
}

export const TIPOS_FOLIO: Record<TipoFolioKey, TipoFolioInfo> = {
  SGC: { key: "SGC", short: "SGC", descripcion: "Sistema de Gestión de Calidad" },
  FAB: { key: "FAB", short: "FAB", descripcion: "Procesos de Fabricación" },
  SIS: { key: "SIS", short: "SIS", descripcion: "Sistemas Críticos e Infraestructura" },
  CAL: { key: "CAL", short: "CAL", descripcion: "Eventos de Calidad" },
  PRD: { key: "PRD", short: "PRD", descripcion: "Producto / Diseño" },
  PMS: { key: "PMS", short: "PMS", descripcion: "Post-mercado / Tecnovigilancia" },
  FV:  { key: "FV",  short: "FV",  descripcion: "Farmacovigilancia" },
};

const TIPOS_NOM241: TipoFolioKey[] = ["SGC", "FAB", "SIS", "CAL", "PRD", "PMS"];
const TIPOS_NOM059: TipoFolioKey[] = ["SGC", "FAB", "SIS", "CAL", "PRD", "FV"];
const TIPOS_MULTI:  TipoFolioKey[] = ["SGC", "FAB", "SIS", "CAL", "PRD", "PMS", "FV"];

/**
 * Devuelve los tipos aplicables a la norma de la organización.
 * Fallback: NOM-241.
 */
export function getTiposDisponibles(norma: string | null | undefined): TipoFolioInfo[] {
  const keys =
    norma === "NOM-059" ? TIPOS_NOM059 :
    norma === "MULTI"   ? TIPOS_MULTI  :
    TIPOS_NOM241;
  return keys.map((k) => TIPOS_FOLIO[k]);
}

/** Etiqueta corta segura para cualquier valor (incluye históricos NULL). */
export function getTipoLabel(tipo: string | null | undefined): string {
  if (!tipo) return "Sin tipo";
  return TIPOS_FOLIO[tipo as TipoFolioKey]?.short ?? tipo;
}

/** "FAB — Procesos de Fabricación" */
export function formatTipoFolio(tipo: TipoFolioKey): string {
  const info = TIPOS_FOLIO[tipo];
  return `${info.short} — ${info.descripcion}`;
}

/** Valida si el tipo es aplicable a la norma indicada. */
export function isTipoValidoParaNorma(
  tipo: string | null | undefined,
  norma: string | null | undefined,
): boolean {
  if (!tipo) return false;
  return getTiposDisponibles(norma).some((t) => t.key === tipo);
}