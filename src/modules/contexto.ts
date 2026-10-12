import { matchPath } from "react-router-dom";
import type { ModuloDef } from "./tipos";

/** Includes shared pages through their visible module menu, without duplicating routes. */
export function moduloEnRuta(pathname: string, modulos: ModuloDef[], accesos: Record<string, boolean> = {}) {
  const propio = modulos.find((m) => m.rutas.some((r) => matchPath({ path: r.path, end: true }, pathname)));
  if (propio) return propio;
  return modulos.find((m) => accesos[m.clave] && m.menu.children?.some((i) =>
    i.route && (!i.soloSinModulo || !accesos[i.soloSinModulo]) && matchPath({ path: i.route, end: true }, pathname),
  ));
}

export function encabezadoModulo(modulo: ModuloDef | undefined, norma: string | null | undefined) {
  return modulo ? [modulo.nombre, modulo.normaEnEncabezado?.(norma)].filter(Boolean).join(" · ") : "TRACEA";
}