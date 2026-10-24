import { kpisDelAlcance, etiquetaSub, type Reporte } from './word.ts';

const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] ?? c));

/** Server-rendered editable SVG with a PNG fallback; data and meta come only from the frozen summary. */
export function charts(r: Reporte): Record<string, Uint8Array> {
  if (!r.datos_snapshot) throw new Error('Falta el resumen congelado');
  return Object.fromEntries(kpisDelAlcance(r, r.datos_snapshot).filter(k => k.tipo === 'SGC' && k.nivel === 'SGC' && k.subperiodos.length).map(k => {
    const max = Math.max(1, k.meta, ...k.subperiodos.map(s => s.valor ?? 0));
    const y = (v: number) => 940 - v / max * 780;
    const width = 1600 / k.subperiodos.length;
    const bars = k.subperiodos.map((s, j) => `<rect x="${160 + j * width + width * .15}" y="${y(s.valor ?? 0)}" width="${width * .7}" height="${940 - y(s.valor ?? 0)}" fill="${s.semaforo === 'verde' ? '#16a34a' : s.semaforo === 'amarillo' ? '#d97706' : s.semaforo === 'rojo' ? '#dc2626' : '#9ca3af'}"/><text x="${160 + (j + .5) * width}" y="980" text-anchor="middle">${escape(etiquetaSub(k.frecuencia, s.inicio))}</text><text x="${160 + (j + .5) * width}" y="${y(s.valor ?? 0) - 12}" text-anchor="middle">${s.valor ?? '—'}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1890" height="1063" viewBox="0 0 1890 1063"><rect width="1890" height="1063" fill="white"/><g font-family="Calibri,Arial" font-size="30" fill="#1f3a5f"><text x="945" y="65" text-anchor="middle">${escape(k.codigo + ' · ' + k.nombre)}</text><line x1="160" y1="940" x2="1760" y2="940" stroke="#d1d5db"/><line x1="160" y1="${y(k.meta)}" x2="1760" y2="${y(k.meta)}" stroke="#1f3a5f" stroke-dasharray="12 8"/>${bars}<text x="945" y="1040" text-anchor="middle">Meta ${k.meta} ${escape(k.unidad)}</text></g></svg>`;
    return [k.id, new TextEncoder().encode(svg)];
  }));
}

