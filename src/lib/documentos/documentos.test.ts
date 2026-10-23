import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/org-logos/${p}` } }) }) } } }));
import { construirContexto, type RegistroDocumento } from './index';
import { getOrgLogoUrl, fetchOrgLogoDataUrl } from '@/lib/orgLogo';
import { exportarResultados } from '@/modules/indicadores/lib/resultados';
import { bitacoraPdf } from './bitacora';

const reg: RegistroDocumento = {
  folio: 'DOC-2026-000042', generado_en: '2026-10-23T18:00:00Z',
  formato: { tipo: 'indicadores.resultados_excel', codigo: 'FOR-QA-07', version_formato: '03', titulo: 'Resultados QA', firmas: [{ rol: 'Elaboró', nombre: 'Ana QA', cargo: 'AC' }], vigente_desde: '2026-01-01' },
  identidad: { razon_social: 'Empresa Prueba SA', domicilio: 'Calle 1', leyenda_confidencialidad: 'Confidencial QA', leyenda_copia: 'Copia no controlada', pie: '' },
};
const ctx = construirContexto('indicadores.resultados_excel', reg, { empresa: 'Empresa Prueba', generadoPor: 'Ana QA', logo: null });

describe('D1 identidad documental', () => {
  it('una empresa sin logo exporta sin logo y nunca con el de otra empresa', async () => {
    expect(getOrgLogoUrl(null)).toBeNull(); expect(getOrgLogoUrl('')).toBeNull();
    await expect(fetchOrgLogoDataUrl(null)).resolves.toBeNull();
    expect(getOrgLogoUrl('org-b/logo.png')).toBe('https://cdn.test/org-logos/org-b/logo.png');
    expect(ctx.logo).toBeNull(); expect(ctx.razonSocial).toBe('Empresa Prueba SA');
    const pdf = bitacoraPdf(ctx, 'Filtros', [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']]).output();
    expect(pdf).not.toMatch(/\/Subtype \/Image/);
    expect(pdf.toLowerCase()).not.toContain('diafra');
  });
  it('encabezado, pie y folio en el Excel de resultados', () => {
    const wb = XLSX.read(exportarResultados(ctx, [{ Código: 'F1', Valor: 98 }]), { type: 'array' });
    const filas = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Resultados, { header: 1, defval: '' }).map(r => r.join('|').replace(/\|+$/, ''));
    expect(filas[0]).toBe('Empresa Prueba SA'); expect(filas[1]).toBe('Resultados QA');
    expect(filas[2]).toContain('Código: FOR-QA-07'); expect(filas[2]).toContain('Versión: 03'); expect(filas[2]).toContain('Hoja 1 de 1');
    expect(filas).toContain('Código|Valor'); expect(filas).toContain('F1|98');
    expect(filas).toContain('Copia no controlada'); expect(filas).toContain('Confidencial QA');
    expect(filas.at(-1)).toMatch(/^Generado por Ana QA el .+ · DOC-2026-000042$/);
  });
  it('encabezado, pie y folio en el PDF de la auditoría', () => {
    const doc = bitacoraPdf(ctx, 'Filtros QA', [['1', '2', '3', '4', '5', '6', '7', '8', '9']]);
    const pdf = doc.output();
    for (const t of ['EMPRESA PRUEBA SA', 'Resultados QA', 'C\\363digo: FOR-QA-07', 'Versi\\363n: 03', 'P\\341gina 1 de 1', 'DOC-2026-000042', 'Copia no controlada', 'ELABOR']) expect(pdf).toContain(t);
  });
});
