import {
  LayoutDashboard, FolderOpen, Settings, BookOpen, ShieldCheck, LifeBuoy, Ticket,
  Library, Sparkles, GraduationCap, FileBadge, FileText, Search, Award, BarChart3,
  ClipboardCheck, Wrench, Brain, MessagesSquare, Lightbulb, BadgeCheck, Files,
  GitCompare, CircleAlert, Download, ShieldAlert, type LucideIcon,
} from "lucide-react";

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

/** Navegación de organización (usuarios de cliente e impersonación). */
export const navigationConfig: NavItem[] = [
  {
    id: "cerebro",
    label: "Cerebro Institucional",
    icon: Brain,
    section: "nucleo",
    feature: "institutional_brain",
    highlight: true,
    children: [
      { id: "cerebro-panorama", label: "Panorama", icon: Brain, route: "/cerebro", exact: true, section: "nucleo" },
      { id: "cerebro-entrevistas", label: "Entrevistas", icon: MessagesSquare, route: "/cerebro/entrevistas", section: "nucleo" },
      { id: "cerebro-conocimiento", label: "Conocimiento", icon: Lightbulb, route: "/cerebro/conocimiento", section: "nucleo" },
      { id: "cerebro-validacion", label: "Validación", icon: BadgeCheck, route: "/cerebro/validacion", section: "nucleo" },
      { id: "cerebro-documentos", label: "Documentos", icon: Files, route: "/cerebro/documentos", section: "nucleo" },
      { id: "cerebro-contradicciones", label: "Contradicciones", icon: GitCompare, route: "/cerebro/contradicciones", section: "nucleo" },
      { id: "cerebro-brechas", label: "Brechas", icon: CircleAlert, route: "/cerebro/brechas", section: "nucleo" },
      { id: "cerebro-exportar", label: "Exportar", icon: Download, route: "/cerebro/exportar", section: "nucleo" },
    ],
  },
  {
    id: "riesgos",
    label: "Gestión de Riesgos",
    icon: ShieldAlert,
    section: "modulos",
    children: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, route: "/", exact: true, section: "modulos" },
      { id: "folios", label: "Mis Folios", icon: FolderOpen, route: "/folios", section: "modulos", onboarding: "folios" },
      { id: "catalogos", label: "Catálogos", icon: BookOpen, route: "/catalogos", section: "modulos" },
      { id: "mis-protocolos", label: "Mis Protocolos", icon: FileBadge, route: "/mis-protocolos", section: "modulos" },
      { id: "cumplimiento", label: "Cumplimiento", icon: BarChart3, route: "/cumplimiento", section: "modulos", roles: ["admin", "responsable_sanitario"] },
      { id: "auditoria", label: "Auditoría", icon: Search, route: "/auditoria", section: "modulos" },
      { id: "recursos", label: "Recursos", icon: Library, route: "/recursos", section: "modulos", onboarding: "recursos" },
    ],
  },
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
