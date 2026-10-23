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
/** Roles: correo · rol (nunca UUID). */
const miembro = (r: Registro, ref: Referencias) => [txt(r.email) || ref[txt(r.user_id)] || 'Usuario', txt(r.role)].filter(Boolean).join(' · ');

export const MODULOS_AUDITADOS: Record<string, string> = {
  riesgos: 'Gestión de Riesgos',
  indicadores: 'Indicadores',
  tendencias: 'Análisis de Tendencias',
  cerebro: 'Cerebro Institucional',
  plataforma: 'Plataforma',
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
  org_folio_tipos: { modulo: 'riesgos', catalogo: 'Tipo de folio', registro: primero('codigo', 'nombre', 'tipo') },
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

const cer = (catalogo: string, ...campos: string[]): TablaAuditada => ({
  modulo: 'cerebro', catalogo, registro: primero(...campos, 'codigo', 'titulo', 'nombre', 'nombre_archivo'),
});
const plat = (catalogo: string, ...campos: string[]): TablaAuditada => ({
  modulo: 'plataforma', catalogo, registro: primero(...campos, 'codigo', 'nombre', 'titulo', 'email'),
});

Object.assign(TABLAS_AUDITADAS, {
  // Cerebro Institucional (también conserva su pantalla propia)
  brain_areas: cer('Área'), brain_processes: cer('Proceso'),
  brain_process_areas: cer('Proceso ↔ Área'), brain_assignment_processes: cer('Asignación ↔ Proceso'),
  brain_session_processes: cer('Entrevista ↔ Proceso'), brain_contradictions: cer('Contradicción', 'descripcion'),
  brain_documents: cer('Documento'), brain_enlace_descartes: cer('Enlace descartado'),
  brain_exports: cer('Exportación', 'formato'), brain_extracciones: cer('Extracción', 'nombre_archivo'),
  brain_gaps: cer('Brecha', 'descripcion'), brain_import_batches: cer('Importación', 'nombre_archivo'),
  brain_import_propuestas: cer('Propuesta de importación'), brain_interview_assignments: cer('Asignación de entrevista', 'tema'),
  brain_interview_sessions: cer('Entrevista', 'tema'), brain_knowledge_items: cer('Conocimiento'),
  brain_knowledge_sources: cer('Fuente de conocimiento'), brain_memoria_viva: cer('Memoria viva'),
  brain_vinculos: cer('Vínculo con otro módulo', 'tipo'),
  // Plataforma (visible siempre)
  profiles: plat('Perfil de usuario', 'nombre', 'email'),
  user_roles: { modulo: 'plataforma', catalogo: 'Rol de usuario', registro: (r, ref) => miembro(r, ref) },
  org_members: { modulo: 'plataforma', catalogo: 'Miembro de empresa', registro: (r, ref) => miembro(r, ref) },
  org_suplencias: plat('Suplencia', 'titular_nombre', 'rs_titular_nombre', 'rol_sustituido'),
  organizations: plat('Empresa', 'nombre'),
  organization_features: plat('Módulo de la empresa', 'feature_key'),
  modulos: plat('Catálogo de módulos', 'clave', 'nombre'),
  org_pendientes_semaforo: plat('Semáforo de pendientes', 'perfil'),
  documento_tipos: plat('Tipo de documento (Recursos)', 'codigo', 'nombre'),
  documento_tipos_config: plat('Configuración de tipos de documento'),
  org_documentos: plat('Documento (Recursos)', 'codigo', 'titulo', 'nombre_archivo'),
  auditorias_externas: plat('Auditoría externa', 'nombre', 'auditor_nombre', 'auditor_email'),
  auditoria_items: plat('Elemento de auditoría externa', 'titulo', 'tipo'),
  agent_prompts: plat('Skill de IA', 'clave', 'nombre', 'version'),
  ia_skills: plat('Skill de IA (catálogo)', 'clave', 'nombre'),
  ia_skill_pruebas: plat('Prueba de skill de IA', 'skill_clave', 'version'),
  ia_config_org: plat('Configuración de IA de la empresa'),
  cursos: plat('Curso', 'titulo', 'norma'),
  impersonation_logs: plat('Soporte (entrar como usuario)', 'motivo'),
  lead_magnet: plat('Registro de guía', 'email'),
  'auth.users': plat('Cuenta de acceso', 'email'),
} satisfies Record<string, TablaAuditada>);

export const tablasDeModulo = (modulo: string) =>
  Object.entries(TABLAS_AUDITADAS).filter(([, t]) => t.modulo === modulo).map(([k]) => k);

/** Campos que nunca se muestran en el detalle. */
export const CAMPOS_OCULTOS = new Set(['updated_at', 'created_at', 'org_id', 'id', 'updated_by', 'created_by']);
