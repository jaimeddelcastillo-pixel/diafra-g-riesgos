import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { construirContexto } from '@/lib/documentos';
import { charts } from '../../../../supabase/functions/emitir-kpi-word/charts';
import { periodosCerrados } from './tablero';
import { construirWordReporte, textosReporte, textoTendencia, notaVigilancia, periodoLegible, contextoEmitido, descargarOriginal, lineaFirma, type Reporte } from './reportes';
import { supabase } from '@/integrations/supabase/client';
import type { Resumen } from './tablero';

const kpi = { id: 'k1', tabla: 'kpi_definiciones' as const, tipo: 'SGC' as const, codigo: 'A', nombre: 'QA rojo', proceso: 'Calidad', nivel: 'SGC', puesto_id: null, frecuencia: 'mensual', unidad: '%', tendencia: 'positiva', peso: 100, meta: 95, meta_cambio: false, metas: [95],
  subperiodos: [{ inicio: '2026-01-01', fin: '2026-01-31', numerador: 50, denominador: 100, valor: 50, cumplimiento: 0.526, semaforo: 'rojo', meta: 95 }], resultados: 1, valor: 50, cumplimiento: 0.526, semaforo: 'rojo', valor_anterior: null, tendencia_periodo: null };
const resumen: Resumen = { tipo: 'trimestre', inicio: '2026-01-01', fin: '2026-03-31', anterior: { inicio: '2025-10-01', fin: '2025-12-31' }, kpis: [kpi], puestos: [],
  indice_sgc: { indice: 0.526, semaforo: 'rojo', indice_anterior: null, semaforo_anterior: null, con_dato: 1, total: 1, verde: 0, amarillo: 0, rojo: 1, sin_base: 0, sin_captura: 0 }, procesos: [{ proceso: 'Calidad', indice: 0.526, semaforo: 'rojo', con_dato: 1, total: 1 }] };
const firmantes = { elaboro: { user_id: 'u2', nombre: 'QA Elabora', cargo: 'Analista', fecha: '2026-04-02T18:00:00Z' }, revisaron: [{ user_id: 'u1', nombre: 'QA RS', cargo: 'RS', fecha: '2026-04-03T18:00:00Z' }],
  autorizo: { user_id: 'u4', nombre: 'QA Designado', cargo: 'Gerente', fecha: '2026-04-04T18:00:00Z', leyenda: ', en ausencia de Aseguramiento de Calidad' } };
const reporte = { id: 'r1', codigo: 'IND-2026-001', version: 1, estado: 'emitido', etapa: 'cerrado', tipo_periodo: 'trimestre', periodo_inicio: '2026-01-01', periodo_fin: '2026-03-31', alcance_procesos: [], alcance_puestos: [],
  objetivo: 'QA objetivo', alcance: 'QA alcance', metodologia: 'QA metodología', analisis: { k1: { causa: 'QA causa', accion: 'QA acción', capa: 'CAPA-1' } }, conclusiones: 'QA conclusiones',
  elaboro_por: 'u2', revisores: ['u1'], revisiones: [], firmantes, formato_snapshot: { tipo: 'indicadores.reporte_word', folio: 'DOC-2026-000123', generado_en: '2026-04-04T18:00:00Z', formato: null, identidad: null },
  datos_snapshot: resumen, emitido_en: '2026-04-04T18:00:00Z', anulado_en: null, motivo_anulacion: null, updated_at: '' } as unknown as Reporte;
const ctx = construirContexto('indicadores.reporte_word', { folio: 'DOC-2026-000123', generado_en: '2026-04-04T18:00:00Z', formato: null, identidad: null }, { empresa: 'QA Empresa', generadoPor: 'QA Designado', logo: null });
const xml = async (borrador: boolean) => {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(construirWordReporte({ ctx, reporte, resumen, firmantes, graficas: { k1: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) }, borrador })));
  const header = Object.keys(zip.files).filter(f => /word\/(header|footer)\d*\.xml/.test(f)).sort();
  // docx numbers drawing ids (docPr) with a process-wide counter; they are internal ids, not content.
  return [await zip.file('word/document.xml')?.async('string'), ...(await Promise.all(header.map(f => zip.file(f)?.async('string'))))].join('\n').replace(/docPr id="\d+"/g, 'docPr id="N"');
};

