// Catálogo de objetivos de presión: SOLO pares de cuartos.
// Para "Instrumento (manómetro)" y "Filtro HEPA" se usa directo el catálogo de instrumentos.
import { supabase } from "@/integrations/supabase/client";

export type TipoObjetivoPresion = "par_cuartos";

export interface ObjetivoPresion {
  id: string;
  tipo: TipoObjetivoPresion;
  codigo: string;
  nombre: string;
  par_cuartos_id: string | null;
  cuarto_x_id: string | null;
  cuarto_y_id: string | null;
  iso: string | null;
  instrumento_id: string | null;
  unidad: string;
  limite_normativo_pa: number | null;
  lie_pa: number | null;
  lse_pa: number | null;
  activo: boolean;
}

export const TIPO_OBJETIVO_LABEL: Record<TipoObjetivoPresion, string> = {
  par_cuartos: "Par de cuartos",
};

/** Etiqueta de límite legible. */
export function describirLimite(o: ObjetivoPresion): string {
  return o.limite_normativo_pa != null ? `≥${o.limite_normativo_pa} Pa` : "sin límite";
}

/** Alerta de tendencia para filtros HEPA: dispara si la lectura se desvía más del % tolerancia respecto al baseline. */
export function alertaBaseline(
  valor: number,
  baseline: number | null,
  tolerancia_pct: number | null,
): "ok" | "warning" | null {
  if (baseline == null || tolerancia_pct == null) return null;
  const diff = Math.abs(valor - baseline);
  const margen = (Math.abs(baseline) * tolerancia_pct) / 100;
  return diff > margen ? "warning" : "ok";
}
