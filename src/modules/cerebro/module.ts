import {
  Brain, MessagesSquare, Lightbulb, BadgeCheck, Files, GitCompare, CircleAlert, Download, Search, Library,
} from "lucide-react";
import CerebroDashboard from "@/pages/cerebro/CerebroDashboard";
import CerebroEntrevistas from "@/pages/cerebro/CerebroEntrevistas";
import CerebroConocimiento from "@/pages/cerebro/CerebroConocimiento";
import CerebroValidacion from "@/pages/cerebro/CerebroValidacion";
import CerebroDocumentos from "@/pages/cerebro/CerebroDocumentos";
import CerebroContradicciones from "@/pages/cerebro/CerebroContradicciones";
import CerebroBrechas from "@/pages/cerebro/CerebroBrechas";
import CerebroExportar from "@/pages/cerebro/CerebroExportar";
import CerebroAuditoria from "@/pages/cerebro/CerebroAuditoria";
import { supabase } from "@/integrations/supabase/client";
import { ModuloTarjeta } from "../ModuloTarjeta";
import type { ModuloDef, ModuloPendiente } from "../tipos";

export const cerebroModule: ModuloDef = {
  clave: "institutional_brain",
  nombre: "Cerebro Institucional",
  descripcion: "Captura y gobierno del conocimiento institucional",
  icono: Brain,
  rutaInicio: "/cerebro",
  mensajeNoContratado: "El Cerebro Institucional no está activo para tu organización.",
  ordenPorDefecto: 20,
  tourClave: "cerebro",
  menu: {
    id: "cerebro",
    label: "Cerebro Institucional",
    icon: Brain,
    section: "modulos",
    feature: "institutional_brain",
    children: [
      { id: "cerebro-panorama", label: "Tablero", icon: Brain, route: "/cerebro", exact: true, section: "modulos" },
      { id: "cerebro-entrevistas", label: "Entrevistas", icon: MessagesSquare, route: "/cerebro/entrevistas", section: "modulos" },
      { id: "cerebro-conocimiento", label: "Conocimiento", icon: Lightbulb, route: "/cerebro/conocimiento", section: "modulos" },
      { id: "cerebro-validacion", label: "Validación", icon: BadgeCheck, route: "/cerebro/validacion", section: "modulos" },
      { id: "cerebro-documentos", label: "Documentos", icon: Files, route: "/cerebro/documentos", section: "modulos" },
      // Misma página de Recursos de la plataforma; solo si la empresa no tiene Riesgos (que ya la muestra).
      { id: "cerebro-recursos", label: "Recursos", icon: Library, route: "/recursos", section: "modulos", soloSinModulo: "riesgos" },
      { id: "cerebro-contradicciones", label: "Contradicciones", icon: GitCompare, route: "/cerebro/contradicciones", section: "modulos" },
      { id: "cerebro-brechas", label: "Brechas", icon: CircleAlert, route: "/cerebro/brechas", section: "modulos" },
      { id: "cerebro-exportar", label: "Exportar", icon: Download, route: "/cerebro/exportar", section: "modulos" },
      { id: "cerebro-auditoria", label: "Auditoría de Cerebro", icon: Search, route: "/cerebro/auditoria", section: "modulos", roles: ["admin", "responsable_sanitario"] },
    ],
  },
  rutas: [
    { path: "/cerebro", Component: CerebroDashboard },
    { path: "/cerebro/entrevistas", Component: CerebroEntrevistas },
    { path: "/cerebro/conocimiento", Component: CerebroConocimiento },
    { path: "/cerebro/validacion", Component: CerebroValidacion },
    { path: "/cerebro/documentos", Component: CerebroDocumentos },
    { path: "/cerebro/contradicciones", Component: CerebroContradicciones },
    { path: "/cerebro/brechas", Component: CerebroBrechas },
    { path: "/cerebro/exportar", Component: CerebroExportar },
    { path: "/cerebro/auditoria", Component: CerebroAuditoria },
  ],
  obtenerPendientes: async () => {
    const { data, error } = await supabase.rpc("pendientes_cerebro" as any);
    if (error) throw error;
    const d = (data ?? {}) as Record<string, any>;
    const out: ModuloPendiente[] = [];
    const add = (etiqueta: string, cantidad: unknown, ruta: string) => {
      if (typeof cantidad === "number") out.push({ etiqueta, cantidad, ruta });
    };
    add("Por validar", d.por_validar, "/cerebro/validacion");
    add("Requiere revisión", d.requiere_revision, "/cerebro/validacion");
    // Propuestas: solo admin y RS (la función solo las devuelve para ellos).
    add("Estado propuesto por confirmar", d.estado_propuesto, "/cerebro/documentos");
    add("Enlace por confirmar", d.enlace_por_confirmar, "/cerebro/documentos");
    add("Copia no controlada propuesta", d.copia_no_controlada, "/recursos");
    return out;
  },
  Tarjeta: ModuloTarjeta,
};
