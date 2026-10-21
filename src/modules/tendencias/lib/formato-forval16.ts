// Plantilla del Word FOR-VAL-16-02: textos fijos (versionados en la tabla formato_forval16), firmantes y logo.
// Sintaxis de los textos: cada línea es un párrafo. "- " = inciso 1.1., "-- " = 1.1.1., "--- " = 1.1.1.1.
// Líneas sin guion = párrafo sin número. Variables: {sistema}, {periodo}, {areas}, {clases_iso}.


import { REFERENCIA_APENDICE_A, TABLA_APENDICE_A } from './apendice-a';
export interface Firmante { rol: string; nombre: string; cargo: string; user_id?: string }
export interface ElegiblesFirmantes { rol: 'Elaboró' | 'Revisó' | 'Autorizó'; user_ids: string[]; default_user_id?: string }
export type ClaveTexto = "s1" | "s3" | "s4" | "s5" | "s6" | "s7" | "s12" | "tablaClases";
export interface FormatoForVal16 {
  identidad?: { nombre: string; logoDescripcion: string; confidencialidad: string };
  version: number; version_formato: string; logo: string | null;
  firmantes: Firmante[]; textos: Record<ClaveTexto, string>;
  firmantes_elegibles?: ElegiblesFirmantes[];
  created_by_email?: string | null; created_at?: string;
}

export const SECCIONES_FIJAS: { k: ClaveTexto; titulo: string; ayuda?: string }[] = [
  { k: "s1", titulo: "1. Objetivo" },
  { k: "s3", titulo: "3. Generalidades", ayuda: "La tabla de especificaciones por clase ISO y la tabla de variables (PPC) se agregan solas al final de esta sección." },
  { k: "tablaClases", titulo: "3. Tabla de especificaciones por clase ISO", ayuda: "Una fila por línea, celdas separadas por «|». La primera línea es el encabezado. Solo se imprimen las clases presentes en el análisis." },
  { k: "s4", titulo: "4. Responsabilidades" },
  { k: "s5", titulo: "5. Abreviaturas, símbolos y definiciones" },
  { k: "s6", titulo: "6. Materiales, equipos e instrumentos" },
  { k: "s7", titulo: "7. Justificación" },
  { k: "s12", titulo: "12. Referencias bibliográficas" },
];

