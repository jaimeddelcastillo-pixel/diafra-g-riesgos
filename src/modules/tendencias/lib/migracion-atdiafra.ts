// F4a: migración atdiafra → TRACEA. Lógica pura: vista previa, mapeo de campos, snapshots e informe.
// Nada aquí escribe en la base de datos; la escritura es una sola transacción vía RPC tend_importar_atdiafra.
import { revisarInstrumento, pareceDescripcionEquipo, type NormaEspecificacion, type Hallazgo } from './norma';
import type { Instrumento } from './catalogos';
import { TABLA_APENDICE_A } from './apendice-a';

export const TABLAS_MIGRACION = [
  'tend_sistemas_hvac', 'tend_areas', 'tend_instrumentos', 'tend_objetivos_presion', 'tend_cambios_filtro',
  'tend_registros', 'tend_semanas', 'tend_registros_at', 'tend_registros_at_historial', 'tend_extracciones', 'tend_formato',
] as const;
export type TablaMigracion = (typeof TABLAS_MIGRACION)[number];

export interface Respaldo {
  manifest: { tablas: Record<string, number>; usuarios?: string[]; generado_en?: string };
  tablas: Partial<Record<TablaMigracion, Record<string, unknown>[]>>;
  fotos: Record<string, Blob>; // ruta original → contenido
}

export interface Exclusion { tabla: TablaMigracion; id: string; nombre: string; motivo: string }

export interface Sospechoso { codigo: string; hallazgos: Hallazgo[] }

export interface VistaPrevia {
  conteos: { tabla: TablaMigracion; respaldo: number; manifest: number; cuadra: boolean }[];
  usuariosFaltantes: string[];
  excluibles: { tabla: TablaMigracion; id: string; nombre: string }[];
  sospechosos: Sospechoso[];
}

const nombreFila = (tabla: string, r: Record<string, unknown>): string =>
  String(r.codigo ?? r.nombre ?? r.semana_inicio ?? r.id ?? tabla);

/** Conteos del respaldo contra el manifest, usuarios faltantes, excluibles y sospechosos del catálogo. */
export function vistaPrevia(respaldo: Respaldo, correosMiembros: string[], normas: NormaEspecificacion[]): VistaPrevia {
  const conteos = TABLAS_MIGRACION.map((tabla) => {
    const respaldoN = respaldo.tablas[tabla]?.length ?? 0;
    const manifestN = respaldo.manifest.tablas[tabla] ?? 0;
    return { tabla, respaldo: respaldoN, manifest: manifestN, cuadra: respaldoN === manifestN };
  });
  const miembros = new Set(correosMiembros.map((c) => c.trim().toLowerCase()));
  const usuariosFaltantes = (respaldo.manifest.usuarios ?? []).filter((c) => !miembros.has(c.trim().toLowerCase()));
  const excluibles = (['tend_registros_at', 'tend_registros', 'tend_semanas'] as const).flatMap((tabla) =>
    (respaldo.tablas[tabla] ?? []).map((r) => ({ tabla, id: String(r.id), nombre: nombreFila(tabla, r) })));
  const sospechosos = (respaldo.tablas.tend_instrumentos ?? [])
    .filter((i) => i.activo !== false)
    .map((i) => ({ codigo: String(i.codigo ?? i.id), hallazgos: revisarInstrumento(i as unknown as Instrumento, null, null, normas) }))
    .filter((s) => s.hallazgos.length > 0);
  return { conteos, usuariosFaltantes, excluibles, sospechosos };
}

/** Quita las filas excluidas (con su motivo) y las semanas de registros excluidos. */
export function aplicarExclusiones(respaldo: Respaldo, excluidas: Exclusion[]): Respaldo {
  const porTabla = new Map<string, Set<string>>();
  for (const e of excluidas) porTabla.set(e.tabla, new Set([...(porTabla.get(e.tabla) ?? []), e.id]));
  const registrosFuera = porTabla.get('tend_registros') ?? new Set<string>();
  const tablas = { ...respaldo.tablas };
  for (const [tabla, ids] of porTabla) {
    tablas[tabla as TablaMigracion] = (tablas[tabla as TablaMigracion] ?? []).filter((r) => !ids.has(String(r.id)));
  }
  tablas.tend_semanas = (tablas.tend_semanas ?? []).filter((r) => !registrosFuera.has(String(r.registro_id)));
  return { ...respaldo, tablas };
}

