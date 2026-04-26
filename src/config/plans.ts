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
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    nombre: "Starter",
    priceId: "STRIPE_STARTER_PRICE_ID",
    precio: "$85 USD",
    periodo: "/mes",
    descripcion: "Ideal para equipos pequeños iniciando con gestión de riesgos.",
    features: [
      "Hasta 5 usuarios",
      "Folios ilimitados",
      "Matriz AMEF completa",
      "Firma electrónica",
      "Soporte por correo",
    ],
  },
  {
    id: "professional",
    nombre: "Professional",
    priceId: "STRIPE_PROFESSIONAL_PRICE_ID",
    precio: "$225 USD",
    periodo: "/mes",
    descripcion: "Para organizaciones que necesitan mayor capacidad y soporte.",
    features: [
      "Hasta 25 usuarios",
      "Folios ilimitados",
      "Comité técnico ampliado",
      "Auditoría avanzada",
      "Soporte prioritario",
    ],
    destacado: true,
  },
  {
    id: "enterprise",
    nombre: "Enterprise",
    priceId: "STRIPE_ENTERPRISE_PRICE_ID",
    precio: "$475 USD",
    periodo: "/mes",
    descripcion: "Para empresas con múltiples sitios y requerimientos avanzados.",
    features: [
      "Usuarios ilimitados",
      "Multi-sitio",
      "SSO / SAML",
      "Onboarding dedicado",
      "SLA garantizado",
    ],
  },
];

export const ADDONS: Addon[] = [
  {
    id: "curso",
    nombre: "Curso de Capacitación",
    priceId: "STRIPE_CURSO_PRICE_ID",
    precio: "$450 USD",
    descripcion: "Capacitación en gestión de riesgos FEUM / ISO 14971 y NOM-241-SSA1-2025.",
    features: [
      "Acceso 12 meses",
      "Certificado al finalizar",
      "Material descargable",
    ],
  },
  {
    id: "protocolos",
    nombre: "Pack de Protocolos",
    priceId: "STRIPE_PROTOCOLOS_PRICE_ID",
    precio: "$450 USD",
    descripcion: "Plantillas de protocolos validados listos para usar.",
    features: [
      "20+ plantillas editables",
      "Casos de uso reales",
      "Actualizaciones por 1 año",
    ],
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