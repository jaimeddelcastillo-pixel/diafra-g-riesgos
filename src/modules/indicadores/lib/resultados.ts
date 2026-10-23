import type { ContextoDocumento } from '@/lib/documentos';
import { XLSX as XLSXS, escribirLibro, hojaConIdentidad } from '@/lib/documentos/excel';
import { supabase } from '@/integrations/supabase/client';

export interface Resultado {
  id: string; kpi_definicion_id: string | null; kpi_puesto_id: string | null;
  periodo_inicio: string; periodo_fin: string | null; fecha_evento: string | null; descripcion_evento: string;
  numerador: number; denominador: number | null; valor: number | null; cumplimiento: number | null; semaforo: string;
  meta_copia: number; tendencia_copia: string; unidad_copia: string;
  evidencia_path: string | null; referencia_fuente: string; comentario: string; estado: string;
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
/** D1: results export with the company document identity (header rows, footer and TRACEA folio). */
export function exportarResultados(ctx: ContextoDocumento, filas: Record<string, unknown>[]): Uint8Array {
  const encabezados = Object.keys(filas[0] ?? { Sin_resultados: '' });
  const ws = hojaConIdentidad(ctx, encabezados, filas.map(f => encabezados.map(k => (f[k] ?? '') as string | number)));
  ws['!cols'] = encabezados.map(() => ({ wch: 22 }));
  const wb = XLSXS.utils.book_new(); XLSXS.utils.book_append_sheet(wb, ws, 'Resultados');
  return escribirLibro(wb);
}

/** Fecha de hoy en America/Mexico_City (YYYY-MM-DD). */
export function hoyMx(d = new Date()): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
const ymd = (y: number, m: number, d: number) => iso(new Date(y, m, d));
/** Misma regla que public.kpi_periodo. */
export function periodoDe(frecuencia: string, fecha: string): { inicio: string; fin: string } | null {
  const [y, m] = fecha.split('-').map(Number); const mi = m - 1;
  if (frecuencia === 'mensual') return { inicio: ymd(y, mi, 1), fin: ymd(y, mi + 1, 0) };
  if (frecuencia === 'trimestral') { const q = Math.floor(mi / 3) * 3; return { inicio: ymd(y, q, 1), fin: ymd(y, q + 3, 0) }; }
  if (frecuencia === 'semestral') { const s = mi >= 6 ? 6 : 0; return { inicio: ymd(y, s, 1), fin: ymd(y, s + 6, 0) }; }
  if (frecuencia === 'anual') return { inicio: ymd(y, 0, 1), fin: ymd(y, 11, 31) };
  return null;
}
/** Misma regla que public.kpi_ultimo_cerrado: el periodo anterior al que contiene hoy. */
export function ultimoCerrado(frecuencia: string, hoy: string): { inicio: string; fin: string } | null {
  const actual = periodoDe(frecuencia, hoy); if (!actual) return null;
  const [y, m, d] = actual.inicio.split('-').map(Number);
  return periodoDe(frecuencia, iso(new Date(y, m - 1, d - 1)));
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function etiquetaPeriodo(frecuencia: string, inicio: string): string {
  const [y, m] = inicio.split('-').map(Number);
  if (frecuencia === 'mensual') return `${MESES[m - 1]} ${y}`;
  if (frecuencia === 'trimestral') return `T${Math.floor((m - 1) / 3) + 1} ${y}`;
  if (frecuencia === 'semestral') return `S${m >= 7 ? 2 : 1} ${y}`;
  if (frecuencia === 'anual') return String(y);
  return inicio;
}
/** Celdas del año (enero a diciembre) según la frecuencia; cada una con su periodo y ancho en meses. */
export function celdasAnio(frecuencia: string, anio: number): { inicio: string; fin: string; meses: number }[] {
  const paso = frecuencia === 'mensual' ? 1 : frecuencia === 'trimestral' ? 3 : frecuencia === 'semestral' ? 6 : frecuencia === 'anual' ? 12 : 0;
  if (!paso) return [];
  return Array.from({ length: 12 / paso }, (_, i) => { const periodo = periodoDe(frecuencia, ymd(anio, i * paso, 1)); return periodo ? { ...periodo, meses: paso } : null; }).filter((p): p is { inicio: string; fin: string; meses: number } => p !== null);
}
export const periodoCerrado = (fin: string, hoy: string) => fin < hoy;
export interface GuardarArgs { tabla: 'kpi_definiciones' | 'kpi_puesto'; kpiId: string; periodoInicio?: string; fechaEvento?: string; descripcionEvento?: string; numerador: number; denominador: number | null; referencia: string; comentario: string; motivo?: string; resultadoId?: string }
export async function guardarResultado(a: GuardarArgs): Promise<string> {
  const { data, error } = await supabase.rpc('guardar_kpi_resultado', { _tabla: a.tabla, _kpi_id: a.kpiId, _periodo_inicio: a.periodoInicio ?? null, _fecha_evento: a.fechaEvento ?? null, _descripcion_evento: a.descripcionEvento ?? '', _numerador: a.numerador, _denominador: a.denominador, _referencia: a.referencia, _comentario: a.comentario, _motivo: a.motivo ?? '', _resultado_id: a.resultadoId ?? null } as never);
  if (error) throw error; return data as unknown as string;
}
export interface Evidencia { id: string; periodo_inicio: string; periodo_fin: string; nombre: string; path: string }
export interface Liga { resultado_id: string; evidencia_id: string }
export async function listarEvidencias(): Promise<{ evidencias: Evidencia[]; ligas: Liga[] }> {
  const [e, l] = await Promise.all([
    supabase.from('kpi_evidencias').select('id,periodo_inicio,periodo_fin,nombre,path').eq('activo', true).order('periodo_inicio', { ascending: false }),
    supabase.from('kpi_resultado_evidencia').select('resultado_id,evidencia_id').eq('activo', true),
  ]);
  if (e.error) throw e.error; if (l.error) throw l.error;
  return { evidencias: (e.data ?? []) as Evidencia[], ligas: (l.data ?? []) as Liga[] };
}
export async function registrarEvidencia(orgId: string, inicio: string, fin: string, archivo: File): Promise<string> {
  if (archivo.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB');
  const path = `${orgId}/periodo/${inicio}/${Date.now()}-${archivo.name.replace(/[^\w.-]/g, '_')}`;
  const up = await supabase.storage.from('kpi-evidencias').upload(path, archivo); if (up.error) throw up.error;
  const { data, error } = await supabase.rpc('registrar_kpi_evidencia', { _periodo_inicio: inicio, _periodo_fin: fin, _nombre: archivo.name, _path: path } as never);
  if (error) throw error; return data as unknown as string;
}
export async function ligarEvidencia(evidenciaId: string, resultados: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('ligar_kpi_evidencia', { _evidencia_id: evidenciaId, _resultados: resultados } as never);
  if (error) throw error; return Number(data);
}
