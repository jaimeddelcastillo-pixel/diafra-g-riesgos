import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { hojasAnio, leerResultadosExcel, plantillaAnio, type KpiExcel } from './excel-resultados';
import { calcular } from './resultados';
import { claseSemaforo } from './semaforo';

const k: KpiExcel = { tabla: 'kpi_puesto', id: 'qa-kpi', codigo: 'OPE-FAB-01', nombre: 'QA cumplimiento', grupo: 'OPE-FAB', nivel: 'Puesto', frecuencia: 'trimestral', meta: 98, unidad: '%', fuente: 'Bitácora QA', estado: 'validado' };
describe('K2-a plantilla anual y lectura', () => {
  it('2026 OPE-FAB permite T1–T3 y bloquea T4 y columnas fijas', async () => {
    const [h] = hojasAnio([k], [], 2026, '2026-10-23');
    expect(h.nombre).toBe('OPE-FAB');
    expect(h.desbloqueadas).toEqual(['G2','H2','I2','J2','K2','L2']);
    expect(h.filas[0].slice(6)).toEqual(['T1 2026 | numerador','T1 2026 | denominador','T2 2026 | numerador','T2 2026 | denominador','T3 2026 | numerador','T3 2026 | denominador','T4 2026 | numerador','T4 2026 | denominador']);
    const zip = await JSZip.loadAsync(await plantillaAnio([k], [], 2026, '2026-10-23'));
    const file = zip.file('xl/worksheets/sheet1.xml'); const styles = zip.file('xl/styles.xml');
    expect(file).not.toBeNull(); expect(styles).not.toBeNull();
    const xml = await file?.async('string'); const css = await styles?.async('string');
    expect(xml).toContain('sheetProtection');
    expect(css).toContain('<protection locked="0"/>');
    const unlockedStyle = Number(css?.match(/<cellXfs count="(\d+)"/)?.[1]) - 1;
    expect(xml).toMatch(new RegExp(`<c r="G2"[^>]*s="${unlockedStyle}"`));
    expect(xml).not.toMatch(new RegExp(`<c r="M2"[^>]*s="${unlockedStyle}"`));
    expect(xml).not.toMatch(new RegExp(`<c r="B2"[^>]*s="${unlockedStyle}"`));
  });
  it('importa T1–T3 de dos KPI y conserva texto inválido para vista previa', () => {
    const [h] = hojasAnio([k, { ...k, id: 'qa-2', codigo: 'OPE-FAB-02' }], [], 2026, '2026-10-23');
    for (const row of h.filas.slice(1)) { row[6] = 98; row[7] = 100; row[8] = 98; row[9] = 100; row[10] = 98; row[11] = 100; }
    h.filas[2][10] = 'inválido'; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h.filas), h.nombre);
    const cells = leerResultadosExcel(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(cells).toHaveLength(6); expect(cells.map(c => c.inicio)).toEqual(['2026-01-01','2026-04-01','2026-07-01','2026-01-01','2026-04-01','2026-07-01']); expect(cells[5].numerador).toBe('inválido');
  });
  it('SGC prellena fuente pero no importa celdas sin mediciones; solo validados', () => {
    const sgc = { ...k, tabla: 'kpi_definiciones' as const, nivel: 'SGC' };
    const hs = hojasAnio([sgc, { ...k, estado: 'borrador' }], [], 2026, '2026-10-23');
    expect(hs).toHaveLength(1); expect(hs[0].nombre).toBe('SGC'); expect(hs[0].filas[1][8]).toBe('Bitácora QA · T1 2026');
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hs[0].filas), 'SGC'); expect(leerResultadosExcel(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))).toEqual([]);
  });
  it('98/100 contra 98% es verde para capturado y revisado sin reclasificar estado', () => {
    const calc = calcular('%', 'positiva', 98, 98, 100); expect(calc).toEqual({ valor: 98, cumplimiento: 1, semaforo: 'verde' });
    for (const estado of ['capturado', 'revisado']) { const resultado = { ...calc, estado }; expect(claseSemaforo(resultado.semaforo)).toContain('bg-success/15'); expect(claseSemaforo(resultado.semaforo)).not.toContain('bg-muted'); }
    expect(claseSemaforo('sin base')).toContain('bg-muted');
  });
});