import { describe, it, expect } from 'vitest';
import { sugerir, esCriterioInterno, revisarInstrumento, semaforo, claseEfectiva, type NormaEspecificacion } from '../norma';
import type { Instrumento } from '../catalogos';

const n = (clase_iso: string, variable: NormaEspecificacion['variable'], texto: string, lie: number | null, lse: number | null, lie_estricto = false, sin_valor = false): NormaEspecificacion =>
  ({ id: clase_iso + variable, norma: 'NOM-241', apartado: 'Apéndice A', clase_iso, variable, texto, lie, lse, lie_estricto, lse_estricto: false, unidad: null, sin_valor, nota: null, activo: true });
const NORMAS = [n('ISO-7', 'presion', '> 10 Pa', 10, null, true), n('ISO-8', 'presion', '> 5 Pa', 5, null, true), n('ISO-9', 'presion', 'Presión positiva', null, null, false, true), n('ISO-8', 'temperatura', '18 a 25 °C', 18, 25), n('ISO-9', 'hr', 'n.a.', null, null, false, true)];
const inst = (p: Partial<Instrumento>): Instrumento => ({ id: 'i', codigo: 'MD-01', tipo: 'manometro_diferencial', area_id: 'a', area_libre: null, parametro: 'Presión', especificacion: null, activo: true, lie_pa: null, lse_pa: null, baseline_pa: null, baseline_tolerancia_pct: null, codigo_bitacora: 'BIT-CMB-24-43', dp_final_fabricante: null, spec_estado: 'validada', spec_texto: '> 5 Pa', spec_lie: 5, spec_lie_estricto: true, ...p });
const claves = (i: Instrumento, iso: string, media: number | null = null) => revisarInstrumento(i, iso, media, NORMAS).map(h => h.clave);

describe('Sugerencia de la norma (NOM-241 Apéndice A)', () => {
  it('ISO-7 presión sugiere «> 10 Pa», LIE 10 estricto', () => { const s = sugerir(NORMAS, 'ISO-7', 'presion'); expect(s).toMatchObject({ texto: '> 10 Pa', lie: 10, lse: null, lie_estricto: true }); });
  it('ISO-8 temperatura sugiere 18 a 25', () => { expect(sugerir(NORMAS, 'ISO-8', 'temperatura')).toMatchObject({ lie: 18, lse: 25 }); });
  it('ISO-9 presión no trae valor en Pa', () => { expect(sugerir(NORMAS, 'ISO-9', 'presion')).toMatchObject({ lie: null, sin_valor: true }); });
  it('sin clase ISO no sugiere nada', () => { expect(sugerir(NORMAS, null, 'presion')).toBeNull(); });
});

describe('Criterio interno', () => {
  it('ISO-9 con «> 5 Pa» es criterio interno', () => { expect(esCriterioInterno(sugerir(NORMAS, 'ISO-9', 'presion'), 5, null)).toBe(true); });
  it('ISO-7 con LIE 12 (más estricto) es criterio interno', () => { expect(esCriterioInterno(sugerir(NORMAS, 'ISO-7', 'presion'), 12, null)).toBe(true); });
  it('ISO-7 con LIE 10 igual a la norma no lo es', () => { expect(esCriterioInterno(sugerir(NORMAS, 'ISO-7', 'presion'), 10, null)).toBe(false); });
});

describe('Revisión del catálogo', () => {
  it('instrumento correcto queda en verde', () => { expect(semaforo(revisarInstrumento(inst({}), 'ISO-8', 9, NORMAS))).toBe('verde'); });
  it('texto que no coincide con LIE', () => { expect(claves(inst({ spec_texto: '> 10 Pa' }), 'ISO-8')).toContain('texto_limites'); });
  it('«≥» donde la norma dice «>»', () => { expect(claves(inst({ spec_lie_estricto: false }), 'ISO-8')).toContain('comparacion'); });
  it('clase ISO del texto distinta a la del área', () => { expect(claves(inst({ spec_texto: 'ISO-7 > 5 Pa' }), 'ISO-8')).toContain('iso_texto'); });
  it('valores de temperatura en una presión', () => { expect(claves(inst({ spec_texto: '18 a 25', spec_lie: 18, spec_lse: 25 }), 'ISO-8')).toContain('valores_thr'); });
  it('LIE mayor que la media del trimestre', () => { expect(claves(inst({}), 'ISO-8', 4.2)).toContain('lie_media'); });
  it('media a menos de 1 unidad del límite', () => { expect(claves(inst({}), 'ISO-8', 5.6)).toContain('margen'); });
  it('media cerca del tope de la escala', () => { expect(claves(inst({ escala_min: 0, escala_max: 30 }), 'ISO-8', 28)).toContain('tope_escala'); });
  it('sin especificación o pendiente', () => { expect(claves(inst({ spec_estado: 'pendiente' }), 'ISO-8')).toContain('sin_spec'); });
  it('código de bitácora vacío o largo', () => {
    expect(claves(inst({ codigo_bitacora: '' }), 'ISO-8')).toContain('bitacora');
    expect(claves(inst({ codigo_bitacora: 'Bitácora de presiones del cuarto de mezclas' }), 'ISO-8')).toContain('bitacora');
  });
});

describe('Clase de instrumento', () => {
  it('solo diferencial de sala entra a presiones de áreas; filtro va a Banco de filtros', () => {
    expect(claseEfectiva({ tipo: 'manometro_diferencial', clase_instrumento: null })).toBe('diferencial_sala');
    expect(claseEfectiva({ tipo: 'manometro_diferencial', clase_instrumento: 'filtro_ducto' })).toBe('filtro_ducto');
    expect(claseEfectiva({ tipo: 'manometro_filtro', clase_instrumento: null })).toBe('filtro_ducto');
  });
});
