export interface RiskEntry {
  id: string;
  peligro: string;
  modoFalla: string;
  efecto: string;
  severidad: number;
  ocurrencia: number;
  deteccion: number;
  npr: number;
  planAccion: string;
  controlImplementado: string;
  sevResidual: number;
  ocuResidual: number;
  detResidual: number;
  nprResidual: number;
}

export interface Folio {
  id: string;
  codigo: string;
  producto: string;
  estado: "Borrador" | "En Firma" | "Aprobado" | "Cerrado";
  creador: string;
  fechaCreacion: string;
  fechaCompromiso: string;
  riesgos: RiskEntry[];
}

export const mockFolios: Folio[] = [
  {
    id: "1",
    codigo: "GR-2025-001",
    producto: "Válvula Cardíaca Mecánica V-200",
    estado: "Borrador",
    creador: "Dr. García López",
    fechaCreacion: "2025-01-15",
    fechaCompromiso: "2025-04-15",
    riesgos: [
      { id: "R1", peligro: "Falla mecánica", modoFalla: "Fractura de disco", efecto: "Regurgitación severa", severidad: 10, ocurrencia: 3, deteccion: 4, npr: 120, planAccion: "Reforzar material del disco con aleación de titanio", controlImplementado: "Inspección ultrasónica 100%", sevResidual: 10, ocuResidual: 1, detResidual: 2, nprResidual: 20 },
      { id: "R2", peligro: "Biocompatibilidad", modoFalla: "Reacción alérgica al material", efecto: "Inflamación crónica", severidad: 7, ocurrencia: 2, deteccion: 5, npr: 70, planAccion: "", controlImplementado: "Pruebas de citotoxicidad ISO 10993", sevResidual: 7, ocuResidual: 1, detResidual: 3, nprResidual: 21 },
      { id: "R3", peligro: "Trombogenicidad", modoFalla: "Formación de coágulos", efecto: "Embolia", severidad: 10, ocurrencia: 4, deteccion: 5, npr: 200, planAccion: "Aplicar recubrimiento antitrombótico + protocolo anticoagulante", controlImplementado: "Test de hemocompatibilidad", sevResidual: 10, ocuResidual: 2, detResidual: 3, nprResidual: 60 },
    ],
  },
  {
    id: "2",
    codigo: "GR-2025-002",
    producto: "Bomba de Infusión BI-500",
    estado: "En Firma",
    creador: "Ing. Martínez R.",
    fechaCreacion: "2025-02-01",
    fechaCompromiso: "2025-05-01",
    riesgos: [
      { id: "R1", peligro: "Sobredosis", modoFalla: "Error en sensor de flujo", efecto: "Administración excesiva de medicamento", severidad: 9, ocurrencia: 3, deteccion: 3, npr: 81, planAccion: "Doble sensor de flujo redundante", controlImplementado: "Alarma de flujo libre", sevResidual: 9, ocuResidual: 1, detResidual: 2, nprResidual: 18 },
      { id: "R2", peligro: "Falla eléctrica", modoFalla: "Cortocircuito en PCB", efecto: "Paro de infusión", severidad: 8, ocurrencia: 2, deteccion: 4, npr: 64, planAccion: "", controlImplementado: "Fusibles y protección ESD", sevResidual: 8, ocuResidual: 1, detResidual: 2, nprResidual: 16 },
    ],
  },
  {
    id: "3",
    codigo: "GR-2025-003",
    producto: "Stent Coronario SC-300",
    estado: "Aprobado",
    creador: "Dra. Hernández P.",
    fechaCreacion: "2025-01-20",
    fechaCompromiso: "2025-03-20",
    riesgos: [
      { id: "R1", peligro: "Migración del stent", modoFalla: "Dimensionamiento incorrecto", efecto: "Obstrucción vascular", severidad: 9, ocurrencia: 3, deteccion: 4, npr: 108, planAccion: "Guía de selección de tamaño mejorada", controlImplementado: "Fluoroscopía intraoperatoria", sevResidual: 9, ocuResidual: 1, detResidual: 2, nprResidual: 18 },
    ],
  },
  {
    id: "4",
    codigo: "GR-2024-015",
    producto: "Monitor de Signos Vitales MSV-100",
    estado: "Cerrado",
    creador: "Ing. López T.",
    fechaCreacion: "2024-11-10",
    fechaCompromiso: "2025-02-10",
    riesgos: [
      { id: "R1", peligro: "Lectura errónea de SpO2", modoFalla: "Interferencia óptica", efecto: "Diagnóstico incorrecto", severidad: 8, ocurrencia: 4, deteccion: 3, npr: 96, planAccion: "Filtro óptico de banda estrecha", controlImplementado: "Calibración con simulador", sevResidual: 8, ocuResidual: 2, detResidual: 2, nprResidual: 32 },
      { id: "R2", peligro: "Alarma no audible", modoFalla: "Falla de speaker", efecto: "No detección de evento crítico", severidad: 10, ocurrencia: 2, deteccion: 3, npr: 60, planAccion: "", controlImplementado: "Speaker redundante + LED visual", sevResidual: 10, ocuResidual: 1, detResidual: 2, nprResidual: 20 },
    ],
  },
];

export function getNPRLevel(npr: number): { label: string; color: string } {
  if (npr <= 40) return { label: "Bajo", color: "npr-low" };
  if (npr <= 100) return { label: "Medio", color: "npr-medium" };
  if (npr <= 200) return { label: "Alto", color: "npr-high" };
  return { label: "Crítico", color: "npr-critical" };
}

export function getEstadoBadgeVariant(estado: Folio["estado"]) {
  switch (estado) {
    case "Borrador": return "secondary";
    case "En Firma": return "default";
    case "Aprobado": return "default";
    case "Cerrado": return "outline";
  }
}

export function getAllRisks(): RiskEntry[] {
  return mockFolios.flatMap((f) => f.riesgos);
}
