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
// Catálogos NOM-241 y FEUM (dispositivos médicos / fabricación)
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
// Catálogos NOM-059 y FEUM (fabricación de medicamentos / GMP)
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
    metodologiaNombre: "Gestión de Riesgos NOM-241 y FEUM",
    normasReferencia: ["NOM-241-SSA1-2025", "FEUM"],
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
      descripcionCorta: "Dispositivos médicos (NOM-241 y FEUM)",
      efectoDano: "Efecto / Daño potencial",
    },
    codigoFormato: "FOR-SGC-11-01",
    badgeVariant: "navy",
    badgeLabel: "NOM-241",
  },
  "NOM-059": {
    key: "NOM-059",
    nombre: "NOM-059",
    nombreLargo: "NOM-059-SSA1-2015 — Buenas prácticas de fabricación de medicamentos",
    metodologia: "ICH-Q9",
    metodologiaNombre: "Gestión de Riesgos NOM-059 y FEUM",
    normasReferencia: ["NOM-059-SSA1-2015", "FEUM"],
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
      descripcionCorta: "Medicamentos (NOM-059 y FEUM)",
      efectoDano: "Efecto sobre calidad / paciente",
    },
    codigoFormato: "FOR-SGC-11-02",
    badgeVariant: "cobalt",
    badgeLabel: "NOM-059",
  },
  // MULTI hereda de NOM-241 por default; el folio individual define la norma real.
  MULTI: {
    key: "MULTI",
    nombre: "Multi-norma",
    nombreLargo: "Operación bajo NOM-241 y NOM-059",
    metodologia: "MULTI",
    metodologiaNombre: "Gestión de Riesgos COFEPRIS (NOM-241 y NOM-059)",
    normasReferencia: ["NOM-241-SSA1-2025", "NOM-059-SSA1-2015", "FEUM"],
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

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos de clasificación (Sección I del folio)
// ─────────────────────────────────────────────────────────────────────────────

/** Clasificación de dispositivo médico (NOM-241 / COFEPRIS). */
export const CLASIFICACION_DM: { valor: string; etiqueta: string }[] = [
  { valor: "Clase I", etiqueta: "Clase I — Bajo riesgo" },
  { valor: "Clase II", etiqueta: "Clase II — Riesgo moderado" },
  { valor: "Clase III", etiqueta: "Clase III — Alto riesgo" },
];

/** Tipo de medicamento (NOM-059 / COFEPRIS). */
export const CLASIFICACION_MED_TIPO: { valor: string; etiqueta: string }[] = [
  { valor: "Alopático", etiqueta: "Alopático" },
  { valor: "Biológico/biotecnológico", etiqueta: "Biológico o biotecnológico" },
  { valor: "Genérico intercambiable", etiqueta: "Genérico intercambiable" },
  { valor: "OTC", etiqueta: "OTC — Sin receta" },
  { valor: "Homeopático", etiqueta: "Homeopático" },
  { valor: "Herbolario", etiqueta: "Herbolario / Fitoterapéutico" },
];

/** Condición de venta del medicamento. */
export const CLASIFICACION_MED_VENTA: { valor: string; etiqueta: string }[] = [
  { valor: "Prescripción obligatoria", etiqueta: "Prescripción médica obligatoria" },
  { valor: "OTC", etiqueta: "Venta sin receta (OTC)" },
  { valor: "OTC con leyenda", etiqueta: "Venta sin receta con leyenda preventiva" },
];

/** Nivel de riesgo sanitario del medicamento. */
export const CLASIFICACION_MED_RIESGO: { valor: string; etiqueta: string }[] = [
  { valor: "Alto", etiqueta: "Alto — Inyectable / Biológico / Oncológico" },
  { valor: "Moderado", etiqueta: "Moderado — Sólido oral con prescripción" },
  { valor: "Bajo", etiqueta: "Bajo — OTC tópico / Vitaminas / Suplementos" },
];

export type ClasificacionMode = "dm" | "med";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de orígenes del análisis de riesgo (agrupado por sección)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrigenGroup {
  /** Título visible no seleccionable */
  titulo: string;
  /** Opciones del grupo */
  opciones: string[];
}

/** Grupos comunes a todas las normas. */
const ORIGENES_COMUNES: OrigenGroup[] = [
  {
    titulo: "Desarrollo / Diseño",
    opciones: [
      "Diseño y Desarrollo",
      "Transferencia de Tecnología",
      "Validación de Proceso",
      "Escalamiento",
    ],
  },
  {
    titulo: "Operación / Proceso",
    opciones: [
      "Fabricación",
      "Acondicionamiento",
      "Limpieza y Sanitización",
      "Sistema Crítico / Utilidades",
      "Almacenamiento y Distribución",
      "Laboratorio / Control de Calidad",
    ],
  },
  {
    titulo: "Sistema de Calidad",
    opciones: [
      "Desviación",
      "CAPA",
      "Control de Cambios",
      "Auditoría / Hallazgo Regulatorio",
      "Revisión Periódica",
    ],
  },
  {
    titulo: "Proveedores",
    opciones: [
      "Proveedor / Materia Prima",
      "Material de Empaque",
      "Fabricante Externo / Servicio Crítico",
    ],
  },
];

const ORIGENES_OTROS: OrigenGroup = {
  titulo: "Otros",
  opciones: [
    "Mejora Continua",
    "Revisión de Riesgo Residual",
    "Otro",
  ],
};

/** Postmercado para dispositivos médicos (NOM-241). */
const ORIGENES_POSTMERCADO_DM: OrigenGroup = {
  titulo: "Postmercado (Dispositivos Médicos)",
  opciones: [
    "Queja / Devolución",
    "Tecnovigilancia",
    "Retiro de Producto / Recall",
    "ACSC",
    "Evento Adverso",
    "Tendencia / Recurrente",
    "Producto Falsificado",
  ],
};

/** Postmercado para medicamentos (NOM-059). */
const ORIGENES_POSTMERCADO_MED: OrigenGroup = {
  titulo: "Postmercado (Medicamentos)",
  opciones: [
    "Queja de Mercado",
    "Farmacovigilancia",
    "OOS / OOT",
    "Retiro de Producto / Recall",
    "Evento Adverso",
    "Tendencia / Recurrente",
    "Producto Falsificado",
  ],
};

/**
 * Devuelve los grupos de orígenes aplicables a la norma de la organización.
 * - NOM-241 → comunes + postmercado DM + otros
 * - NOM-059 → comunes + postmercado Med + otros
 * - MULTI   → comunes + ambos postmercados + otros
 */
export function getOrigenesGrupos(norma: string | null | undefined): OrigenGroup[] {
  const cfg = getNormaConfig(norma);
  const postmercado: OrigenGroup[] =
    cfg.key === "NOM-241"
      ? [ORIGENES_POSTMERCADO_DM]
      : cfg.key === "NOM-059"
        ? [ORIGENES_POSTMERCADO_MED]
        : [ORIGENES_POSTMERCADO_DM, ORIGENES_POSTMERCADO_MED];
  return [...ORIGENES_COMUNES, ...postmercado, ORIGENES_OTROS];
}

/** Lista plana de todos los orígenes válidos para la norma. */
export function getOrigenesValidos(norma: string | null | undefined): string[] {
  return getOrigenesGrupos(norma).flatMap((g) => g.opciones);
}

/**
 * Determina si la sección de clasificación debe mostrar el bloque de
 * dispositivo médico ("dm") o de medicamento ("med").
 * - NOM-241 → siempre "dm".
 * - NOM-059 → siempre "med".
 * - MULTI → según `categoria` ("dispositivo" | "medicamento"). Si está vacía,
 *   devuelve "dm" como default neutro (la UI debe forzar al usuario a elegir).
 */
export function getClasificacionMode(
  norma: string | null | undefined,
  categoria: string | null | undefined,
): ClasificacionMode {
  const cfg = getNormaConfig(norma);
  if (cfg.key === "NOM-241") return "dm";
  if (cfg.key === "NOM-059") return "med";
  return categoria === "medicamento" ? "med" : "dm";
}

/**
 * Indica si una clasificación implica población vulnerable / alto riesgo
 * sanitario, lo que el agente IA debe usar para sugerir S+1 cuando S≥9.
 */
export function esClasificacionAltoRiesgo(
  tipo: string | null | undefined,
  riesgoSanitario: string | null | undefined,
): boolean {
  if (riesgoSanitario === "Alto") return true;
  if (tipo === "Biológico/biotecnológico") return true;
  return false;
}
