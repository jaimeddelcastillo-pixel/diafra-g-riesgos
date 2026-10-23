/**
 * Registro de tipos de documento exportables (D1).
 * Cada exportación nueva solo agrega aquí su tipo; Configuración › Identidad documental
 * muestra y versiona el formato (código, versión, título, firmas) sin tocar la pantalla.
 */
export type RolFirma = 'Elaboró' | 'Revisó' | 'Autorizó';

export interface TipoDocumento {
  modulo: string;
  /** Título por omisión si la empresa aún no registra el formato. */
  titulo: string;
  /** Código sugerido (solo referencia; la empresa define el suyo). */
  codigoSugerido?: string;
  formato: 'PDF' | 'Excel' | 'Word';
  /** true = la exportación ya usa la librería compartida src/lib/documentos. */
  aplicado: boolean;
}

export const ROLES_FIRMA: RolFirma[] = ['Elaboró', 'Revisó', 'Autorizó'];

export const TIPOS_DOCUMENTO: Record<string, TipoDocumento> = {
  'indicadores.resultados_excel': { modulo: 'Indicadores', titulo: 'Resultados de indicadores', formato: 'Excel', aplicado: true },
  'indicadores.tablero_excel': { modulo: 'Indicadores', titulo: 'Tablero de indicadores', formato: 'Excel', aplicado: true },
  'indicadores.catalogo_excel': { modulo: 'Indicadores', titulo: 'Catálogo de indicadores', formato: 'Excel', aplicado: true },
  'auditoria.bitacora_pdf': { modulo: 'Auditoría general', titulo: 'Bitácora de auditoría', formato: 'PDF', aplicado: true },
  'auditoria.bitacora_excel': { modulo: 'Auditoría general', titulo: 'Bitácora de auditoría', formato: 'Excel', aplicado: true },
  // Solo catálogo: sus exportaciones aún no usan la identidad compartida.
  'riesgos.folio_pdf': { modulo: 'Gestión de Riesgos', titulo: 'Archivo maestro de gestión de riesgos', codigoSugerido: 'FOR-SGC-11-01', formato: 'PDF', aplicado: false },
  'riesgos.listado_folios_pdf': { modulo: 'Gestión de Riesgos', titulo: 'Listado de folios', formato: 'PDF', aplicado: false },
  'tendencias.reporte_word': { modulo: 'Análisis de Tendencias', titulo: 'Reporte de análisis de tendencias', codigoSugerido: 'FOR-VAL-16-02', formato: 'Word', aplicado: false },
  'tendencias.cumplimiento_pdf': { modulo: 'Análisis de Tendencias', titulo: 'Cumplimiento normativo', formato: 'PDF', aplicado: false },
  'tendencias.cumplimiento_excel': { modulo: 'Análisis de Tendencias', titulo: 'Cumplimiento normativo', formato: 'Excel', aplicado: false },
  'tendencias.registro_at_excel': { modulo: 'Análisis de Tendencias', titulo: 'Registro de reportes AT', formato: 'Excel', aplicado: false },
};

export type ClaveDocumento = keyof typeof TIPOS_DOCUMENTO;
