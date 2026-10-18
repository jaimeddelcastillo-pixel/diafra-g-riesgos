import { DIAS, type Dia, type Semana } from './semanas';

export function tieneLecturas(s?: Semana | null): boolean {
  return !!s && [...s.lecturas, ...(s.lecturas_hr ?? [])].some(p => p.valor !== null && Number.isFinite(p.valor));
}

/** Original atdiafra: move only values, retaining the destination's time and antefirma. */
export function accionDia(s: Semana, dia: Dia, accion: 'na' | 'limpiar' | -1 | 1): Semana {
  const destino = typeof accion === 'number' ? DIAS[DIAS.indexOf(dia) + accion] : undefined;
  if (typeof accion === 'number' && !destino) return s;
  const na = !s.lecturas.filter(p => p.dia === dia).every(p => p._na);
  const aplicar = (arr: Semana['lecturas']) => arr.map(p => {
    if (p.dia === destino) {
      const origen = arr.find(o => o.dia === dia && o.turno === p.turno);
      return { ...p, valor: origen?.valor ?? null, _dudoso: false, _edited: true, _motivo: p._motivo ?? 'Recorrido manual' };
    }
    if (p.dia !== dia) return p;
    if (accion === 'na') return { ...p, _na: na, valor: na ? null : p.valor, _edited: true };
    return { ...p, valor: null, _dudoso: false, _edited: true };
  });
  return { ...s, lecturas: aplicar(s.lecturas), lecturas_hr: s.lecturas_hr ? aplicar(s.lecturas_hr) : undefined };
}

export function duplicadosLote(items: { incluir: boolean; registro: string; lunes: string }[]): Set<string> {
  const vistos = new Set<string>(); const duplicados = new Set<string>();
  for (const item of items.filter(i => i.incluir && i.lunes)) {
    const key = `${item.registro}/${item.lunes}`;
    if (vistos.has(key)) duplicados.add(key);
    vistos.add(key);
  }
  return duplicados;
}

/** Isolate each failure; terminal account blocks stop the remaining paid work. */
export async function procesarLote<T>(items: T[], procesar: (item: T) => Promise<void>, fallo: (item: T, error: unknown) => void): Promise<void> {
  for (const item of items) {
    try { await procesar(item); }
    catch (e) { fallo(item, e); if (e instanceof Error && 'terminal' in e && e.terminal) break; }
  }
}