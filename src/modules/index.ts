/**
 * Registro de módulos (híbrido).
 * - La base de datos decide el ACCESO: modulos, plan_modulos, organization_features
 *   (vía mi_org_tiene_modulo). También decide el ORDEN (modulos.orden) y el estado.
 * - Cada src/modules/<clave>/module.ts decide cómo se VE y se NAVEGA.
 *
 * Cómo agregar un módulo nuevo (ejemplo: Tendencias):
 * 1. Base de datos: INSERT INTO modulos (clave, nombre, descripcion, activo, orden, estado)
 *    VALUES ('tendencias', 'Tendencias', '...', true, 30, 'activo');
 *    y una fila por plan que lo incluya en plan_modulos (plan, modulo='tendencias').
 *    Para accesos puntuales, organization_features con feature_key='tendencias'.
 * 2. Código: crear src/modules/tendencias/module.ts que exporte un ModuloDef con la
 *    misma clave, su grupo de menú, rutas, tourClave, obtenerPendientes y Tarjeta.
 * 3. Agregarlo al arreglo `modulosRegistrados` de abajo.
 * No hay que tocar el menú, las rutas de App ni Inicio: se arman desde este registro,
 * y ModuloGuard protege sus rutas con mi_org_tiene_modulo(clave).
 */
import { riesgosModule } from "./riesgos/module";
import { cerebroModule } from "./cerebro/module";
import Recursos from "@/pages/Recursos";
import type { ModuloDef, ModuloRuta } from "./tipos";

export type { ModuloDef } from "./tipos";

const modulosRegistrados: ModuloDef[] = [riesgosModule, cerebroModule];

/** Ordena por modulos.orden; si una clave no tiene fila, usa su orden por defecto. */
export function ordenarModulos(ordenDb?: Record<string, number> | null): ModuloDef[] {
  const o = (m: ModuloDef) => ordenDb?.[m.clave] ?? m.ordenPorDefecto;
  return [...modulosRegistrados].sort((a, b) => o(a) - o(b));
}

export const modulos: ModuloDef[] = ordenarModulos();

/**
 * Páginas de plataforma que usan varios módulos (no pertenecen a uno solo).
 * Abren si la empresa tiene al menos un módulo registrado activo.
 * En el menú aparecen como ítems de los módulos que las usan, apuntando a la misma ruta.
 */
export const rutasPlataforma: ModuloRuta[] = [{ path: "/recursos", Component: Recursos }];
export const clavesModulos: string[] = modulosRegistrados.map((m) => m.clave);
