/**
 * Catálogo de planes y addons de TRACEA.
 * Los Price IDs corresponden a Stripe (modo TEST por ahora).
 */

export type PlanId = "starter" | "professional" | "enterprise";
export type AddonId = "curso" | "protocolos";

export interface Plan {
  id: PlanId;
  nombre: string;
  priceId: string;
  precio: string;
  periodo: string;
  descripcion: string;
  features: string[];
  destacado?: boolean;
}

export interface Addon {
  id: AddonId;
  nombre: string;
  priceId: string;
  precio: string;
  descripcion: string;
  features: string[];
  badge?: string;
  notaPie?: string;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    nombre: "Starter",
    priceId: "price_1TQ7jKKfwzAg4OKvxoc4fDOi",
    precio: "$85 USD",
    periodo: "/mes",
    descripcion: "Para equipos pequeños que inician su Sistema de Gestión de Riesgos bajo NOM-241-SSA1-2025.",
    features: [
      "Hasta 3 usuarios",
      "Folios ilimitados",
      "Matriz AMEF completa ISO 14971",
      "Firma electrónica NOM-241-SSA1-2025",
      "Checklist regulatorio integrado",
      "30 consultas al Asistente IA/mes",
      "Centro de Recursos TRACEA",
      "Soporte por correo",
    ],
  },
  {
    id: "professional",
    nombre: "Professional",
    priceId: "price_1TQ7jFKfwzAg4OKv51yn1CmC",
    precio: "$225 USD",
    periodo: "/mes",
    descripcion: "Para organizaciones que requieren mayor capacidad de usuarios y soporte prioritario.",
    features: [
      "Hasta 10 usuarios",
      "Todo lo incluido en Starter",
      "300 consultas al Asistente IA/mes",
      "Comité técnico ampliado",
      "Auditoría avanzada con trazabilidad completa",
      "1 sesión virtual de onboarding incluida",
      "Soporte prioritario",
    ],
    destacado: true,
  },
  {
    id: "enterprise",
    nombre: "Enterprise",
    priceId: "price_1TQ7jKKfwzAg4OKvjXcDjzgn",
    precio: "$475 USD",
    periodo: "/mes",
    descripcion: "Para empresas con múltiples sitios o líneas de producto que requieren escala regulatoria.",
    features: [
      "Usuarios ilimitados",
      "Todo lo incluido en Professional",
      "Asistente IA ilimitado",
      "Múltiples sitios o plantas",
      "Onboarding dedicado presencial o virtual",
      "SLA de disponibilidad garantizado",
      "Gestor de cuenta asignado",
    ],
  },
];

export const ADDONS: Addon[] = [
  {
    id: "curso",
    nombre: "Curso de Gestión de Riesgos NOM-241",
    priceId: "price_1TQ7kVKfwzAg4OKvjU9mVaun",
    precio: "$450 USD",
    descripcion:
      "Capacita y certifica a tu equipo en gestión de riesgos bajo NOM-241-SSA1-2025 e ISO 14971. Acceso completo a la plataforma por 30 días.",
    badge: "Incluye DC-3 oficial STPS",
    features: [
      "Hasta 3 usuarios incluidos",
      "30 días de acceso completo a la plataforma",
      "Manual técnico NOM-241-SSA1-2025 / ISO 14971",
      "Videos de capacitación",
      "Agente IA TRACEA Risk Manager",
      "Ejercicio práctico guiado",
      "Evaluación de conocimientos",
      "Constancia DC-3 por usuario",
      "PNO de referencia TRACEA",
      "Formato Proforma TRACEA",
    ],
    notaPie:
      "¿Necesitas más de 3 usuarios? DC-3 adicionales a $35 USD por usuario — Contáctanos: soporte@tracea.com.mx",
  },
  {
    id: "protocolos",
    nombre: "Protocolos de Validación DQ/IQ/OQ/PQ",
    priceId: "price_1TQ7lbKfwzAg4OKvwQwizz4f",
    precio: "$450 USD",
    descripcion:
      "Protocolos de calificación listos para ejecutar conforme a NOM-241-SSA1-2025 y expediente maestro COFEPRIS.",
    features: [
      "Protocolo DQ — Calificación de Diseño",
      "Protocolo IQ — Calificación de Instalación",
      "Protocolo OQ — Guía de Calificación Operacional",
      "Protocolo PQ — Guía de Calificación de Desempeño",
      "Formatos editables en Word",
      "Ejemplos de llenado incluidos",
    ],
    notaPie: "Disponible para clientes con suscripción activa",
  },
];

export function findPriceConfig(priceId: string):
  | { tipo: "plan"; item: Plan }
  | { tipo: "addon"; item: Addon }
  | null {
  const plan = PLANS.find((p) => p.priceId === priceId);
  if (plan) return { tipo: "plan", item: plan };
  const addon = ADDONS.find((a) => a.priceId === priceId);
  if (addon) return { tipo: "addon", item: addon };
  return null;
}