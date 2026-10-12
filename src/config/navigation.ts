import {
  LayoutDashboard, FolderOpen, Settings, BookOpen, ShieldCheck, LifeBuoy, Ticket,
  Library, Sparkles, GraduationCap, FileBadge, FileText, Search, Award, BarChart3,
  ClipboardCheck, Wrench, Brain, MessagesSquare, Lightbulb, BadgeCheck, Files,
  GitCompare, CircleAlert, Download, ShieldAlert, type LucideIcon,
} from "lucide-react";
import { modulos } from "@/modules";

export type NavSection = "nucleo" | "modulos" | "admin";
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
  /** feature_key de organization_features requerida. */
  feature?: string;
  /** Cualquiera de estos roles habilita el ítem. */
  roles?: string[];
  /** Planes que habilitan el ítem. */
  plans?: string[];
  status?: NavStatus;
  /** Atributo data-onboarding para el tour. */
  onboarding?: string;
  /** Tratamiento visual sutilmente distinto (Núcleo). */
  highlight?: boolean;
}

export const SECTION_LABELS: Record<NavSection, string> = {
  nucleo: "Núcleo",
  modulos: "Módulos",
  admin: "Administración",
};

export const SECTION_ORDER: NavSection[] = ["nucleo", "modulos", "admin"];

/** Grupos de menú de los módulos registrados (src/modules), en el orden recibido. */
export function construirNavegacion(gruposModulos: NavItem[]): NavItem[] {
  return [...gruposModulos, ...navegacionPlataforma];
}

/** Ítems de plataforma (fuera de los módulos). */
const navegacionPlataforma: NavItem[] = [
  {
    id: "capacitacion-grupo",
    label: "Capacitación",
    icon: GraduationCap,
    section: "modulos",
    children: [
      { id: "capacitacion", label: "Capacitación", icon: GraduationCap, route: "/capacitacion", section: "modulos", onboarding: "capacitacion" },
      { id: "mis-diplomas", label: "Mis Diplomas", icon: Award, route: "/mis-diplomas", section: "modulos" },
    ],
  },
  { id: "configuracion", label: "Configuración", icon: Settings, route: "/configuracion", section: "admin" },
  { id: "soporte", label: "Ayuda", icon: LifeBuoy, route: "/soporte", section: "admin", roles: ["admin", "responsable_sanitario"] },
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
