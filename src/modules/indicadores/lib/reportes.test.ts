import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { construirContexto } from '@/lib/documentos';
import { construirWordReporte, lineaFirma, type Reporte } from './reportes';
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
const ctx = construirContexto('indicadores.reporte_word', reporte.formato_snapshot!, { empresa: 'QA Empresa', generadoPor: 'QA Designado', logo: null });
const xml = async (borrador: boolean) => {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(construirWordReporte({ ctx, reporte, resumen, firmantes, graficas: { k1: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) }, borrador })));
  const header = Object.keys(zip.files).filter(f => /word\/(header|footer)\d*\.xml/.test(f)).sort();
  // docx numbers drawing ids (docPr) with a process-wide counter; they are internal ids, not content.
  return [await zip.file('word/document.xml')!.async('string'), ...(await Promise.all(header.map(f => zip.file(f)!.async('string'))))].join('\n').replace(/docPr id="\d+"/g, 'docPr id="N"');
};

describe('K3-b Word del reporte', () => {
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
