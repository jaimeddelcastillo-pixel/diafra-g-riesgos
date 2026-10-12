import {
  Home, Settings, ShieldCheck, LifeBuoy, Ticket, Library, Sparkles, GraduationCap, FileBadge,
  FileText, ClipboardCheck, Wrench, type LucideIcon,
} from "lucide-react";
import { modulos } from "@/modules";

export type NavSection = "inicio" | "modulos" | "empresa" | "admin";
export type NavStatus = "activo" | "beta" | "proximamente";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Ruta destino. Ausente en grupos con children. */
  route?: string;
  /** Coincidencia exacta de ruta (rutas raíz como "/", "/cerebro", "/admin"). */
  exact?: boolean;
  children?: NavItem[];
  section: NavSection;
  /** Clave de módulo (o feature) requerida: acceso de la empresa activa. */
  feature?: string;
  /** Oculta el ítem si la empresa SÍ tiene este módulo (evita duplicar una página compartida). */
  soloSinModulo?: string;
  /** Cualquiera de estos roles habilita el ítem. */
  roles?: string[];
  /** Planes que habilitan el ítem. */
  plans?: string[];
  status?: NavStatus;
  /** Atributo data-onboarding para el tour. */
  onboarding?: string;
  /** Tratamiento visual sutilmente distinto. */
  highlight?: boolean;
}

export const SECTION_LABELS: Record<NavSection, string> = {
  inicio: "",
  modulos: "Módulos",
  empresa: "",
  admin: "Administración",
};

export const SECTION_ORDER: NavSection[] = ["inicio", "modulos", "empresa", "admin"];

/** Inicio arriba, los grupos de módulos (en el orden recibido) y Configuración/Ayuda. */
export function construirNavegacion(gruposModulos: NavItem[]): NavItem[] {
  return [itemInicio, ...gruposModulos, ...navegacionEmpresa];
}

const itemInicio: NavItem = { id: "inicio", label: "Inicio", icon: Home, route: "/", exact: true, section: "inicio" };

/** De la empresa, no de un módulo. */
const navegacionEmpresa: NavItem[] = [
  { id: "configuracion", label: "Configuración", icon: Settings, route: "/configuracion", section: "empresa" },
  { id: "soporte", label: "Ayuda", icon: LifeBuoy, route: "/soporte", section: "empresa", roles: ["admin", "responsable_sanitario"] },
];

/** Navegación de organización (usuarios de cliente e impersonación). */
export const navigationConfig: NavItem[] = construirNavegacion(modulos.map((m) => m.menu));

/** Navegación del panel TRACEA (super admin sin impersonar). */
export const adminNavigationConfig: NavItem[] = [
  { id: "admin-panel", label: "Panel TRACEA", icon: ShieldCheck, route: "/admin", exact: true, section: "admin" },
  { id: "admin-tickets", label: "Tickets", icon: Ticket, route: "/admin/tickets", section: "admin" },
  { id: "admin-agentes", label: "Agentes IA", icon: Sparkles, route: "/admin/agentes-ia", section: "admin" },
  { id: "admin-protocolos", label: "Protocolos (addon)", icon: FileBadge, route: "/admin/protocolos", section: "admin" },
  { id: "admin-recursos", label: "Recursos públicos", icon: Library, route: "/admin/recursos", section: "admin" },
  { id: "admin-cursos", label: "Cursos", icon: GraduationCap, route: "/admin/cursos", section: "admin" },
  { id: "admin-dc3", label: "DC-3 pendientes", icon: ClipboardCheck, route: "/admin/dc3", section: "admin" },
  { id: "admin-folios", label: "Gestión de Folios", icon: FileText, route: "/admin/folios", section: "admin" },
  { id: "admin-reeditar", label: "Reeditar códigos", icon: Wrench, route: "/admin/super/reeditar-codigos", section: "admin" },
];
