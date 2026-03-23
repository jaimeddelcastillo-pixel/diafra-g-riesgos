// FOR-SGC-11-01 Data Model — Archivo Maestro de Gestión de Riesgos

export type OrigenRiesgo = "Diseño" | "Proceso" | "Queja / Devolución" | "Desviación" | "Control de Cambios";
export type EstadoFolio = "Borrador" | "En Firma" | "Aprobado" | "Cerrado";
export type Dictamen = "Aceptable" | "No Aceptable" | "";

export interface ComiteMiembro {
  id: string;
  nombre: string;
  cargo: string;
  responsabilidad: string;
  firmado: boolean;
  fechaFirma?: string;
}

export interface RiskEntry {
  id: string;
  // 1. Identificación de Peligro y Falla
  etapaProceso: string;
  peligroModoFalla: string;
  causaPotencial: string;
  efectoDano: string;
  // 2. Evaluación Inicial
  severidad: number;
  ocurrencia: number;
  deteccion: number;
  npr: number;
  // 3. Controles y Gestión
  controlesActuales: string;
  requiereAccion: boolean;
  accionPropuesta: string;
  responsable: string;
  fechaCompromiso: string;
  // 4. Evaluación Final (Residual)
  accionImplementada: string;
  fechaEvidencia: string;
  sevResidual: number;
  ocuResidual: number;
  detResidual: number;
  nprResidual: number;
  dictamen: Dictamen;
}

export interface Folio {
  id: string;
  codigo: string;
  estado: EstadoFolio;
  // Sección I — Descripción
  procesoEquipo: string;
  origen: OrigenRiesgo;
  desviacionId: string;
  controlCambiosId: string;
  fechaInicio: string;
  fechaCierre: string;
  alcance: string;
  // Sección II — Comité
  comite: ComiteMiembro[];
  // Sección III — Riesgos
  riesgos: RiskEntry[];
}

// --- NPR Levels per FOR-SGC-11-01 ---
export function getNPRLevel(npr: number, severidad?: number): { label: string; color: string; dot: string } {
  if ((severidad !== undefined && severidad >= 9) || npr > 150)
    return { label: "Crítico", color: "npr-critical", dot: "🔴" };
  if (npr >= 60)
    return { label: "Mayor", color: "npr-high", dot: "🟡" };
  return { label: "Menor", color: "npr-low", dot: "🟢" };
}

export function getEstadoStyle(estado: EstadoFolio) {
  switch (estado) {
    case "Borrador": return "bg-secondary text-secondary-foreground";
    case "En Firma": return "bg-primary text-primary-foreground";
    case "Aprobado": return "bg-success text-success-foreground";
    case "Cerrado": return "bg-muted text-muted-foreground";
  }
}

