import {
  Brain, MessagesSquare, Lightbulb, BadgeCheck, Files, GitCompare, CircleAlert, Download, Search,
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
import { ModuloTarjeta } from "../ModuloTarjeta";
import type { ModuloDef } from "../tipos";

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
      { id: "cerebro-auditoria", label: "Auditoría", icon: Search, route: "/cerebro/auditoria", section: "nucleo", roles: ["admin", "responsable_sanitario"] },
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
  obtenerPendientes: async () => [],
  Tarjeta: ModuloTarjeta,
};
