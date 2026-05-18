/**
 * Contenido textual del Wizard de IDs de riesgo, adaptado por norma.
 * Fuente única de verdad para chips, descripciones de sliders, ayudas y
 * fundamentos normativos.
 */
import type { NormaKey } from "@/config/normas";

type NormaWizardKey = "NOM-241" | "NOM-059";

function normalizaNorma(n: string | null | undefined): NormaWizardKey {
  return n === "NOM-059" ? "NOM-059" : "NOM-241";
}

// ── Ejemplos de peligros (chips Paso 1) ──────────────────────────────────────
const EJEMPLOS_PELIGROS: Record<NormaWizardKey, string[]> = {
  "NOM-241": [
    "Contaminación microbiológica",
    "Partícula física",
    "Residuo químico",
    "Falla mecánica",
    "Biocompatibilidad",
    "Interferencia eléctrica (EMI)",
    "Error de uso / Ergonómico",
    "Error documental",
  ],
  "NOM-059": [
    "Contaminación cruzada de API",
    "Degradación del principio activo",
    "Contaminación microbiológica",
    "Error de dosificación",
    "Mix-up de materiales o etiquetas",
    "Partículas subvisibles",
    "OOS / OOT en parámetro crítico",
    "Error humano en pesada",
  ],
};

export function getEjemplosPeligros(norma: string | null | undefined): string[] {
  return EJEMPLOS_PELIGROS[normalizaNorma(norma)];
}

// ── Chips de pasos sugeridos (Paso 2) ────────────────────────────────────────
const PASOS_SUGERIDOS: Record<NormaWizardKey, string[]> = {
  "NOM-241": [
    "Control de calidad no detecta",
    "PNO no ejecutado correctamente",
    "Equipo fuera de calibración",
    "Limpieza incompleta o no verificada",
    "Material liberado sin aprobación",
    "Barrera física comprometida",
  ],
  "NOM-059": [
    "CPP fuera de rango validado",
    "CQA no cumple especificación",
    "IPC no detecta la desviación",
    "Lote liberado con OOS no investigado",
    "Análisis de tendencia (OOT) ignorado",
    "Farmacovigilancia no reportada oportunamente",
  ],
};

export function getPasosSugeridos(norma: string | null | undefined): string[] {
  return PASOS_SUGERIDOS[normalizaNorma(norma)];
}

// ── Ayudas adaptativas Paso 2 ────────────────────────────────────────────────
export function getAyudasPaso2(norma: string | null | undefined): {
  secuencia: string;
  situacionPlaceholder: string;
  situacionAyuda: string;
  efectoAyuda: string;
} {
  const n = normalizaNorma(norma);
  if (n === "NOM-059") {
    return {
      secuencia:
        "Piensa en la cadena farmacéutica: ¿qué parámetro crítico (CPP) o atributo de calidad (CQA) falla? ¿cómo avanza hasta el paciente sin ser detectado?",
      situacionAyuda: "¿En qué momento el medicamento fuera de especificación llega al paciente?",
      situacionPlaceholder:
        "Ej: Paciente oncológico recibe dosis IV con contaminación microbiológica no detectada en liberación del lote",
      efectoAyuda:
        "Considera la vía de administración y la población. IV en oncología = mayor severidad que oral en adulto sano. Incluye: efecto farmacológico no deseado, interacción, falla terapéutica o evento adverso grave.",
    };
  }
  return {
    secuencia:
      "Piensa en la cadena de fallos: ¿qué barrera falla primero? ¿cómo avanza el peligro por el proceso? ¿en qué momento contacta el producto o el paciente?",
    situacionAyuda: "¿En qué momento exacto el peligro toca el dispositivo médico o al paciente?",
    situacionPlaceholder:
      "Ej: Durante la implantación del dispositivo en paciente sin detección previa del defecto",
    efectoAyuda:
      "Describe la consecuencia clínica en el paciente. Considera: tipo de lesión, reversibilidad, necesidad de intervención médica.",
  };
}

