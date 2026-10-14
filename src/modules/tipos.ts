import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { NavItem } from "@/config/navigation";
import type { OrgInfo } from "@/hooks/useAuth";

/** Paso de un tour. Sin selector, se muestra centrado; si el elemento no está visible, se salta. */
export interface PasoTour {
  selector?: string;
  titulo: string;
  texto: string;
}

export interface TourProps {
  onTerminar: () => void;
  onSaltar: () => void;
}

/** Tour de módulo (clave en onboarding_estado: modulo:<x>). */
export interface TourDef {
  clave: string;
  titulo: string;
  /** Rutas (patrones) donde se dispara la primera vez. */
  rutas: string[];
  /** Ruta a la que se navega para verlo de nuevo desde Ayuda. */
  rutaInicio: string;
  pasos?: PasoTour[];
  /** Tour con flujo propio (Riesgos: bienvenida, recorrido y primer folio). */
  Componente?: ComponentType<TourProps>;
}

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
  pendientes?: ModuloPendiente[];
  cargando?: boolean;
  /** La consulta de pendientes falló: la tarjeta muestra "No disponible". */
  error?: boolean;
}

export interface ModuloDef {
  /** Debe coincidir con modulos.clave en la base de datos. */
  clave: string;
  nombre: string;
  /** Optional normative context for this module's header; absent means no norm. */
  normaEnEncabezado?: (norma: string | null | undefined) => string | undefined;
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
  tourClave: string;
  /** Tours del módulo (P2), en orden de prioridad. */
  tours: TourDef[];
  /** Pendientes del usuario en la empresa activa. Solo conteos. */
  obtenerPendientes: (ctx: PendientesContexto) => Promise<ModuloPendiente[]>;
  Tarjeta: ComponentType<ModuloTarjetaProps>;
}
