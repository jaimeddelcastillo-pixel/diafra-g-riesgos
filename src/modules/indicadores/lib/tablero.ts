import { supabase } from '@/integrations/supabase/client';
import type { ContextoDocumento } from '@/lib/documentos';
import { XLSX, escribirLibro, hojaConIdentidad } from '@/lib/documentos/excel';

/** K3-a: shapes returned by the server function kpi_resumen_periodo (single source of the calculation). */
export type TipoPeriodo = 'trimestre' | 'semestre' | 'año';
export interface Subperiodo { inicio: string; fin: string | null; numerador: number; denominador: number | null; valor: number | null; cumplimiento: number | null; semaforo: string; meta: number }
export interface KpiResumen {
  id: string; tabla: 'kpi_definiciones' | 'kpi_puesto'; tipo: 'SGC' | 'Puesto'; codigo: string; nombre: string; proceso: string | null; nivel: string | null; puesto_id: string | null;
  frecuencia: string; unidad: string; tendencia: string; peso: number; meta: number; meta_cambio: boolean; metas: number[]; subperiodos: Subperiodo[]; resultados: number;
  valor: number | null; cumplimiento: number | null; semaforo: string; valor_anterior: number | null; tendencia_periodo: 'sube' | 'baja' | 'igual' | null;
}
export interface PuestoResumen { puesto_id: string; codigo: string; nombre: string; calificacion: number | null; semaforo: string; con_dato: number; total: number; calificacion_anterior: number | null }
export interface IndiceSGC { indice: number | null; semaforo: string; indice_anterior: number | null; semaforo_anterior: string | null; con_dato: number; total: number; verde: number; amarillo: number; rojo: number; sin_base: number; sin_captura: number }
export interface ProcesoResumen { proceso: string; indice: number | null; semaforo: string; con_dato: number; total: number }
export interface Resumen { tipo: TipoPeriodo; inicio: string; fin: string; anterior: { inicio: string; fin: string }; kpis: KpiResumen[]; puestos: PuestoResumen[]; indice_sgc: IndiceSGC; procesos: ProcesoResumen[] }

export async function obtenerResumen(tipo: TipoPeriodo, inicio: string, filtros: Record<string, string> = {}): Promise<Resumen> {
  const { data, error } = await supabase.rpc('kpi_resumen_periodo', { _tipo: tipo, _inicio: inicio, _filtros: filtros });
  if (error) throw error;
  return data as unknown as Resumen;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_POR: Record<TipoPeriodo, number> = { trimestre: 3, semestre: 6, 'año': 12 };
const hoyMexico = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
const iso = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}-01`;

export function etiquetaPeriodo(tipo: TipoPeriodo, inicio: string) {
  const [y, m] = inicio.split('-').map(Number);
  if (tipo === 'trimestre') return `T${Math.floor((m - 1) / 3) + 1} ${y}`;
  if (tipo === 'semestre') return `S${m <= 6 ? 1 : 2} ${y}`;
  return String(y);
}
/** Closed periods of the type, newest first (default = last closed). */
export function periodosCerrados(tipo: TipoPeriodo, cantidad = 8, hoy = hoyMexico()): { inicio: string; etiqueta: string }[] {
  const n = MESES_POR[tipo]; let y = hoy.getFullYear(); let m = Math.floor(hoy.getMonth() / n) * n;
  const out: { inicio: string; etiqueta: string }[] = [];
  for (let i = 0; i < cantidad; i++) { m -= n; if (m < 0) { m += 12; y -= 1; } out.push({ inicio: iso(y, m), etiqueta: etiquetaPeriodo(tipo, iso(y, m)) }); }
  return out;
}
export function etiquetaSub(frecuencia: string, inicio: string) {
  const [y, m] = inicio.split('-').map(Number);
  if (frecuencia === 'trimestral') return `T${Math.floor((m - 1) / 3) + 1}`;
  if (frecuencia === 'semestral') return `S${m <= 6 ? 1 : 2}`;
  if (frecuencia === 'anual') return String(y);
  return MESES[m - 1];
}
export const pct = (c: number | null | undefined) => c == null ? '—' : `${(c * 100).toFixed(1)} %`;
export const num = (v: number | null | undefined) => v == null ? '—' : Number(v.toFixed(2)).toString();
export const flecha = (t: KpiResumen['tendencia_periodo']) => t === 'sube' ? '↑' : t === 'baja' ? '↓' : t === 'igual' ? '→' : '—';
/** Out of target: yellow or red, SGC level first. */
export const fueraDeMeta = (r: Resumen) => r.kpis.filter(k => k.semaforo === 'amarillo' || k.semaforo === 'rojo')
  .sort((a, b) => Number(b.nivel === 'SGC') - Number(a.nivel === 'SGC') || Number(b.semaforo === 'rojo') - Number(a.semaforo === 'rojo') || a.codigo.localeCompare(b.codigo));

/** Excel with D1 identity, one sheet per view. */
export function exportarTablero(ctx: ContextoDocumento, r: Resumen, nombresPuesto: Record<string, string> = {}): Uint8Array {
  const periodo = `Periodo: ${etiquetaPeriodo(r.tipo, r.inicio)} (${r.inicio} a ${r.fin})`;
  const filaKpi = (k: KpiResumen) => [k.tipo, k.proceso ?? nombresPuesto[k.puesto_id ?? ''] ?? '', k.codigo, k.nombre, k.meta, k.unidad,
    k.subperiodos.map(s => `${etiquetaSub(k.frecuencia, s.inicio)}: ${num(s.valor)}`).join(' · '), num(k.valor), pct(k.cumplimiento), k.semaforo, flecha(k.tendencia_periodo), num(k.valor_anterior), k.meta_cambio ? `Sí (${k.metas.join(', ')})` : 'No'];
  const encK = ['Tipo', 'Proceso / puesto', 'Código', 'Nombre', 'Meta', 'Unidad', 'Subperiodos', 'Acumulado', 'Cumplimiento', 'Semáforo', 'Tendencia', 'Valor anterior', 'Meta cambió'];
  const i = r.indice_sgc;
  const hojas: [string, string[], (string | number)[][]][] = [
    ['Resumen', ['Concepto', 'Valor'], [['Índice SGC', pct(i.indice)], ['Semáforo', i.semaforo], ['Índice periodo anterior', pct(i.indice_anterior)], ['KPI con dato', `${i.con_dato} de ${i.total}`], ['Verde', i.verde], ['Amarillo', i.amarillo], ['Rojo', i.rojo], ['Sin base', i.sin_base], ['Sin captura', i.sin_captura], ...r.procesos.map(p => [`Proceso ${p.proceso}`, `${pct(p.indice)} · ${p.semaforo}`])]],
    ['Por proceso', encK, r.kpis.filter(k => k.tipo === 'SGC').map(filaKpi)],
    ['Por puesto', ['Código', 'Puesto', 'Calificación', 'Semáforo', 'KPI con dato', 'Calificación anterior'], r.puestos.map(p => [p.codigo, p.nombre, pct(p.calificacion), p.semaforo, `${p.con_dato} de ${p.total}`, pct(p.calificacion_anterior)])],
    ['KPI por puesto', encK, r.kpis.filter(k => k.tipo === 'Puesto').map(filaKpi)],
    ['Fuera de meta', encK, fueraDeMeta(r).map(filaKpi)],
  ];
  const wb = XLSX.utils.book_new();
  hojas.forEach(([nombre, enc, datos], n) => {
    const ws = hojaConIdentidad(ctx, enc, datos, n + 1, hojas.length, [[periodo]]);
    ws['!cols'] = enc.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  });
  return escribirLibro(wb);
}
