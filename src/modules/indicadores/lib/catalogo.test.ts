import { describe, expect, it } from 'vitest';
import { avisosPesos, escribirExcel, leerExcel, previsualizar, vacio, type Catalogo } from './catalogo';
const muestra = (): Catalogo => ({
  Puestos: [{ codigo: 'AC', nombre: 'Aseguramiento de Calidad', area: 'Calidad', activo: true }],
  KPI_SGC: [{ codigo: '1', nombre: 'Cumplimiento', proceso: 'SGC', nivel: 'SGC', definicion: '', formula: 'cumplidos/total*100', fuente: 'Registro', puesto: 'AC', frecuencia: 'mensual', tendencia: 'positiva', meta: 95, unidad: '%', peso: 100, regla_actuacion: '', activo: true }],
  KPI_Puesto: [{ codigo: 'F1', nombre: 'Seguimiento', puesto: 'AC', objetivo: 'Cumplimiento', formula: 'a/b*100', fuente: 'Registro', tendencia: 'positiva', meta: 95, unidad: '%', frecuencia: 'mensual', peso: 100, aporta_a: '1', activo: true }],
});
describe('K1 catálogo Excel', () => {
  it('ida y vuelta conserva códigos de texto y referencias del mismo archivo', () => {
    const c = leerExcel(new Uint8Array(escribirExcel(muestra())).buffer);
    const p = previsualizar(c, vacio()); expect(p.errores).toEqual([]); expect(p.filas.map(f => f.estado)).toEqual(['nuevo', 'nuevo', 'nuevo']); expect(p.paquete.KPI_SGC[0].codigo).toBe('1'); expect(p.paquete.KPI_Puesto[0].aporta_a).toBe('1');
  });
  it('duplicados bloquean', () => { const c = muestra(); c.Puestos.push({ ...c.Puestos[0] }); expect(previsualizar(c, vacio()).errores.some(e => e.includes('duplicado'))).toBe(true); });
  it('puesto inexistente bloquea', () => { const c = muestra(); c.KPI_SGC[0].puesto = 'NO'; expect(previsualizar(c, vacio()).errores.some(e => e.includes('Puesto inexistente'))).toBe(true); });
  it('aporta_a inexistente bloquea', () => { const c = muestra(); c.KPI_Puesto[0].aporta_a = 'NO'; expect(previsualizar(c, vacio()).errores.some(e => e.includes('aporta_a inexistente'))).toBe(true); });
  for (const campo of ['tendencia', 'unidad', 'frecuencia', 'meta']) it(`${campo} inválido bloquea`, () => { const c = muestra(); c.KPI_SGC[0][campo] = 'inválido'; expect(previsualizar(c, vacio()).errores.length).toBeGreaterThan(0); });
  it('pesos distintos de 100 avisan sin bloquear', () => { const c = muestra(); c.KPI_SGC[0].peso = 90; c.KPI_Puesto[0].peso = 50; const p = previsualizar(c, vacio()); expect(p.errores).toEqual([]); expect(p.avisos).toHaveLength(2); expect(avisosPesos(muestra())).toEqual([]); });
  it('retiro no elimina filas ausentes y muestra antes/después', () => { const c = muestra(); const entrada = vacio(); entrada.Puestos = [{ ...c.Puestos[0], activo: false }]; const p = previsualizar(entrada, c); expect(p.filas[0].estado).toBe('cambia'); expect(p.filas[0].cambios).toEqual([{ campo: 'activo', antes: true, despues: false }]); expect(p.paquete.Puestos).toHaveLength(1); });
});