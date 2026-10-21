import { supabase } from "@/integrations/supabase/client";

export type ColorPendiente = "rojo" | "naranja" | "verde";
export interface Pendiente {
  modulo: string; tipo: string; registro: string; titulo: string; ruta: string;
  nace_en: string; fecha_limite: string | null; perfil: "operativo" | "gestion"; dias: number; color: ColorPendiente;
}
export interface Semaforo { operativo_naranja: number; operativo_rojo: number; gestion_naranja: number; gestion_rojo: number }
export const SEMAFORO_DEFECTO: Semaforo = { operativo_naranja: 3, operativo_rojo: 7, gestion_naranja: 10, gestion_rojo: 20 };

export const MODULO_LABEL: Record<string, string> = {
  plataforma: "Plataforma", tendencias: "Análisis de Tendencias", riesgos: "Gestión de Riesgos", institutional_brain: "Cerebro Institucional",
};
export const TIPO_LABEL: Record<string, string> = {
  perfil_sin_confirmar: "Perfil sin confirmar", suplencia_por_aceptar: "Suplencia por aceptar", at_borrador: "AT en borrador",
  semana_sin_captura: "Semana sin captura", accion_abierta: "Acción abierta", folio_en_firma: "Folio en firma",
  conocimiento_por_validar: "Conocimiento por validar",
};

const RANGO: Record<ColorPendiente, number> = { rojo: 0, naranja: 1, verde: 2 };

/** Counts the server-assigned colours; never reclassifies pending items. */
export function contarPendientes(lista: readonly Pendiente[]): Record<ColorPendiente, number> {
  return lista.reduce((c, p) => { c[p.color] += 1; return c; }, { rojo: 0, naranja: 0, verde: 0 });
}

/** Display-only timing, using company thresholds and Mexico City's calendar. */
export function plazoPendiente(p: Pendiente, s: Semaforo, ahora = new Date()): { estado: ColorPendiente; dias: number } {
  const rojo = p.perfil === "operativo" ? s.operativo_rojo : s.gestion_rojo;
  const hastaSemaforo = rojo - p.dias;
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find((v) => v.type === tipo)?.value ?? "";
  const hoy = `${parte("year")}-${parte("month")}-${parte("day")}`;
  const hastaFecha = p.fecha_limite ? Math.round((Date.parse(`${p.fecha_limite}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000) : Infinity;
  const restante = Math.min(hastaSemaforo, hastaFecha);
  return { estado: p.color, dias: p.color === "rojo" ? Math.max(0, -restante) : Math.max(0, restante) };
}

/** Misma regla que el servidor (pendientes_color): días naturales desde nace_en; fecha límite vencida = rojo. */
export function colorPendiente(perfil: Pendiente["perfil"], dias: number, vencida: boolean, s: Semaforo = SEMAFORO_DEFECTO): ColorPendiente {
  if (vencida) return "rojo";
  const [naranja, rojo] = perfil === "operativo" ? [s.operativo_naranja, s.operativo_rojo] : [s.gestion_naranja, s.gestion_rojo];
  return dias >= rojo ? "rojo" : dias >= naranja ? "naranja" : "verde";
}

/** Rojos primero, luego naranja y verde; dentro de cada color, los más antiguos primero. */
export function ordenarPendientes(lista: Pendiente[]): Pendiente[] {
  return [...lista].sort((a, b) => RANGO[a.color] - RANGO[b.color] || b.dias - a.dias || a.titulo.localeCompare(b.titulo));
}

export async function listarPendientes(alcance: "mio" | "empresa" = "mio"): Promise<Pendiente[]> {
  const { data, error } = await supabase.rpc("pendientes_usuario" as never, { _alcance: alcance } as never);
  if (error) throw error;
  return ordenarPendientes((data ?? []) as Pendiente[]);
}
