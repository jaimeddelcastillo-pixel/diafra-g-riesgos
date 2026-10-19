import type { FormatoForVal16 } from './formato-forval16';
export function identificadoresReporte(formato?: FormatoForVal16 | null) {
  const textos = formato?.textos as Record<string, string> | undefined;
  return {
    codigoFormato: textos?.codigoFormato || formato?.version_formato || 'Plantilla del reporte',
    codigoRegistro: textos?.codigoRegistro || 'Registro de reportes',
    versionRegistro: textos?.versionRegistro || '00',
    prefijoArchivos: textos?.prefijoArchivos || textos?.codigoFormato || formato?.version_formato || 'Analisis-de-tendencias',
  };
}
export function nombreArchivoReporte(prefijo: string, partes: (string | number | null | undefined)[], extension: string) {
  return [prefijo, ...partes].filter(v => v !== null && v !== undefined && v !== '')
    .map(v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').replace(/^_|_$/g, ''))
    .join('_') + '.' + extension;
}
export function siguienteCodigoAT(codigos: string[], anio: number) {
  const max = Math.max(0, ...codigos.filter(c => c.startsWith(`AT-${anio}-`)).map(c => Number(c.slice(8)) || 0));
  return `AT-${anio}-${String(max + 1).padStart(3, '0')}`;
}