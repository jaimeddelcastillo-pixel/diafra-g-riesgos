import { CAMPOS_OCULTOS, MODULOS_AUDITADOS, TABLAS_AUDITADAS, tablasDeModulo, type Referencias, type Registro } from '@/config/auditoria';

/** Roles que ven la Auditoría general (super_admin la ve en soporte, solo lectura). */
export const ROLES_AUDITORIA = ['admin', 'responsable_sanitario', 'comite_tecnico', 'aseguramiento_calidad'];

export interface EventoAuditoria {
  id: string; created_at: string; user_id: string | null; tabla: string; registro_id: string | null;
  accion: string; valor_anterior: Registro | null; valor_nuevo: Registro | null; motivo: string | null;
  origen: string | null; solicitado_por: string | null; autorizado_por: string | null; suplencias?: unknown;
}
export interface FiltrosAuditoria { modulo: string; catalogo: string; codigo: string; persona: string; desde: string; hasta: string }
export const FILTROS_VACIOS: FiltrosAuditoria = { modulo: '', catalogo: '', codigo: '', persona: '', desde: '', hasta: '' };
export const COLUMNAS_AUDITORIA = 'id, created_at, user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, motivo, origen, solicitado_por, autorizado_por, suplencias';

const OTRAS: Record<string, string> = {
  DELETE: 'Baja', REGISTRO_RETIRADO: 'Retiro', SEMANA_CORREGIDA: 'Semana corregida',
  CATALOGO_EXCEL: 'Importación de catálogo (Excel)', REORDENAR_IDS: 'Reordenar IDs', RECOMPACTAR_IDS: 'Recompactar IDs',
  SOLICITUD_VOTACION: 'Solicitud de votación', IMPORTACION_REVERTIDA: 'Importación revertida',
};

/** Alta, Cambio, Retiro (activo pasa a No), Validación (estado pasa a validado), Regreso a borrador. */
export function accionLegible(e: Pick<EventoAuditoria, 'accion' | 'valor_anterior' | 'valor_nuevo'>): string {
  if (e.accion === 'INSERT') return 'Alta';
  if (e.accion === 'UPDATE') {
    const a = e.valor_anterior ?? {}, n = e.valor_nuevo ?? {};
    if (a.activo !== false && n.activo === false) return 'Retiro';
    if (n.estado === 'validado' && a.estado !== 'validado') return 'Validación';
    if (a.estado === 'validado' && n.estado === 'borrador') return 'Regreso a borrador';
    return 'Cambio';
  }
  return OTRAS[e.accion] ?? e.accion.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

const legible = (v: unknown, ref: Referencias): string => {
  if (v === null || v === undefined || v === '') return '∅';
  if (typeof v === 'string' && ref[v]) return ref[v];
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

export interface CambioCampo { campo: string; antes: string; despues: string }
/** Solo los campos que cambiaron; los id referenciados se muestran como código. */
export function cambiosEvento(e: EventoAuditoria, ref: Referencias = {}): CambioCampo[] {
  const a = e.valor_anterior, n = e.valor_nuevo ?? {};
  if (!a || !Object.keys(a).length) return [];
  return Object.keys({ ...a, ...n })
    .filter((k) => !CAMPOS_OCULTOS.has(k) && JSON.stringify(a[k]) !== JSON.stringify(n[k]))
    .map((k) => ({ campo: k.replace(/_id$/, ''), antes: legible(a[k], ref), despues: legible(n[k], ref) }));
}

export function registroEvento(e: EventoAuditoria, ref: Referencias = {}): string {
  const r = { ...(e.valor_anterior ?? {}), ...(e.valor_nuevo ?? {}) };
  const t = TABLAS_AUDITADAS[e.tabla];
  return (t?.registro(r, ref) || String(r.codigo ?? r.nombre ?? '')).trim() || '—';
}
export const catalogoEvento = (tabla: string) => TABLAS_AUDITADAS[tabla]?.catalogo ?? tabla;
export const moduloEvento = (tabla: string) => MODULOS_AUDITADOS[TABLAS_AUDITADAS[tabla]?.modulo ?? ''] ?? '—';

/** Titulares a nombre de quienes actuó un suplente. */
export const titularesSuplencia = (e: Pick<EventoAuditoria, 'suplencias'>): string[] =>
  Array.isArray(e.suplencias) ? e.suplencias.map((s) => (s as { titular_nombre?: string })?.titular_nombre).filter((x): x is string => !!x) : [];

const limpiar = (s: string) => s.replace(/[,()*%:"\\]/g, ' ').trim();

/** Filtros del lado del servidor: módulo, catálogo, código, usuario y fechas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarFiltrosAuditoria<Q extends Record<string, any>>(q: Q, orgId: string, f: FiltrosAuditoria, ref: Referencias = {}): Q {
  const tablas = f.catalogo ? [f.catalogo] : f.modulo ? tablasDeModulo(f.modulo) : Object.keys(TABLAS_AUDITADAS);
  q = q.eq('org_id', orgId).in('tabla', tablas);
  if (f.persona) q = q.eq('user_id', f.persona);
  if (f.desde) q = q.gte('created_at', new Date(f.desde + 'T00:00:00').toISOString());
  if (f.hasta) q = q.lte('created_at', new Date(f.hasta + 'T23:59:59.999').toISOString());
  const c = limpiar(f.codigo);
  if (c) {
    const partes = ['valor_nuevo', 'valor_anterior'].flatMap((col) => [`${col}->>codigo.ilike.*${c}*`, `${col}->>nombre.ilike.*${c}*`]);
    const ids = Object.entries(ref).filter(([, cod]) => cod.toLocaleLowerCase('es').includes(c.toLocaleLowerCase('es'))).map(([id]) => id).slice(0, 40);
    for (const id of ids) for (const campo of ['kpi_puesto_id', 'kpi_definicion_id', 'folio_id']) partes.push(`valor_nuevo->>${campo}.eq.${id}`, `valor_anterior->>${campo}.eq.${id}`);
    q = q.or(partes.join(','));
  }
  return q.order('created_at', { ascending: false }).order('id', { ascending: false });
}