/** Mapeo de campos del instrumento: LIE/LSE antiguos → rango de operación; descripción de equipo copiada (sin borrar). */
export function mapearInstrumento(i: Record<string, unknown>): Record<string, unknown> {
  const m = { ...i };
  m.op_min_pa = i.lie_pa ?? null;
  m.op_max_pa = i.lse_pa ?? null;
  m.lie_pa = null;
  m.lse_pa = null;
  const texto = String(i.spec_texto ?? i.especificacion ?? '');
  if (pareceDescripcionEquipo(texto) && !m.descripcion_equipo) m.descripcion_equipo = texto;
  return m;
}

/** Apéndice A común; los criterios internos pertenecen al instrumento, no a la tabla normativa. */
export function tablaIsoNom241(): string {
  return TABLA_APENDICE_A;
}

/** Reconstruye formato_snapshot y datos_snapshot de un AT emitido con los datos migrados de su periodo y selección. */
export function construirSnapshotAT(
  at: Record<string, unknown>,
  registros: Record<string, unknown>[],
  semanas: Record<string, unknown>[],
  formato: Record<string, unknown> | null,
): Record<string, unknown> {
  const seleccion = (at.seleccion as { ids?: string[] } | null) ?? null;
  const ids = new Set(seleccion?.ids ?? []);
  const desde = String(at.periodo_desde ?? '');
  const hasta = String(at.periodo_hasta ?? '');
  const regs = registros
    .filter((r) => (ids.size ? ids.has(String(r.id)) : true))
    .map((r) => ({
      ...r,
      semanas: semanas.filter((s) => String(s.registro_id) === String(r.id) && s.activo !== false
        && (!desde || String(s.semana_inicio) >= desde) && (!hasta || String(s.semana_inicio) <= hasta)),
    }));
  return {
    ...at,
    datos_snapshot: at.datos_snapshot ?? { registros: regs, periodo_desde: desde, periodo_hasta: hasta },
    formato_snapshot: at.formato_snapshot ?? formato,
  };
}

/** Verificación final: conteos importados contra el manifest descontando lo excluido. Lanza si no cuadra (la transacción revierte). */
export function verificarConteos(respaldo: Respaldo, excluidas: Exclusion[]): Record<string, number> {
  const esperados: Record<string, number> = {};
  for (const tabla of TABLAS_MIGRACION) {
    const excluidasN = excluidas.filter((e) => e.tabla === tabla).length
      + (tabla === 'tend_semanas'
        ? (respaldo.tablas.tend_semanas ?? []).filter((s) => excluidas.some((e) => e.tabla === 'tend_registros' && e.id === String(s.registro_id))).length
        : 0);
    esperados[tabla] = (respaldo.manifest.tablas[tabla] ?? 0) - excluidasN;
    const reales = aplicarExclusiones(respaldo, excluidas).tablas[tabla]?.length ?? 0;
    if (reales !== esperados[tabla]) throw new Error(`Conteo no cuadra en ${tabla}: esperado ${esperados[tabla]}, en paquete ${reales}`);
  }
  return esperados;
}

export interface Informe {
  conteos: Record<string, number>;
  excluidos: Exclusion[];
  sospechosos: Sospechoso[];
  snapshotsReconstruidos: string[];
}

export function construirInforme(respaldo: Respaldo, excluidas: Exclusion[], sospechosos: Sospechoso[], snapshots: string[]): Informe {
  return { conteos: verificarConteos(respaldo, excluidas), excluidos: excluidas, sospechosos, snapshotsReconstruidos: snapshots };
}