// ── Descripciones dinámicas de Severidad (Paso 3) ────────────────────────────
const SEVERIDAD_TXT: Record<NormaWizardKey, Record<number, string>> = {
  "NOM-241": {
    10: "Muerte del paciente / Recall Clase I / Clausura de planta",
    9: "Lesión permanente / Recall Clase II",
    8: "Lesión grave / Intervención quirúrgica / Multa COFEPRIS",
    7: "Lesión temporal / Atención médica / Retención de lote",
    6: "Molestia menor / Reproceso",
    5: "Molestia menor / Incomodidad sin lesión",
    4: "Efecto insignificante",
    3: "Efecto insignificante",
    2: "Sin efecto perceptible",
    1: "Sin efecto perceptible",
  },
  "NOM-059": {
    10: "Muerte del paciente / Retiro del mercado / Clausura de planta",
    9: "Daño permanente / Hospitalización grave / Suspensión de registro",
    8: "Daño reversible grave / Hospitalización / Multa mayor COFEPRIS",
    7: "Daño reversible moderado / Retención de lote completo",
    6: "Efecto adverso leve / Reproceso de lote",
    5: "Efecto adverso leve / Destrucción de lote",
    4: "Efecto mínimo sin consecuencias clínicas",
    3: "Efecto mínimo sin consecuencias clínicas",
    2: "Sin efecto clínico perceptible",
    1: "Sin efecto clínico perceptible",
  },
};

export function getSeveridadTxt(norma: string | null | undefined, v: number): string {
  return SEVERIDAD_TXT[normalizaNorma(norma)][v] ?? "";
}

// ── Descripciones de Ocurrencia y Detectabilidad (comunes) ───────────────────
const OCURRENCIA_TXT: Record<number, string> = {
  10: "Muy frecuente — más del 50% de lotes",
  9: "Casi siempre — 1 de cada 3 lotes",
  8: "Recurrente — ocurre semanalmente",
  7: "Frecuente — ocurre mensualmente",
  6: "Ocasional — cada 6 meses",
  5: "Ocasional — cada 6 meses",
  4: "Aislada — aproximadamente 1 vez al año",
  3: "Aislada — aproximadamente 1 vez al año",
  2: "Rara vez — históricamente no presentado",
  1: "Rara vez — históricamente no presentado",
};

const DETECTABILIDAD_TXT: Record<number, string> = {
  10: "Sin control — indetectable hasta el uso",
  9: "Controles erráticos",
  8: "Inspección visual manual",
  7: "Inspección visual manual",
  6: "Muestreo estadístico / SPC",
  5: "Muestreo estadístico / SPC",
  4: "Detección automatizada / Poka-yoke",
  3: "Detección automatizada / Poka-yoke",
  2: "Prevención automática por diseño",
  1: "Prevención automática por diseño",
};

export const getOcurrenciaTxt = (v: number) => OCURRENCIA_TXT[v] ?? "";
export const getDetectabilidadTxt = (v: number) => DETECTABILIDAD_TXT[v] ?? "";

// ── Ayudas de controles (Paso 4) ─────────────────────────────────────────────
export function getAyudasControles(norma: string | null | undefined): {
  prevencion: string;
  deteccion: string;
} {
  const n = normalizaNorma(norma);
  if (n === "NOM-059") {
    return {
      prevencion:
        "Ej: Sistema CIP/SIP validado, aislador, control de CPPs en línea, QbD ICH Q8, validación ICH Q7",
      deteccion:
        "Ej: IPC con HPLC, muestreo uniformidad contenido, análisis de tendencias PQR, hisopado validado",
    };
  }
  return {
    prevencion:
      "Ej: Validación de proceso, interlock, alarma, control en línea, calificación IQ/OQ/PQ, ISO 11135",
    deteccion: "Ej: Inspección visual 100%, muestreo AQL, pruebas ISO 10993, auditoría de PNO",
  };
}

// ── Fundamento normativo (Paso 5) ────────────────────────────────────────────
export function getFundamentoNormativo(norma: string | null | undefined): string {
  const n = normalizaNorma(norma);
  if (n === "NOM-059") return "Requerido por NOM-059 y FEUM para tu expediente COFEPRIS";
  return "Requerido por NOM-241 y FEUM para tu expediente COFEPRIS";
}