describe('K3-b Word del reporte', () => {
  it('cambiar el logo actual no altera los bytes descargados del Word emitido ni el logo congelado', async () => {
    const logoOriginal = { format: 'PNG' as const, dataUrl: 'data:image/png;base64,ORIGINAL' };
    const issued: Reporte = { ...reporte, formato_snapshot: { ...reporte.formato_snapshot, tipo: 'indicadores.reporte_word', folio: 'DOC-2026-000123', generado_en: '2026-04-04T18:00:00Z', formato: null, identidad: null, logo: logoOriginal, archivo_path: 'qa/DOC-2026-000123.docx' } };
    const original = new Blob(['Word original con logo A']);
    const download = vi.fn().mockResolvedValue({ data: original, error: null });
    const storage = vi.spyOn(supabase.storage, 'from').mockReturnValue({ download } as unknown as ReturnType<typeof supabase.storage.from>);
    try {
      const before = await descargarOriginal(issued);
      const changedLogo = { format: 'PNG' as const, dataUrl: 'data:image/png;base64,NUEVO' };
      expect(contextoEmitido(issued, { empresa: 'QA Empresa', logo: changedLogo }).logo).toEqual(logoOriginal);
      const after = await descargarOriginal(issued);
      expect(after).toBe(before);
      expect(download.mock.calls).toEqual([['qa/DOC-2026-000123.docx'], ['qa/DOC-2026-000123.docx']]);
    } finally { storage.mockRestore(); }
  });
  it('el Word de un emitido es idéntico al regenerarlo', async () => {
    const a = await xml(false); const b = await xml(false);
    expect(a).toBe(b);
    expect(a).toContain('DOC-2026-000123');
    expect(a).not.toContain('BORRADOR');
  });
  it('un borrador lleva la marca de agua «BORRADOR»', async () => { expect(await xml(true)).toContain('BORRADOR'); });
  it('leyendas de ausencia y suplencia en la firma', () => {
    expect(lineaFirma(firmantes.autorizo)).toBe('QA Designado — Gerente, en ausencia de Aseguramiento de Calidad');
    expect(lineaFirma({ ...firmantes.autorizo, leyenda: '— En suplencia de QA AC' })).toBe('QA Designado — Gerente — En suplencia de QA AC');
  });
});

