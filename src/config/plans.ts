/**
 * Catálogo de planes y addons de TRACEA.
 * Los Price IDs corresponden a Stripe (modo TEST por ahora).
 */

export type PlanId = "starter" | "professional" | "enterprise";
export type AddonId = "curso" | "protocolos" | "consultas_ia_100";

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
  precioAnterior?: string;
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
    descripcion: "Para equipos pequeños que inician su Sistema de Gestión de Riesgos conforme a NOM-241 y FEUM (dispositivos médicos) o NOM-059 y FEUM (medicamentos).",
    features: [
      "Hasta 3 usuarios",
      "Folios ilimitados",
      "Matriz de Gestión de Riesgos NOM-241 y FEUM o NOM-059 y FEUM",
      "Soporte multi-norma: NOM-241 y NOM-059",
      "Firma electrónica conforme a 21 CFR Part 11",
      "Checklist regulatorio adaptado a tu norma",
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
    descripcion: "Para empresas con múltiples sitios, líneas de producto o que operan bajo NOM-241 y NOM-059 simultáneamente.",
    features: [
      "Usuarios ilimitados",
      "Todo lo incluido en Professional",
      "Asistente IA ilimitado",
      "Múltiples sitios o plantas (modo multi-norma)",
      "Onboarding dedicado presencial o virtual",
      "SLA de disponibilidad garantizado",
      "Gestor de cuenta asignado",
    ],
  },
];

export const ADDONS: Addon[] = [
  {
    id: "curso",
    nombre: "Curso + DC-3 + 1 Mes TRACEA",
    priceId: "price_1TQ7kVKfwzAg4OKvjU9mVaun",
    precio: "$85 USD",
    precioAnterior: "$150 USD",
    descripcion:
      "Certifícate en Gestión de Riesgos NOM-241 o NOM-059 con constancia DC-3 oficial STPS y prueba TRACEA 1 mes completo con hasta 3 usuarios. Incluye curso, evaluación, 1 DC-3 (extras $35 USD) y acceso Starter. Sin compromiso. Precio de lanzamiento — primeros 20 clientes.",
    badge: "Lanzamiento — primeros 20 clientes",
    features: [
      "Curso completo NOM-241 o NOM-059",
      "Evaluación final con 20 preguntas",
      "1 Constancia DC-3 oficial STPS",
      "1 mes de acceso plan Starter (hasta 3 usuarios)",
      "Guías técnicas descargables",
      "DC-3 adicionales: $35 USD por usuario",
    ],
    notaPie:
      "DC-3 adicionales a $35 USD por usuario — soporte@tracea.com.mx",
  },
  {
    id: "protocolos",
    nombre: "Protocolos de Validación DQ/IQ/OQ/PQ",
    priceId: "price_1TQ7lbKfwzAg4OKvwQwizz4f",
    precio: "$450 USD",
    descripcion:
      "Protocolos de calificación listos para ejecutar conforme a NOM-241 / NOM-059 y expediente maestro COFEPRIS.",
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

/**
 * Pack de Consultas IA — pago único que suma al límite mensual del plan.
 * IMPORTANTE: el `priceId` debe reemplazarse por el real de Stripe en cuanto el cliente lo provea.
 */
export const CONSULTAS_IA_PACK: Addon = {
  id: "consultas_ia_100",
  nombre: "Pack 100 consultas IA",
  priceId: "price_1Teja1KfwzAg4OKvi5O0sjgh",
  precio: "$15 USD",
  descripcion:
    "Se suman a tu límite mensual actual. No caducan hasta ser usadas.",
  features: [
    "+100 consultas al Asistente IA",
    "Se suman al cupo de tu plan",
    "Se consumen después del cupo mensual",
    "No caducan",
    "Pago único, sin renovación",
  ],
};
export const CONSULTAS_POR_PACK = 100;

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