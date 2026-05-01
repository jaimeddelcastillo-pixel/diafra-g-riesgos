/**
 * Configuración centralizada de normas regulatorias soportadas por TRACEA.
 *
 * Cada norma define su terminología de UI, catálogos S/O/D, umbrales de NPR,
 * regla de criticidad por severidad, metodología y branding. La norma se
 * resuelve a partir de `folio.norma_folio` (preferido, congelado al crear
 * el folio) o `organization.norma_aplicable` cuando no hay folio aún.
 *
 * IMPORTANTE: nunca cambiar las claves (`NOM-241`, `NOM-059`, `MULTI`) sin
 * migración de datos — están persistidas en BD.
 */

export type NormaKey = "NOM-241" | "NOM-059" | "MULTI";
export type MetodologiaKey = "AMEF" | "ICH-Q9" | "MULTI";

export interface CatalogoItem {
  valor: number;
  etiqueta: string;
  descripcion: string;
}

export interface NormaTerminologia {
  /** Nombre del beneficio (ej: "Beneficio clínico" vs "Beneficio terapéutico") */
  beneficio: string;
  /** Cargo del aprobador final */
  aprobadorFinal: string;
  /** Etiqueta para "proceso/equipo" según contexto */
  procesoEquipo: string;
  /** Etiqueta para el objeto de análisis (dispositivo vs producto/lote) */
  objetoAnalisis: string;
  /** Texto corto descriptivo de la norma */
  descripcionCorta: string;
  /** Encabezado de tabla de riesgos */
  efectoDano: string;
}