const leerWord = async (entrada: Parameters<typeof construirWordReporte>[0]) => {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(construirWordReporte(entrada)));
  return (await Promise.all(Object.keys(zip.files).filter(f => /word\/(document|header\d*|footer\d*)\.xml/.test(f)).map(f => zip.file(f)?.async('string')))).join('\n');
};
const entrada = { ctx, reporte, resumen, firmantes, graficas: {}, borrador: false };
describe('K3-b-2 periodos y Word', () => {
  it('solo ofrece semestre y año cerrados al 23 de octubre de 2026', () => {
    const hoy = new Date('2026-10-23T12:00:00');
    expect(periodosCerrados('semestre', 1, hoy)[0].inicio).toBe('2026-01-01');
    expect(periodosCerrados('año', 1, hoy)[0].inicio).toBe('2025-01-01');
    expect(periodoLegible('trimestre', '2026-07-01', '2026-09-30')).toBe('T3 2026 (1 jul – 30 sep 2026)');
  });
  it('textos fijos solo sustituyen borradores y no cambian emitidos', () => {
    const cfg = { version: 2, objetivo: 'Vigente', alcance: 'SGC', metodologia: '1. Medir\n2. Revisar', autorizadores: [], textos_fijos: true };
    expect(textosReporte({ ...reporte, estado: 'borrador' }, cfg).metodologia).toBe('1. Medir\n2. Revisar');
    expect(textosReporte(reporte, cfg).objetivo).toBe('QA objetivo');
    expect(textosReporte({ ...reporte, estado: 'borrador' }, { ...cfg, textos_fijos: false }).objetivo).toBe('QA objetivo');
  });
  it('conserva líneas numeradas de metodología en párrafos separados', async () => {
    const contenido = await leerWord({ ...entrada, reporte: { ...reporte, metodologia: '1. Medir\n2. Revisar' } });
    expect(contenido).toMatch(/1\. Medir<\/w:t>[\s\S]*?<\/w:p><w:p[\s\S]*?2\. Revisar/);
  });
  it('encabezado muestra código, versión y vigencia; pie conserva leyendas', async () => {
    const contenido = await leerWord({ ...entrada, ctx: { ...ctx, codigo: 'FOR-IND-01', version: '02', vigencia: '1 ene 2026', leyendas: ['Confidencial', 'Copia no controlada'] } });
    for (const texto of ['Código: FOR-IND-01', 'Versión: 02', 'Vigente desde: 1 ene 2026', 'Confidencial', 'Copia no controlada', 'Generado por']) expect(contenido).toContain(texto);
    expect(contenido).not.toContain('Formato sin configurar');
  });
  it('formato ausente se señala y borrador no lleva DOC', async () => {
    const contenido = await leerWord({ ...entrada, borrador: true });
    expect(contenido).toContain('Formato sin configurar');
    expect(contenido).toContain('BORRADOR · sin folio');
    expect(contenido).not.toContain('DOC-2026-000123');
    expect(await leerWord(entrada)).toContain('DOC-2026-000123');
  });
  it('KPI negativo que sube empeora; cuando baja mejora', () => {
    expect(textoTendencia({ ...kpi, tendencia: 'negativa', valor_anterior: 4.32, valor: 5.13 })).toBe('4.32 → 5.13 · empeoró');
    expect(textoTendencia({ ...kpi, tendencia: 'negativa', valor_anterior: 5.13, valor: 4.32 })).toBe('5.13 → 4.32 · mejoró');
  });
  it('barra de cero incluye etiqueta numérica explícita', () => {
    const datos = { ...resumen, kpis: [{ ...kpi, subperiodos: [{ ...kpi.subperiodos[0], valor: 0 }] }] };
    const svg = new TextDecoder().decode(charts({ ...reporte, datos_snapshot: datos }).k1);
    expect(svg).toMatch(/text-anchor="middle">0<\/text>/);
    expect(svg).not.toContain('>—</text>');
  });
  it('vigilancia debajo de KPI verde incluye subperiodo rojo', async () => {
    const k = { ...kpi, semaforo: 'verde', subperiodos: [{ ...kpi.subperiodos[0], inicio: '2026-09-01', valor: 10 }] };
    expect(notaVigilancia(k)).toBe('Sep en rojo (10 %); acumulado en meta');
    expect(notaVigilancia({ ...k, semaforo: 'rojo' })).toBe('');
    expect(await leerWord({ ...entrada, resumen: { ...resumen, kpis: [k] } })).toContain('Sep en rojo (10 %); acumulado en meta');
  });
  it('tablas repiten encabezados, no parten filas y usan hoja horizontal', async () => {
    const contenido = await leerWord(entrada);
    expect(contenido).toContain('<w:tblHeader');
    expect(contenido).toContain('<w:cantSplit');
    expect(contenido).toContain('w:orient="landscape"');
  });
  it('firma manual con dos renglones y fecha electrónica solo en emitido', async () => {
    const emitido = await leerWord(entrada); const borrador = await leerWord({ ...entrada, borrador: true });
    expect(emitido).toContain('Firma: ________________________');
    expect(emitido).toContain('Fecha: ________________________');
    expect(emitido).toContain('Firma electrónica:');
    expect(borrador).toContain('QA RS (asignado)');
    expect(borrador).not.toContain('Firma electrónica:');
  });
});
