import {
  LayoutDashboard, FolderOpen, BookOpen, FileBadge, BarChart3, Search, Library, ShieldAlert,
} from "lucide-react";
import Index from "@/pages/Index";
import Folios from "@/pages/Folios";
import FolioDetail from "@/pages/FolioDetail";
import Catalogos from "@/pages/Catalogos";
import MisProtocolos from "@/pages/MisProtocolos";
import Cumplimiento from "@/pages/Cumplimiento";
import Auditoria from "@/pages/Auditoria";
import Recursos from "@/pages/Recursos";
import { ModuloTarjeta } from "../ModuloTarjeta";
import type { ModuloDef } from "../tipos";

export const riesgosModule: ModuloDef = {
  clave: "riesgos",
  nombre: "Gestión de Riesgos",
  descripcion: "Folios y matriz de riesgos",
  icono: ShieldAlert,
  rutaInicio: "/",
  mensajeNoContratado: "La Gestión de Riesgos no está activa para tu organización.",
  ordenPorDefecto: 10,
  tourClave: "riesgos",
  menu: {
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
  rutas: [
    { path: "/", Component: Index },
    { path: "/folios", Component: Folios },
    { path: "/folios/:id", Component: FolioDetail },
    { path: "/catalogos", Component: Catalogos },
    { path: "/mis-protocolos", Component: MisProtocolos },
    { path: "/cumplimiento", Component: Cumplimiento },
    { path: "/auditoria", Component: Auditoria },
    { path: "/recursos", Component: Recursos },
  ],
  obtenerPendientes: async () => [],
  Tarjeta: ModuloTarjeta,
};