// --- Mock Data ---
export const mockFolios: Folio[] = [
  {
    id: "1",
    codigo: "GR-2025-001",
    estado: "Borrador",
    procesoEquipo: "Válvula Cardíaca Mecánica V-200",
    origen: "Diseño",
    desviacionId: "",
    controlCambiosId: "",
    fechaInicio: "2025-01-15",
    fechaCierre: "",
    alcance: "Análisis de riesgos del diseño mecánico y biocompatibilidad de la válvula cardíaca modelo V-200",
    comite: [
      { id: "c1", nombre: "Dr. García López", cargo: "Responsable Sanitario", responsabilidad: "Aprobación Regulatoria y Dictamen de Beneficio-Riesgo.", firmado: false },
      { id: "c2", nombre: "Ing. Martínez R.", cargo: "Director de Operaciones", responsabilidad: "Validación de Recursos y Factibilidad Técnica. Dictamen de Beneficio-Riesgo.", firmado: false },
      { id: "c3", nombre: "Lic. Rodríguez S.", cargo: "Coordinador del SGC", responsabilidad: "Metodología y Seguimiento Documental.", firmado: false },
      { id: "c4", nombre: "Dra. Hernández P.", cargo: "Validaciones", responsabilidad: "Dictamen de Beneficio-Riesgo.", firmado: false },
      { id: "c5", nombre: "Ing. Torres M.", cargo: "Líder del Proyecto", responsabilidad: "Experto Técnico del Proceso/Producto.", firmado: false },
    ],
    riesgos: [
      {
        id: "01", etapaProceso: "Fabricación", peligroModoFalla: "Fractura de disco por fatiga mecánica",
        causaPotencial: "Material con impurezas o tratamiento térmico deficiente", efectoDano: "Regurgitación severa, riesgo de muerte",
        severidad: 10, ocurrencia: 3, deteccion: 4, npr: 120,
        controlesActuales: "Inspección visual de lote", requiereAccion: true,
        accionPropuesta: "Inspección ultrasónica 100% + cambio a aleación de titanio grado 5",
        responsable: "Ing. Torres M.", fechaCompromiso: "2025-04-15",
        accionImplementada: "", fechaEvidencia: "", sevResidual: 10, ocuResidual: 1, detResidual: 2, nprResidual: 20, dictamen: "",
      },
      {
        id: "02", etapaProceso: "Uso clínico", peligroModoFalla: "Formación de trombos en la superficie valvular",
        causaPotencial: "Rugosidad superficial del material o flujo turbulento", efectoDano: "Embolia cerebral o pulmonar",
        severidad: 10, ocurrencia: 4, deteccion: 5, npr: 200,
        controlesActuales: "Protocolo anticoagulante del paciente", requiereAccion: true,
        accionPropuesta: "Aplicar recubrimiento antitrombótico DLC + validación de hemocompatibilidad ISO 10993-4",
        responsable: "Dra. Hernández P.", fechaCompromiso: "2025-05-01",
        accionImplementada: "", fechaEvidencia: "", sevResidual: 10, ocuResidual: 2, detResidual: 3, nprResidual: 60, dictamen: "",
      },
      {
        id: "03", etapaProceso: "Implantación", peligroModoFalla: "Reacción alérgica al material de sutura",
        causaPotencial: "Sensibilidad del paciente a polímeros del anillo", efectoDano: "Inflamación crónica periprotésica",
        severidad: 7, ocurrencia: 2, deteccion: 5, npr: 70,
        controlesActuales: "Pruebas de citotoxicidad ISO 10993-5", requiereAccion: true,
        accionPropuesta: "Cambiar a sutura de PTFE expandido biocompatible",
        responsable: "Ing. Torres M.", fechaCompromiso: "2025-03-30",
        accionImplementada: "", fechaEvidencia: "", sevResidual: 7, ocuResidual: 1, detResidual: 3, nprResidual: 21, dictamen: "",
      },
    ],
  },
  {
    id: "2",
    codigo: "GR-2025-002",
    estado: "En Firma",
    procesoEquipo: "Bomba de Infusión BI-500",
    origen: "Proceso",
    desviacionId: "DES-2025-012",
    controlCambiosId: "",
    fechaInicio: "2025-02-01",
    fechaCierre: "",
    alcance: "Evaluación de riesgos del proceso de manufactura y funcionamiento de la bomba de infusión BI-500",
    comite: [
      { id: "c1", nombre: "Dr. García López", cargo: "Responsable Sanitario", responsabilidad: "Aprobación Regulatoria.", firmado: true, fechaFirma: "2025-03-10 14:30" },
      { id: "c2", nombre: "Ing. Martínez R.", cargo: "Director de Operaciones", responsabilidad: "Factibilidad Técnica.", firmado: true, fechaFirma: "2025-03-10 15:00" },
      { id: "c3", nombre: "Lic. Rodríguez S.", cargo: "Coordinador del SGC", responsabilidad: "Seguimiento Documental.", firmado: false },
    ],
    riesgos: [
      {
        id: "01", etapaProceso: "Operación", peligroModoFalla: "Error en sensor de flujo causa sobredosis",
        causaPotencial: "Descalibración del sensor piezo-eléctrico", efectoDano: "Administración excesiva de medicamento, shock",
        severidad: 9, ocurrencia: 3, deteccion: 3, npr: 81,
        controlesActuales: "Alarma de flujo libre", requiereAccion: true,
        accionPropuesta: "Implementar doble sensor de flujo redundante con validación cruzada",
        responsable: "Ing. Martínez R.", fechaCompromiso: "2025-05-15",
        accionImplementada: "Sensor redundante instalado y validado", fechaEvidencia: "2025-04-20 / REG-VAL-089",
        sevResidual: 9, ocuResidual: 1, detResidual: 2, nprResidual: 18, dictamen: "Aceptable",
      },
    ],
  },
  {
    id: "3",
    codigo: "GR-2025-003",
    estado: "Aprobado",
    procesoEquipo: "Stent Coronario SC-300",
    origen: "Queja / Devolución",
    desviacionId: "",
    controlCambiosId: "CC-2025-005",
    fechaInicio: "2025-01-20",
    fechaCierre: "2025-03-20",
    alcance: "Análisis de riesgo derivado de queja de cliente por migración del stent",
    comite: [
      { id: "c1", nombre: "Dra. Hernández P.", cargo: "Responsable Sanitario", responsabilidad: "Dictamen de Beneficio-Riesgo.", firmado: true, fechaFirma: "2025-03-15 10:00" },
      { id: "c2", nombre: "Ing. Torres M.", cargo: "Líder del Proyecto", responsabilidad: "Experto Técnico.", firmado: true, fechaFirma: "2025-03-15 10:30" },
    ],
    riesgos: [
      {
        id: "01", etapaProceso: "Implantación", peligroModoFalla: "Migración del stent por dimensionamiento incorrecto",
        causaPotencial: "Guía de selección de tamaño ambigua para el cardiólogo", efectoDano: "Obstrucción vascular distal",
        severidad: 9, ocurrencia: 3, deteccion: 4, npr: 108,
        controlesActuales: "Fluoroscopía intraoperatoria", requiereAccion: true,
        accionPropuesta: "Guía visual de selección de tamaño mejorada con tabla de referencia anatómica",
        responsable: "Dra. Hernández P.", fechaCompromiso: "2025-03-10",
        accionImplementada: "Guía publicada Rev.02, capacitación completada", fechaEvidencia: "2025-03-08 / CAP-2025-045",
        sevResidual: 9, ocuResidual: 1, detResidual: 2, nprResidual: 18, dictamen: "Aceptable",
      },
    ],
  },
];

export function getAllRisks() {
  return mockFolios.flatMap((f) => f.riesgos);
}
