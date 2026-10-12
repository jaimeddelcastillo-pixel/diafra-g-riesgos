import {
  LayoutDashboard, FolderOpen, BookOpen, FileBadge, BarChart3, Search, Library, ShieldAlert,
  GraduationCap, Award,
} from "lucide-react";
import Index from "@/pages/Index";
import Folios from "@/pages/Folios";
import FolioDetail from "@/pages/FolioDetail";
import Catalogos from "@/pages/Catalogos";
import MisProtocolos from "@/pages/MisProtocolos";
import Cumplimiento from "@/pages/Cumplimiento";
import Auditoria from "@/pages/Auditoria";
import { supabase } from "@/integrations/supabase/client";
import { ModuloTarjeta } from "../ModuloTarjeta";
import type { ModuloDef, ModuloPendiente } from "../tipos";

interface CursoAvance { norma: string; total: number; completadas: number; aprobado: boolean }

// Misma regla de acceso al curso que usa la página Capacitación (no cambia derechos).
const PLANES_PAGADOS = ["starter", "professional", "enterprise"];
const SUB_STATUS_TRIAL_OK = ["", "active", "trialing", "trial", "past_due"];

export const riesgosModule: ModuloDef = {
  clave: "riesgos",
  nombre: "Gestión de Riesgos",
  descripcion: "Folios y matriz de riesgos",
  icono: ShieldAlert,
  rutaInicio: "/riesgos",
  mensajeNoContratado: "La Gestión de Riesgos no está activa para tu organización.",
  ordenPorDefecto: 10,
  tourClave: "riesgos",
  menu: {
    id: "riesgos",
    label: "Gestión de Riesgos",
    icon: ShieldAlert,
    section: "modulos",
    feature: "riesgos",
    children: [
      { id: "riesgos-tablero", label: "Tablero", icon: LayoutDashboard, route: "/riesgos", exact: true, section: "modulos" },
      { id: "folios", label: "Mis Folios", icon: FolderOpen, route: "/folios", section: "modulos", onboarding: "folios" },
      { id: "catalogos", label: "Catálogos", icon: BookOpen, route: "/catalogos", section: "modulos" },
      { id: "mis-protocolos", label: "Mis Protocolos", icon: FileBadge, route: "/mis-protocolos", section: "modulos" },
      { id: "cumplimiento", label: "Cumplimiento", icon: BarChart3, route: "/cumplimiento", section: "modulos", roles: ["admin", "responsable_sanitario"] },
      { id: "recursos", label: "Recursos", icon: Library, route: "/recursos", section: "modulos", onboarding: "recursos" },
      { id: "auditoria", label: "Auditoría de Riesgos", icon: Search, route: "/auditoria", section: "modulos" },
      { id: "capacitacion", label: "Capacitación", icon: GraduationCap, route: "/capacitacion", section: "modulos", onboarding: "capacitacion" },
      { id: "mis-diplomas", label: "Mis Diplomas", icon: Award, route: "/mis-diplomas", section: "modulos" },
    ],
  },
  rutas: [
    { path: "/riesgos", Component: Index },
    { path: "/folios", Component: Folios },
    { path: "/folios/:id", Component: FolioDetail },
    { path: "/catalogos", Component: Catalogos },
    { path: "/mis-protocolos", Component: MisProtocolos },
    { path: "/cumplimiento", Component: Cumplimiento },
    { path: "/auditoria", Component: Auditoria },
  ],
  obtenerPendientes: async ({ org }) => {
    const { data, error } = await supabase.rpc("pendientes_riesgos" as any);
    if (error) throw error;
    const d = (data ?? {}) as Record<string, any>;
    const out: ModuloPendiente[] = [];
    const add = (etiqueta: string, cantidad: unknown, ruta?: string) => {
      if (typeof cantidad === "number") out.push({ etiqueta, cantidad, ruta });
    };
    add("Folios en firma que esperan tu firma o dictamen", d.en_firma, "/folios");
    add("Folios con revisión anual vencida", d.revision_vencida, "/folios");
    add("Firmas pendientes", d.firmas, "/folios");
    add("Votos pendientes", d.votos, "/folios");
    add("Mis borradores", d.borradores, "/folios");

    // Capacitación del módulo: solo si la empresa tiene el curso, igual que la página.
    const plan = (org?.plan ?? "").toLowerCase();
    const sub = (org?.subscription_status ?? "").toLowerCase();
    const tieneCurso =
      PLANES_PAGADOS.includes(plan) ||
      (plan === "trial" && SUB_STATUS_TRIAL_OK.includes(sub)) ||
      org?.tiene_curso_pagado === true;
    if (tieneCurso) {
      const norma = org?.norma_aplicable ?? null;
      const normas = norma === "NOM-241" || norma === "NOM-059" ? [norma] : ["NOM-241", "NOM-059"];
      const cursos = ((d.cursos ?? []) as CursoAvance[]).filter((c) => normas.includes(c.norma) && c.total > 0);
      for (const c of cursos) {
        if (c.aprobado) continue;
        const sufijo = cursos.length > 1 ? ` (${c.norma})` : "";
        if (c.completadas >= c.total) {
          out.push({ etiqueta: `Examen pendiente${sufijo}`, ruta: "/capacitacion" });
        } else {
          out.push({
            etiqueta: `Curso${sufijo}: ${Math.round((c.completadas / c.total) * 100)}% de avance`,
            ruta: "/capacitacion",
          });
        }
      }
      if (d.rol === "admin" || d.rol === "responsable_sanitario") {
        add("DC-3 pendientes", d.dc3_pendientes, "/capacitacion");
        const expira = org?.curso_expira_en ? new Date(org.curso_expira_en) : null;
        if (expira && expira.getTime() > Date.now() && expira.getTime() - Date.now() < 30 * 86400_000) {
          out.push({
            etiqueta: `Curso por vencer el ${expira.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`,
            ruta: "/capacitacion",
          });
        }
      }
    }
    return out;
  },
  Tarjeta: ModuloTarjeta,
};
