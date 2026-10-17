// Cliente de catálogos contra Lovable Cloud (Supabase)
import { supabase } from "@/integrations/supabase/client";

export type IsoClase = "ISO-5" | "ISO-6" | "ISO-7" | "ISO-8" | "ISO-9" | "No clasificada";

export const ISO_CLASES: IsoClase[] = ["ISO-5", "ISO-6", "ISO-7", "ISO-8", "ISO-9", "No clasificada"];
export type InstrumentoTipo = "termohigrometro" | "manometro_filtro" | "manometro_diferencial" | "otro";

export interface SistemaHVAC {
  id: string;
  codigo: string;
  nombre_uma: string;
  descripcion: string;
  etapas: string[];
  activo: boolean;
}

export interface AreaClasificada {
  id: string;
  codigo: string;
  nombre: string;
  iso: IsoClase;
  hvac_id: string | null;
  activo: boolean;
}

export interface Instrumento {
  id: string;
  codigo: string;
  tipo: InstrumentoTipo;
  area_id: string | null;
  area_libre: string | null;
  parametro: string;
  especificacion: string | null;
  activo: boolean;
  /** Límites para manómetros (Pa). Se definen una sola vez en el catálogo. */
  lie_pa: number | null;
  lse_pa: number | null;
  /** Solo para manómetros de filtro HEPA: baseline + tolerancia para alarma de tendencia. */
  baseline_pa: number | null;
  baseline_tolerancia_pct: number | null;
  /** Código de la bitácora física (BIT-…) usado en los formatos. */
  codigo_bitacora: string | null;
  /** ΔP final de saturación según fabricante (filtros), en la unidad del instrumento. */
  dp_final_fabricante: number | null;
  /** Rango de operación (Pa): solo informativo, banda gris; no se usa para cumplimiento ni capacidad. */
  op_min_pa?: number | null;
  op_max_pa?: number | null;
  /** Especificación normativa (FOR). "na" = sin especificación (solo tendencia). */
  spec_estado?: "validada" | "pendiente" | "na" | null;
  spec_texto?: string | null;
  spec_lie?: number | null; spec_lse?: number | null;
  spec_lie_estricto?: boolean; spec_lse_estricto?: boolean;
  spec_texto_hr?: string | null; spec_lie_hr?: number | null; spec_lse_hr?: number | null;
  spec_referencia?: string | null; spec_fecha_validacion?: string | null;
  area_estado?: "validada" | "pendiente"; area_nota?: string | null;
}

// La interfaz ParCuartos fue retirada al unificar el catálogo en `objetivos_presion`.

export const ISO_LIMIT_PA: Record<IsoClase, number> = {
  "ISO-5": 15,
  "ISO-6": 12,
  "ISO-7": 10,
  "ISO-8": 5,
  "ISO-9": 0,
  "No clasificada": 0,
};

// Límites de T/HR por ISO (NOM-241). 'No clasificada' usa rangos amplios por defecto; ajustar por área si aplica.
export const ISO_TEMP_HR: Record<IsoClase, { tempMin: number; tempMax: number; hrMin: number; hrMax: number }> = {
  "ISO-5": { tempMin: 18, tempMax: 25, hrMin: 30, hrMax: 65 },
  "ISO-6": { tempMin: 18, tempMax: 25, hrMin: 30, hrMax: 65 },
  "ISO-7": { tempMin: 18, tempMax: 25, hrMin: 30, hrMax: 65 },
  "ISO-8": { tempMin: 18, tempMax: 25, hrMin: 30, hrMax: 65 },
  "ISO-9": { tempMin: 18, tempMax: 25, hrMin: 30, hrMax: 65 },
  "No clasificada": { tempMin: 15, tempMax: 30, hrMin: 20, hrMax: 80 },
};


export interface CambioFiltro { id: string; instrumento_id: string; fecha: string; nota: string }
