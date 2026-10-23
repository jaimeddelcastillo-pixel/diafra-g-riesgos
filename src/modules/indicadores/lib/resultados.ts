import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface Resultado {
  id: string; kpi_definicion_id: string | null; kpi_puesto_id: string | null;
  periodo_inicio: string; periodo_fin: string | null; fecha_evento: string | null; descripcion_evento: string;
  numerador: number; denominador: number | null; valor: number | null; cumplimiento: number | null; semaforo: string;
  meta_copia: number; tendencia_copia: string; unidad_copia: string;
  evidencia_path: string | null; comentario: string; estado: string;
  capturado_por: string; capturado_en: string; revisado_por: string | null; revisado_en: string | null; activo: boolean;
}
export interface Calculo { valor: number | null; cumplimiento: number | null; semaforo: string }
/** Misma regla que public.kpi_calcular: % = num/den×100; días y horas = num/den; número = num. */
export function calcular(unidad: string, tendencia: string, meta: number, num: number, den: number | null): Calculo {
  let valor: number | null;
  if (unidad === 'número') valor = num;
  else if (den === null || den === 0) return { valor: null, cumplimiento: null, semaforo: 'sin base' };
  else valor = unidad === '%' ? (num / den) * 100 : num / den;
  if (!meta || meta <= 0) return { valor, cumplimiento: null, semaforo: 'sin base' };
  const cumplimiento = tendencia === 'negativa' ? (valor <= meta ? 1 : meta / valor) : Math.min(valor / meta, 1);
  return { valor, cumplimiento, semaforo: cumplimiento >= 0.9 ? 'verde' : cumplimiento > 0.8 ? 'amarillo' : 'rojo' };
}
export interface Periodo { frecuencia: string; inicio: string; fin: string; etiqueta: string }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Periodos actual y anteriores por frecuencia, con el calendario local (mes, trimestre ene–mar…, semestre, año). */
export function periodos(frecuencias: string[]): Periodo[] {
  const hoy = new Date(); const out: Periodo[] = [];
  for (const fr of frecuencias) {
    for (let k = 0; k < 4; k++) {
      let i: Date; let f: Date;
      if (fr === 'mensual') { i = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1); f = new Date(hoy.getFullYear(), hoy.getMonth() - k + 1, 0); }
      else if (fr === 'trimestral') { const q = Math.floor(hoy.getMonth() / 3) - k; i = new Date(hoy.getFullYear(), q * 3, 1); f = new Date(hoy.getFullYear(), q * 3 + 3, 0); }
      else if (fr === 'semestral') { const s = (hoy.getMonth() >= 6 ? 6 : 0) - k * 6; i = new Date(hoy.getFullYear(), s, 1); f = new Date(hoy.getFullYear(), s + 6, 0); }
      else if (fr === 'anual') { i = new Date(hoy.getFullYear() - k, 0, 1); f = new Date(hoy.getFullYear() - k, 11, 31); }
      else continue;
      out.push({ frecuencia: fr, inicio: iso(i), fin: iso(f), etiqueta: `${fr} · ${iso(i)} al ${iso(f)}` });
    }
  }
  return out;
}
export async function listarResultados(): Promise<Resultado[]> {
  const { data, error } = await supabase.from('kpi_resultados').select('*').eq('activo', true).order('periodo_inicio', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Resultado[];
}
export interface CapturaArgs {
  tabla: 'kpi_definiciones' | 'kpi_puesto'; kpiId: string; periodoInicio?: string; periodoFin?: string;
  fechaEvento?: string; descripcionEvento?: string; numerador: number; denominador: number | null;
  evidenciaPath?: string; comentario?: string; motivo?: string; resultadoId?: string;
}
export async function capturarResultado(a: CapturaArgs): Promise<string> {
  const { data, error } = await supabase.rpc('capturar_kpi_resultado', {
    _tabla: a.tabla, _kpi_id: a.kpiId, _periodo_inicio: a.periodoInicio ?? null, _periodo_fin: a.periodoFin ?? null,
    _fecha_evento: a.fechaEvento ?? null, _descripcion_evento: a.descripcionEvento ?? '', _numerador: a.numerador,
    _denominador: a.denominador, _evidencia_path: a.evidenciaPath ?? '', _comentario: a.comentario ?? '',
    _motivo: a.motivo ?? '', _resultado_id: a.resultadoId ?? null,
  });
  if (error) throw error;
  return data as string;
}
export async function revisarResultado(id: string, motivo: string) {
  const { error } = await supabase.rpc('revisar_kpi_resultado', { _id: id, _motivo: motivo }); if (error) throw error;
}
export async function anularResultado(id: string, motivo: string) {
  const { error } = await supabase.rpc('anular_kpi_resultado', { _id: id, _motivo: motivo }); if (error) throw error;
}
export async function asignarCapturistas(tabla: 'kpi_definiciones' | 'kpi_puesto', codigo: string, capturistas: string[], motivo: string) {
  const { error } = await supabase.rpc('asignar_capturistas', { _tabla: tabla, _codigo: codigo, _capturistas: capturistas, _motivo: motivo }); if (error) throw error;
}
export async function subirEvidencia(orgId: string, kpiId: string, archivo: File): Promise<string> {
  if (archivo.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB');
  const path = `${orgId}/${kpiId}/${Date.now()}-${archivo.name.replace(/[^\w.-]/g, '_')}`;
  const { error } = await supabase.storage.from('kpi-evidencias').upload(path, archivo);
  if (error) throw error;
  return path;
}
export async function urlEvidencia(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('kpi-evidencias').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export function exportarResultados(filas: Record<string, unknown>[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);
  ws['!cols'] = Object.keys(filas[0] ?? { a: 1 }).map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}