export interface NormaConfig {
  key: NormaKey;
  nombre: string;
  nombreLargo: string;
  metodologia: MetodologiaKey;
  metodologiaNombre: string;
  /** Normas internacionales aplicables a esta regulación */
  normasReferencia: string[];
  /** Si false, el formulario no pide ni calcula con detectabilidad (NPR = S × O) */
  usarDetectabilidad: boolean;
  /** Umbrales por defecto (la org puede sobreescribirlos) */
  umbralNPRMedio: number;
  umbralNPRAlto: number;
  /** Severidad a partir de la cual el riesgo es automáticamente crítico */
  umbralSeveridadCritica: number;
  /** Catálogos para puntuación 1–10 */
  catalogoSeveridad: CatalogoItem[];
  catalogoOcurrencia: CatalogoItem[];
  catalogoDetectabilidad: CatalogoItem[];
  terminologia: NormaTerminologia;
  /** Código de formato base (encabezado de PDF) */
  codigoFormato: string;
  /** Color de branding (HSL token name de tailwind) */
  badgeVariant: "navy" | "cobalt" | "celeste";
  badgeLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos NOM-241 (FEUM / ISO 14971 — dispositivos médicos / fabricación)
// ─────────────────────────────────────────────────────────────────────────────

const SEVERIDAD_NOM241: CatalogoItem[] = [
  { valor: 1, etiqueta: "Despreciable", descripcion: "Sin efecto perceptible en producto o paciente." },
  { valor: 2, etiqueta: "Muy menor", descripcion: "Defecto cosmético, no afecta función." },
  { valor: 3, etiqueta: "Menor", descripcion: "Inconveniente leve, función no comprometida." },
  { valor: 4, etiqueta: "Muy bajo", descripcion: "Defecto notable, sin impacto clínico." },
  { valor: 5, etiqueta: "Bajo", descripcion: "Reproceso menor, sin riesgo a paciente." },
  { valor: 6, etiqueta: "Moderado", descripcion: "Producto fuera de especificación, requiere desviación." },
  { valor: 7, etiqueta: "Alto", descripcion: "Pérdida parcial de función, posible queja del cliente." },
  { valor: 8, etiqueta: "Muy alto", descripcion: "Pérdida total de función, sin riesgo de daño físico." },
  { valor: 9, etiqueta: "Peligroso con aviso", descripcion: "Riesgo de daño al paciente con detección previa." },
  { valor: 10, etiqueta: "Peligroso sin aviso", descripcion: "Daño grave o muerte sin detección previa." },
];

const OCURRENCIA_NOM241: CatalogoItem[] = [
  { valor: 1, etiqueta: "Improbable", descripcion: "< 1 en 1,000,000" },
  { valor: 2, etiqueta: "Remota", descripcion: "1 en 500,000" },
  { valor: 3, etiqueta: "Muy baja", descripcion: "1 en 100,000" },
  { valor: 4, etiqueta: "Baja", descripcion: "1 en 50,000" },
  { valor: 5, etiqueta: "Ocasional", descripcion: "1 en 10,000" },
  { valor: 6, etiqueta: "Moderada", descripcion: "1 en 1,000" },
  { valor: 7, etiqueta: "Frecuente", descripcion: "1 en 500" },
  { valor: 8, etiqueta: "Alta", descripcion: "1 en 100" },
  { valor: 9, etiqueta: "Muy alta", descripcion: "1 en 50" },
  { valor: 10, etiqueta: "Casi cierta", descripcion: "≥ 1 en 10" },
];

const DETECTABILIDAD_NOM241: CatalogoItem[] = [
  { valor: 1, etiqueta: "Casi cierta", descripcion: "Control automático detecta el 100%." },
  { valor: 2, etiqueta: "Muy alta", descripcion: "Detección por inspección estadística robusta." },
  { valor: 3, etiqueta: "Alta", descripcion: "Inspección manual con alta confiabilidad." },
  { valor: 4, etiqueta: "Moderadamente alta", descripcion: "Inspección visual sistemática." },
  { valor: 5, etiqueta: "Moderada", descripcion: "Inspección por muestreo." },
  { valor: 6, etiqueta: "Baja", descripcion: "Inspección esporádica." },
  { valor: 7, etiqueta: "Muy baja", descripcion: "Detección poco confiable." },
  { valor: 8, etiqueta: "Remota", descripcion: "Detección sólo en pruebas finales." },
  { valor: 9, etiqueta: "Muy remota", descripcion: "Detección improbable." },
  { valor: 10, etiqueta: "Casi imposible", descripcion: "No existe control de detección." },
];

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos NOM-059 (ICH Q9 — fabricación de medicamentos / GMP)
// ─────────────────────────────────────────────────────────────────────────────

const SEVERIDAD_NOM059: CatalogoItem[] = [
  { valor: 1, etiqueta: "Insignificante", descripcion: "Sin impacto en calidad ni en paciente." },
  { valor: 2, etiqueta: "Muy menor", descripcion: "Desviación documental menor." },
  { valor: 3, etiqueta: "Menor", descripcion: "Atributo no crítico fuera de especificación." },
  { valor: 4, etiqueta: "Bajo", descripcion: "Reproceso autorizado, sin afectación al paciente." },
  { valor: 5, etiqueta: "Moderado bajo", descripcion: "Lote requiere investigación, sin rechazo." },
  { valor: 6, etiqueta: "Moderado", descripcion: "Posible rechazo de lote, sin riesgo terapéutico." },
  { valor: 7, etiqueta: "Alto", descripcion: "Falla de potencia/pureza, posible recall." },
  { valor: 8, etiqueta: "Muy alto", descripcion: "Producto fuera de eficacia terapéutica." },
  { valor: 9, etiqueta: "Crítico con aviso", descripcion: "Daño al paciente con posibilidad de detección." },
  { valor: 10, etiqueta: "Crítico sin aviso", descripcion: "Reacción adversa grave o muerte sin detección." },
];

const OCURRENCIA_NOM059: CatalogoItem[] = [
  { valor: 1, etiqueta: "Improbable", descripcion: "Sin antecedentes históricos." },
  { valor: 2, etiqueta: "Remota", descripcion: "1 evento en > 100 lotes." },
  { valor: 3, etiqueta: "Muy baja", descripcion: "1 evento en 50–100 lotes." },
  { valor: 4, etiqueta: "Baja", descripcion: "1 evento en 20–50 lotes." },
  { valor: 5, etiqueta: "Ocasional", descripcion: "1 evento en 10–20 lotes." },
  { valor: 6, etiqueta: "Moderada", descripcion: "1 evento en 5–10 lotes." },
  { valor: 7, etiqueta: "Frecuente", descripcion: "1 evento en 2–5 lotes." },
  { valor: 8, etiqueta: "Alta", descripcion: "1 evento por lote." },
  { valor: 9, etiqueta: "Muy alta", descripcion: "Múltiples eventos por lote." },
  { valor: 10, etiqueta: "Casi cierta", descripcion: "Evento sistemático en cada lote." },
];

const DETECTABILIDAD_NOM059: CatalogoItem[] = [
  { valor: 1, etiqueta: "Casi cierta", descripcion: "PAT/in-line con detección en tiempo real." },
  { valor: 2, etiqueta: "Muy alta", descripcion: "Análisis instrumental validado al 100%." },
  { valor: 3, etiqueta: "Alta", descripcion: "Control de calidad por lote, métodos validados." },
  { valor: 4, etiqueta: "Moderadamente alta", descripcion: "Muestreo estadístico ampliado." },
  { valor: 5, etiqueta: "Moderada", descripcion: "Muestreo por nivel II AQL." },
  { valor: 6, etiqueta: "Baja", descripcion: "Inspección visual u organoléptica." },
  { valor: 7, etiqueta: "Muy baja", descripcion: "Detección sólo por queja del cliente." },
  { valor: 8, etiqueta: "Remota", descripcion: "Detección en farmacovigilancia." },
  { valor: 9, etiqueta: "Muy remota", descripcion: "Detección improbable antes del paciente." },
  { valor: 10, etiqueta: "Casi imposible", descripcion: "No existe control de detección." },
];

// ─────────────────────────────────────────────────────────────────────────────
// Configuraciones por norma
// ─────────────────────────────────────────────────────────────────────────────

export const NORMAS_CONFIG: Record<NormaKey, NormaConfig> = {
  "NOM-241": {
    key: "NOM-241",
    nombre: "NOM-241",
    nombreLargo: "NOM-241-SSA1-2025 — Buenas prácticas de fabricación de dispositivos médicos",
    metodologia: "AMEF",
    metodologiaNombre: "FEUM / ISO 14971",
    normasReferencia: ["ISO 14971:2019", "NOM-241-SSA1-2025"],
    usarDetectabilidad: true,
    umbralNPRMedio: 60,
    umbralNPRAlto: 150,
    umbralSeveridadCritica: 9,
    catalogoSeveridad: SEVERIDAD_NOM241,
    catalogoOcurrencia: OCURRENCIA_NOM241,
    catalogoDetectabilidad: DETECTABILIDAD_NOM241,
    terminologia: {
      beneficio: "Beneficio clínico",
      aprobadorFinal: "Responsable Sanitario",
      procesoEquipo: "Proceso / Equipo",
      objetoAnalisis: "Dispositivo médico",
      descripcionCorta: "Dispositivos médicos (ISO 14971 + NOM-241)",
      efectoDano: "Efecto / Daño potencial",
    },
    codigoFormato: "FOR-SGC-11-01",
    badgeVariant: "navy",
    badgeLabel: "ISO 14971",
  },
  "NOM-059": {
    key: "NOM-059",
    nombre: "NOM-059",
    nombreLargo: "NOM-059-SSA1-2015 — Buenas prácticas de fabricación de medicamentos",
    metodologia: "ICH-Q9",
    metodologiaNombre: "ICH Q9 — Quality Risk Management",
    normasReferencia: ["ICH Q9 (R1)", "NOM-059-SSA1-2015"],
    usarDetectabilidad: true,
    umbralNPRMedio: 60,
    umbralNPRAlto: 150,
    umbralSeveridadCritica: 9,
    catalogoSeveridad: SEVERIDAD_NOM059,
    catalogoOcurrencia: OCURRENCIA_NOM059,
    catalogoDetectabilidad: DETECTABILIDAD_NOM059,
    terminologia: {
      beneficio: "Beneficio terapéutico",
      aprobadorFinal: "Director Técnico",
      procesoEquipo: "Etapa de fabricación",
      objetoAnalisis: "Producto / Lote",
      descripcionCorta: "Medicamentos (ICH Q9 + NOM-059)",
      efectoDano: "Efecto sobre calidad / paciente",
    },
    codigoFormato: "FOR-SGC-11-02",
    badgeVariant: "cobalt",
    badgeLabel: "ICH Q9",
  },
  // MULTI hereda de NOM-241 por default; el folio individual define la norma real.
  MULTI: {
    key: "MULTI",
    nombre: "Multi-norma",
    nombreLargo: "Operación bajo NOM-241 y NOM-059",
    metodologia: "MULTI",
    metodologiaNombre: "FEUM / ISO 14971 + ICH Q9 (según folio)",
    normasReferencia: ["ISO 14971:2019", "NOM-241-SSA1-2025", "ICH Q9 (R1)", "NOM-059-SSA1-2015"],
    usarDetectabilidad: true,
    umbralNPRMedio: 60,
    umbralNPRAlto: 150,
    umbralSeveridadCritica: 9,
    catalogoSeveridad: SEVERIDAD_NOM241,
    catalogoOcurrencia: OCURRENCIA_NOM241,
    catalogoDetectabilidad: DETECTABILIDAD_NOM241,
    terminologia: {
      beneficio: "Beneficio clínico / terapéutico",
      aprobadorFinal: "Responsable Sanitario / Director Técnico",
      procesoEquipo: "Proceso / Etapa",
      objetoAnalisis: "Producto",
      descripcionCorta: "Dispositivos médicos y medicamentos",
      efectoDano: "Efecto / Daño potencial",
    },
    codigoFormato: "FOR-SGC-11-01",
    badgeVariant: "celeste",
    badgeLabel: "Multi",
  },
};

/**
 * Resuelve la configuración de norma a partir de un valor crudo (string de BD,
 * null/undefined). Siempre devuelve una config válida — fallback NOM-241.
 */
export function getNormaConfig(norma: string | null | undefined): NormaConfig {
  if (norma && (norma in NORMAS_CONFIG)) {
    return NORMAS_CONFIG[norma as NormaKey];
  }
  return NORMAS_CONFIG["NOM-241"];
}

/**
 * Calcula el NPR según la norma. Si la norma/folio no usa detectabilidad,
 * el NPR es S × O. Si la usa, S × O × D.
 */
export function calcularNPR(
  severidad: number,
  ocurrencia: number,
  detectabilidad: number,
  norma: string | null | undefined,
): number {
  const config = getNormaConfig(norma);
  return config.usarDetectabilidad
    ? severidad * ocurrencia * detectabilidad
    : severidad * ocurrencia;
}

/**
 * Devuelve el nivel de NPR (Crítico/Mayor/Menor) usando los umbrales de la
 * norma. La regla S ≥ umbralSeveridadCritica fuerza Crítico aunque NPR sea bajo.
 */
export function getNPRLevelByNorma(
  npr: number,
  severidad: number,
  norma: string | null | undefined,
): { label: "Crítico" | "Mayor" | "Menor"; color: string; dot: string } {
  const config = getNormaConfig(norma);
  if (severidad >= config.umbralSeveridadCritica || npr > config.umbralNPRAlto) {
    return { label: "Crítico", color: "npr-critical", dot: "🔴" };
  }
  if (npr >= config.umbralNPRMedio) {
    return { label: "Mayor", color: "npr-high", dot: "🟡" };
  }
  return { label: "Menor", color: "npr-low", dot: "🟢" };
}

/** Lista de normas seleccionables en registro (excluye duplicados internos). */
export const NORMAS_SELECCIONABLES: NormaKey[] = ["NOM-241", "NOM-059", "MULTI"];
