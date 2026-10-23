/**
 * Registro de tablas auditadas por módulo (K1-a).
 * Cada módulo nuevo solo agrega aquí sus tablas: la Auditoría general las muestra,
 * filtra y exporta sin tocar la pantalla. Nunca mostrar UUID como registro.
 */
export type Registro = Record<string, unknown>;
/** id → código de los catálogos que se referencian por id (puestos, KPI…). */
export type Referencias = Record<string, string>;

export interface TablaAuditada {
  modulo: string;
  /** Catálogo / tipo de registro legible. */
  catalogo: string;
  /** Texto del registro (código o nombre). */
  registro: (r: Registro, ref: Referencias) => string;
}

const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));
const primero = (...campos: string[]) => (r: Registro) => campos.map((c) => txt(r[c])).find(Boolean) ?? '';

export const MODULOS_AUDITADOS: Record<string, string> = {
  riesgos: 'Gestión de Riesgos',
  indicadores: 'Indicadores',
  tendencias: 'Análisis de Tendencias',
};

const tend = (catalogo: string, ...campos: string[]): TablaAuditada => ({
  modulo: 'tendencias', catalogo, registro: primero(...campos, 'codigo', 'nombre'),
});

export const TABLAS_AUDITADAS: Record<string, TablaAuditada> = {
  // Gestión de Riesgos
  folios: { modulo: 'riesgos', catalogo: 'Folio', registro: primero('codigo', 'titulo', 'producto') },
  riesgos: { modulo: 'riesgos', catalogo: 'Riesgo', registro: (r, ref) => [ref[txt(r.folio_id)], txt(r.id_riesgo ?? r.numero), txt(r.peligro_modo_falla)].filter(Boolean).join(' · ') },
  folio_comite: { modulo: 'riesgos', catalogo: 'Comité del folio', registro: (r, ref) => [ref[txt(r.folio_id)], txt(r.nombre ?? r.rol)].filter(Boolean).join(' · ') },
  folio_versiones: { modulo: 'riesgos', catalogo: 'Versión de folio', registro: (r, ref) => [ref[txt(r.folio_id)], r.version != null ? `v${r.version}` : ''].filter(Boolean).join(' · ') },
  comite_comentarios: { modulo: 'riesgos', catalogo: 'Comentario de comité', registro: (r, ref) => ref[txt(r.folio_id)] ?? '' },
  comite_votos: { modulo: 'riesgos', catalogo: 'Voto de comité', registro: (r, ref) => [ref[txt(r.folio_id)], txt(r.voto)].filter(Boolean).join(' · ') },
  // Indicadores
  puestos: { modulo: 'indicadores', catalogo: 'Puestos', registro: primero('codigo', 'nombre') },
  kpi_definiciones: { modulo: 'indicadores', catalogo: 'KPI del SGC', registro: primero('codigo', 'nombre') },
  kpi_puesto: { modulo: 'indicadores', catalogo: 'KPI por puesto', registro: primero('codigo', 'nombre') },
  kpi_puesto_aporta: {
    modulo: 'indicadores', catalogo: 'Aportación de KPI',
    registro: (r, ref) => `${ref[txt(r.kpi_puesto_id)] ?? '¿?'} aporta a ${ref[txt(r.kpi_definicion_id)] ?? '¿?'}`,
  },
  // Análisis de Tendencias (su pantalla propia no cambia)
  tend_sistemas_hvac: tend('Sistema HVAC'),
  tend_areas: tend('Área'),
  tend_instrumentos: tend('Instrumento'),
  tend_objetivos_presion: tend('Objetivo de presión'),
  tend_cambios_filtro: tend('Cambio de filtro', 'fecha'),
  tend_registros: tend('Registro', 'fecha'),
  tend_semanas: tend('Semana de lecturas', 'semana_inicio'),
  tend_registros_at: tend('Reporte AT', 'folio'),
  tend_registros_at_historial: tend('Historial de reporte AT', 'folio'),
  tend_formato: tend('Plantilla del reporte'),
  tend_config: tend('Configuración'),
  tend_extracciones: tend('Extracción de bitácora', 'nombre_archivo'),
  tend_norma_especificaciones: tend('Catálogo normativo', 'clase'),
};

export const tablasDeModulo = (modulo: string) =>
  Object.entries(TABLAS_AUDITADAS).filter(([, t]) => t.modulo === modulo).map(([k]) => k);

/** Campos que nunca se muestran en el detalle. */
export const CAMPOS_OCULTOS = new Set(['updated_at', 'created_at', 'org_id', 'id', 'updated_by', 'created_by']);
