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

export type DiagnosticoCerebro = {
  elementos: number; codigos: string[];
  motivo?: "interruptor_apagado" | "sin_modulo" | "sin_coincidencias" | "skill_sin_version" | "composicion_monolitica";
};

export function diagnosticoCerebro(items: ConocimientoContexto[], motivo?: DiagnosticoCerebro["motivo"]): DiagnosticoCerebro {
  return { elementos: items.length, codigos: items.map(k => k.codigo), ...(motivo ? { motivo } : {}) };
}

export function textoBusquedaCerebro(proceso: unknown, contexto: unknown, mensaje: unknown): string {
  const etapa = typeof contexto === "string" ? contexto.match(/(?:^|\n)\s*[•*-]?\s*Etapa:\s*([^\n]+)/i)?.[1]?.trim() : "";
  return [typeof proceso === "string" ? proceso : "", etapa === "—" ? "" : etapa,
    typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje ?? "")].filter(Boolean).join(" ").slice(0, 10000);
}