export type ConocimientoContexto = {
  id: string; codigo: string; tipo: string; contenido: string;
  area: string | null; proceso: string | null;
  fuente: { codigo?: string | null; revision?: string | null; pagina?: number | null; nombre?: string | null };
  validado_por: string | null; validado_en: string | null;
};

export function fuenteConocimiento(f: ConocimientoContexto['fuente']): string {
  return [f?.codigo ?? f?.nombre, f?.revision ? `rev ${f.revision}` : null, f?.pagina ? `p. ${f.pagina}` : null].filter(Boolean).join(' ') || '—';
}

export function bloqueConocimiento(items: ConocimientoContexto[]): string {
  const linea = (s: string | null | undefined) => (s ?? '—').replace(/[\r\n]+/g, ' ');
  return '[CONOCIMIENTO_EMPRESA]\n' + items.map(k =>
    `${k.codigo} · ${k.tipo} · ${linea([k.area, k.proceso].filter(Boolean).join('/'))} · ${linea(k.contenido)} · Fuente: ${linea(fuenteConocimiento(k.fuente))} · Validó: ${linea(k.validado_por)}, ${k.validado_en ?? '—'}`
  ).join('\n');
}

export function trazaConocimiento(items: ConocimientoContexto[]) {
  return items.map(({ id, codigo, validado_en }) => ({ id, codigo, validado_en }));
}