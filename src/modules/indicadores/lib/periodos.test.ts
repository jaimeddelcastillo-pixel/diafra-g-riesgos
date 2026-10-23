import { describe, expect, it } from 'vitest';
import { celdasAnio, periodoCerrado, ultimoCerrado } from './resultados';
import { faltaDenominador } from '../Captura';

describe('K2-b último periodo cerrado (America/Mexico_City)', () => {
  const casos: [string, Record<string, string>][] = [
    ['2026-10-23', { mensual: '2026-09-01', trimestral: '2026-07-01', semestral: '2026-01-01', anual: '2025-01-01' }],
    ['2027-01-01', { mensual: '2026-12-01', trimestral: '2026-10-01', semestral: '2026-07-01', anual: '2026-01-01' }],
    ['2026-07-15', { mensual: '2026-06-01', trimestral: '2026-04-01', semestral: '2026-01-01', anual: '2025-01-01' }],
  ];
  for (const [hoy, esperado] of casos) for (const [fr, inicio] of Object.entries(esperado))
    it(`${fr} al ${hoy} = ${inicio}`, () => expect(ultimoCerrado(fr, hoy)?.inicio).toBe(inicio));
  it('la celda de un periodo futuro no se captura', () => {
    const oct = celdasAnio('mensual', 2026)[9];
    expect(periodoCerrado(oct.fin, '2026-10-23')).toBe(false);
    expect(periodoCerrado(celdasAnio('mensual', 2026)[8].fin, '2026-10-23')).toBe(true);
    expect(celdasAnio('trimestral', 2026).map(c => c.meses)).toEqual([3, 3, 3, 3]);
  });
  it('denominador faltante solo cuando la unidad no es «número»', () => {
    expect(faltaDenominador('%', '')).toBe(true);
    expect(faltaDenominador('número', '')).toBe(false);
  });
});