// ── Población vulnerable (NOM-059 únicamente, S ≥ 8) ─────────────────────────
export const POBLACIONES_VULNERABLES = [
  { valor: "general", etiqueta: "Población general", vulnerable: false },
  { valor: "oncologica", etiqueta: "Oncológica", vulnerable: true },
  { valor: "pediatrica", etiqueta: "Pediátrica", vulnerable: true },
  { valor: "inmunodeprimida", etiqueta: "Inmunodeprimida", vulnerable: true },
  { valor: "geriatrica", etiqueta: "Geriátrica", vulnerable: true },
];

export type WizardNorma = NormaKey;

// ── Ishikawa 6M — ejemplos por categoría y norma ──────────────────────────────
export type Categoria6M =
  | "mano_obra"
  | "maquina"
  | "metodo"
  | "material"
  | "medio_ambiente"
  | "medicion";

export const CATEGORIAS_6M: Array<{
  key: Categoria6M;
  titulo: string;
  pregunta: string;
}> = [
  {
    key: "mano_obra",
    titulo: "Mano de obra",
    pregunta: "¿Qué factores humanos pueden contribuir?",
  },
  {
    key: "maquina",
    titulo: "Máquina",
    pregunta: "¿Qué fallas de equipo pueden contribuir?",
  },
  {
    key: "metodo",
    titulo: "Método",
    pregunta: "¿Qué problemas de proceso o procedimiento?",
  },
  {
    key: "material",
    titulo: "Material",
    pregunta: "¿Qué factores de materiales o insumos?",
  },
  {
    key: "medio_ambiente",
    titulo: "Medio ambiente",
    pregunta: "¿Qué condiciones ambientales pueden influir?",
  },
  {
    key: "medicion",
    titulo: "Medición",
    pregunta: "¿Qué problemas de medición o detección?",
  },
];

const EJEMPLOS_6M: Record<NormaWizardKey, Record<Categoria6M, string[]>> = {
  "NOM-241": {
    mano_obra: [
      "Capacitación insuficiente del operador",
      "Fatiga por jornadas extendidas",
      "Alta rotación de personal",
      "Error en transcripción de registro",
    ],
    maquina: [
      "Calibración vencida",
      "Desgaste mecánico no detectado",
      "Falla de sensor crítico",
      "Interferencia electromagnética (EMI)",
    ],
    metodo: [
      "PNO desactualizado",
      "Instrucción ambigua",
      "Falta de verificación doble",
      "Validación de proceso vencida",
    ],
    material: [
      "Lixiviables del envase",
      "Material no calificado",
      "Cambio de proveedor sin evaluación",
      "Lote fuera de especificación",
    ],
    medio_ambiente: [
      "Temperatura fuera de rango",
      "Humedad relativa elevada",
      "Clasificación de área comprometida",
      "Iluminación insuficiente",
    ],
    medicion: [
      "Instrumento sin calibración trazable",
      "Método de inspección subjetivo",
      "Muestreo insuficiente",
      "Criterio de aceptación poco claro",
    ],
  },
  "NOM-059": {
    mano_obra: [
      "Error en pesada de API",
      "Cálculo incorrecto de dosis",
      "Omisión de paso en BPR",
      "Falta de calificación del analista",
    ],
    maquina: [
      "Temporizador descalibrado",
      "Mezclador fuera de velocidad validada",
      "Falla de CIP/SIP",
      "HVAC fuera de parámetros",
    ],
    metodo: [
      "CPP no definido",
      "Validación de proceso vencida",
      "Método analítico no transferido",
      "Cambio sin control de cambios",
    ],
    material: [
      "API fuera de especificación",
      "Excipiente con variabilidad de lote",
      "Contaminación cruzada",
      "Material caducado",
    ],
    medio_ambiente: [
      "Presión diferencial negativa",
      "HR fuera de límite",
      "Temperatura de almacén fuera de rango",
      "Conteo de partículas elevado",
    ],
    medicion: [
      "Método analítico no validado",
      "OOT no detectado",
      "Límites de especificación incorrectos",
      "Sistema cromatográfico sin SST",
    ],
  },
};

export function getEjemplos6M(
  norma: string | null | undefined,
): Record<Categoria6M, string[]> {
  return EJEMPLOS_6M[normalizaNorma(norma)];
}

export function getNormaLabel(norma: string | null | undefined): string {
  return normalizaNorma(norma);
}
