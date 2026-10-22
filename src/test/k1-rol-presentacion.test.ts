import { describe, expect, it } from 'vitest';
import { rolPresentacion } from '@/lib/rol-presentacion';
describe('K1 AC compatibility without RS escalation', () => {
  it('AC is committee on existing module screens', () => {
    expect(rolPresentacion('aseguramiento_calidad', '/tendencias/captura')).toBe('comite_tecnico');
    expect(rolPresentacion('aseguramiento_calidad', '/folios')).toBe('comite_tecnico');
  });
  it('AC stays AC in Indicadores and its shared substitutions', () => {
    expect(rolPresentacion('aseguramiento_calidad', '/indicadores')).toBe('aseguramiento_calidad');
    expect(rolPresentacion('aseguramiento_calidad', '/configuracion/suplencias')).toBe('aseguramiento_calidad');
  });
  it('never changes other roles or signed-out context', () => {
    expect(rolPresentacion('responsable_sanitario', '/indicadores')).toBe('responsable_sanitario');
    expect(rolPresentacion('operador', '/indicadores')).toBe('operador');
    expect(rolPresentacion(null, '/indicadores')).toBeNull();
  });
});