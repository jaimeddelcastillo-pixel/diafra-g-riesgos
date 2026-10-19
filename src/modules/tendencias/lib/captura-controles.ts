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

/** Configuration/service failure (not caused by the photo itself). */
export function esErrorServicio(e: unknown): boolean {
  if (!(e instanceof Error) || !('status' in e) || typeof e.status !== 'number') return false;
  if (/propuesta|foto|registro no disponible/i.test(e.message)) return false;
  return [401, 402, 403, 404, 408, 429].includes(e.status) || e.status >= 500;
}
export type ResultadoLote = { detenido: 'usuario' | 'servicio' | 'terminal' | null; error?: string };
/** Isolate each failure; terminal blocks, a user stop, or two consecutive identical service errors stop remaining paid work. */
export async function procesarLote<T>(items: T[], procesar: (item: T) => Promise<void>, fallo: (item: T, error: unknown) => void, concurrencia = 1, detener?: () => boolean): Promise<ResultadoLote> {
  let siguiente = 0; let resultado: ResultadoLote = { detenido: null }; let ultimoServicio: string | null = null;
  const worker = async () => {
    while (!resultado.detenido && siguiente < items.length) {
      if (detener?.()) { resultado = { detenido: 'usuario' }; break; }
      const item = items[siguiente++];
      try { await procesar(item); ultimoServicio = null; }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (e instanceof Error && 'terminal' in e && e.terminal) resultado = { detenido: 'terminal', error: msg };
        else if (esErrorServicio(e)) { if (ultimoServicio === msg && !resultado.detenido) resultado = { detenido: 'servicio', error: msg }; ultimoServicio = msg; }
        else ultimoServicio = null;
        fallo(item, e);
      }
    }
  };
  await Promise.all(Array.from({length: Math.min(items.length, Math.max(1, Math.min(2, concurrencia)))}, worker));
  return resultado;
}
/** Foto subida/tomada pendiente de extraer; ligada al registro donde se tomó. */
export type FotoPendiente = { path: string; registroId: string; id: number };
/** Solo extrae una foto nueva del mismo registro y no consumida; un cambio de selección nunca reenvía. */
export function fotoParaExtraer(p: FotoPendiente | undefined, registroId: string, consumida?: number): string | undefined {
  return p && p.registroId === registroId && p.id !== consumida ? p.path : undefined;
}
