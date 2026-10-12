import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { NavItem } from "@/config/navigation";
import type { OrgInfo } from "@/hooks/useAuth";

export interface ModuloRuta {
  path: string;
  Component: ComponentType;
}

export interface ModuloPendiente {
  etiqueta: string;
  /** Conteo; si falta, se muestra solo la etiqueta (p. ej. "Examen pendiente"). */
  cantidad?: number;
  ruta?: string;
}

export interface PendientesContexto {
  org: OrgInfo | null;
}

export interface ModuloTarjetaProps {
  modulo: ModuloDef;
}

export interface ModuloDef {
  /** Debe coincidir con modulos.clave en la base de datos. */
  clave: string;
  nombre: string;
  descripcion: string;
  icono: LucideIcon;
  rutaInicio: string;
  /** Texto de la guardia cuando la empresa no tiene el módulo. */
  mensajeNoContratado: string;
  /** Orden de respaldo si el catálogo aún no carga; manda modulos.orden. */
  ordenPorDefecto: number;
  /** Grupo de menú con sus ítems (plantilla: Tablero … Auditoría · Capacitación). */
  menu: NavItem;
  rutas: ModuloRuta[];
  /** Reservada para P2. */
  tourClave: string;
  /** Pendientes del usuario en la empresa activa. Solo conteos. */
  obtenerPendientes: (ctx: PendientesContexto) => Promise<ModuloPendiente[]>;
  Tarjeta: ComponentType<ModuloTarjetaProps>;
}