export const FORMATO_DEFAULT: FormatoForVal16 = {
  version: 0,
  version_formato: "Plantilla del reporte (00)",
  logo: null,
  firmantes: [],
  textos: {
    s1: "- Identificar patrones y tendencias en los datos de las variables de control de proceso (PPC) y atributos críticos de calidad (CQA´s) del {sistema} de la empresa {empresa}, para predecir y prevenir problemas potenciales, identificar áreas de mejora y reducir riesgos asociados en el desempeño del sistema crítico.",
    s3: [
      "- El sistema de Calefacción, Ventilación y Aire Acondicionado (HVAC) está compuesto por varios elementos que operan en conjunto para proporcionar las condiciones ambientales adecuadas a las áreas {areas}.",
      "El sistema HVAC debe cumplir con criterios de aceptación establecidos de forma normativa, conforme a la clasificación ({clases_iso}) y a las actividades que se ejecutan en cada una de las áreas.",
      "El sistema HVAC cuenta con diferentes instrumentos críticos instalados dentro de las áreas, en la unidad manejadora de aire o en un tablero, que monitorean las variables de presión diferencial, temperatura y % de humedad relativa.",
      "El análisis de tendencias de las variables de control de proceso (PPC) y atributos críticos de calidad (CQA´s) del sistema HVAC es fundamental para garantizar que el sistema opera de forma consistente y reproducible a lo largo del tiempo.",
    ].join("\n"),
    tablaClases: TABLA_APENDICE_A,
    s4: [
      "- Responsable Sanitario:",
      "-- Revisar y autorizar el presente análisis de tendencias.",
      "-- Dar seguimiento y cierre a la desviación o no conformidades derivadas del presente análisis de tendencias.",
      "- Director de operaciones:",
      "-- Revisar el presente análisis de tendencias.",
      "-- Dar seguimiento y cierre a las desviaciones y no conformidades derivadas de los respectivos análisis de tendencias.",
      "- Químico de Validación:",
      "-- Solicitar a las áreas correspondientes los datos cuantitativos generados a través del monitoreo del sistema HVAC.",
      "-- Realizar el correspondiente análisis de las variables de control de proceso (PPC) y los atributos críticos de calidad (CQA´s).",
      "-- En su defecto, solicitar análisis de tendencias generados por otros departamentos.",
      "-- Registrar y asignar un código al presente documento.",
      "-- Dar seguimiento y cierre a las desviaciones y no conformidades derivadas de los respectivos análisis de tendencias.",
      "- Químico Analista de Microbiología:",
      "-- Entregar información al departamento de validación, obtenida a través del monitoreo continuo de las variables de control de proceso (PPC).",
      "-- Realizar el análisis de tendencias.",
      "-- En caso de existir alguna variable fuera de especificación, avisar al Responsable Sanitario y/o Químico de Validación.",
      "-- Dar seguimiento y cierre a las desviaciones y no conformidades derivadas de los respectivos análisis de tendencias.",
      "- Supervisor de mantenimiento:",
      "-- Entregar información al departamento de validación, obtenida a través del monitoreo continuo de las variables de control de proceso (PPC).",
      "-- Dar seguimiento y cierre a las desviaciones y no conformidades derivadas de los respectivos análisis de tendencias.",
      "- Coordinador del Sistema de Gestión de Calidad / Auxiliar del Responsable Sanitario:",
      "-- Revisar el presente documento.",
      "-- Dar seguimiento y cierre a las desviaciones y no conformidades derivadas del respectivo análisis de tendencias.",
    ].join("\n"),
    s5: [
      "- Abreviaturas.",
      "-- FEUM: Farmacopea de los Estados Unidos Mexicanos.",
      "-- N.A.: No aplica.",
      "-- HVAC: Calefacción, ventilación y aire acondicionado.",
      "-- SGC: Sistema de Gestión de Calidad.",
      "-- LSE / LIE: Límite superior / inferior de especificación.",
      "-- LCS / LCI: Límite superior / inferior de control.",
      "-- LAS / LAI: Límite de alerta superior / inferior.",
      "-- LAcS / LAcI: Límite de acción superior / inferior.",
      "-- HR: Humedad relativa.",
      "- Símbolos.",
      "-- %: Porcentaje.",
      "-- °C: Grado Celsius.",
      "-- Pa: Pascal.",
      "-- X̄: Promedio de las lecturas de un día (subgrupo).",
      "-- X̄̄: Promedio de los promedios diarios.",
      "-- R / R̄: Rango del subgrupo / promedio de los rangos.",
      "-- MR̄: Promedio de los rangos móviles entre días.",
      "-- d₂, D₃, D₄: Constantes de las cartas de control.",
      "-- Pp / Ppk: Índices de desempeño del proceso (σ global).",
      "-- Cp / Cpk: Índices de capacidad del proceso (σ corto plazo).",
      "- Definiciones.",
      "-- Análisis de tendencias: técnica estadística y analítica que permite identificar patrones y tendencias en los datos a lo largo del tiempo.",
      "-- Capacidad de proceso: aptitud de un proceso para producir productos o servicios que cumplan con los requisitos de calidad especificados.",
      "-- Desviación o no conformidad: no cumplimiento de un requisito previamente establecido.",
      "-- Especificación: descripción de un material, sustancia o producto que incluye los parámetros de calidad, sus límites de aceptación y la referencia de los métodos a utilizar para su determinación.",
      "-- Límite de acción: indica que se ha excedido el umbral de tolerancia y se necesita una respuesta inmediata; requiere acciones correctivas.",
      "-- Límite de alerta: indica que algo está fuera de lo normal sin ser necesariamente crítico; requiere vigilancia y análisis.",
      "-- Sistemas críticos: aquellos que tienen impacto directo en los procesos y productos.",
    ].join("\n"),
    s6: "- Bitácoras.\n- Formatos.",
    s7: [
      "- El sistema HVAC que brinda servicio a las áreas {areas} representa un elemento de impacto en la seguridad, eficiencia y calidad de los dispositivos médicos y del personal usuario.",
      "El presente informe detalla, mediante el uso de gráficos de tendencias, el resultado del análisis de datos de variables de control de proceso (PPC) y atributos críticos de calidad (CQA´s) del {sistema} durante el periodo {periodo}.",
      "El presente análisis permite identificar desviaciones y activar acciones correctivas y preventivas para evitar fallos en las áreas clasificadas {clases_iso}.",
    ].join("\n"),
    s12: [
      `- ${REFERENCIA_APENDICE_A} «Buenas prácticas de fabricación», Apéndice A.`,
      "- Farmacopea de los Estados Unidos Mexicanos, edición vigente.",
      "- ISO 14644-2:2015. Cleanrooms and associated controlled environments — Part 2: Specifications for testing and monitoring to prove continued compliance with ISO 14644-1.",
      "- PNO-VAL-16 «Análisis de tendencias».",
    ].join("\n"),
  },
};

export function sustituir(t: string, v: Record<string, string>): string {
  return t.replace(/\{(empresa|sistema|periodo|areas|clases_iso)\}/g, (_, k) => v[k] ?? "");
}

/** Recuadro de firmas del Word: siempre ELABORÓ, REVISÓ y AUTORIZÓ, cada uno con nombre y cargo («Revisor» → «Revisó»). */
export const ROLES_FIRMA = ["Elaboró", "Revisó", "Autorizó"] as const;
export function firmantesReporte(firmantes: Firmante[]): Firmante[] {
  const clave = (r: string) => r.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const raiz = { "Elaboró": /^elabor/, "Revisó": /^revis/, "Autorizó": /^(autoriz|aprob)/ } as const;
  return ROLES_FIRMA.flatMap(rol => { const lista = firmantes.filter(x => raiz[rol].test(clave(x.rol ?? ""))); return lista.length ? lista.map(f => ({ ...f, rol })) : [{ rol, nombre: '', cargo: '' }]; });
}
