import { describe, it, expect } from 'vitest';
import { cambiosPrevios } from '../captura-controles';
import { semanaVacia } from '../semanas';
import { textoEspecificacion, erroresInstrumento, semaforo } from '../norma';
import { firmantesReporte, FORMATO_DEFAULT } from '../formato-forval16';
import { identificadoresReporte, nombreArchivoReporte } from '../configuracion-reporte';
import { specTxt } from '../export-forval16';
import { marcarAtipicas } from '../../../../../supabase/functions/_shared/bitacora-lecturas';

const sem = () => semanaVacia({ semana_inicio: '2026-06-29', mes: 'junio', anio: '2026', unidad: 'Pa', esTHR: false });
describe('T4d', () => {
  it('lista solo celdas con lectura previa que cambiaron (antes → después)', () => {
    const a = sem(); a.lecturas[0].valor = 10; a.lecturas[1].valor = 11;
    const b = { ...a, lecturas: a.lecturas.map((p, i) => i === 0 ? { ...p, valor: 12 } : i === 2 ? { ...p, valor: 9 } : p) };
    expect(cambiosPrevios(a, b)).toEqual([{ campo: 'lecturas', dia: a.lecturas[0].dia, turno: a.lecturas[0].turno, antes: 10, despues: 12 }]);
    expect(cambiosPrevios(undefined, b)).toEqual([]);
  });
  it('marca dudosa la lectura fuera de especificación o a más de 40 % de la mediana', () => {
    const rows = [4, 10, 10, 11, 10, 10].map(v => ({ valor: v, confianza: 0.95 }));
    const r = marcarAtipicas(rows, { lie: 5, lse: null, lieEstricto: true });
    expect(r[0].confianza).toBe(0);
    expect(r.slice(1).every(p => p.confianza === 0.95)).toBe(true);
    const lejos = marcarAtipicas([5, 10, 10, 10].map(v => ({ valor: v, confianza: 0.9 })), { lie: null, lse: null });
    expect(lejos[0].confianza).toBe(0); expect(lejos[1].confianza).toBe(0.9);
  });
  it('arma el texto con la comparación: «> 5 Pa» estricta, «≥ 5 Pa» no estricta', () => {
    expect(textoEspecificacion(5, null, true, false, 'Pa')).toBe('> 5 Pa');
    expect(textoEspecificacion(5, null, false, false, 'Pa')).toBe('≥ 5 Pa');
    expect(specTxt(5, null, 'Pa', null, true)).toBe('> 5 Pa');
  });
  it('tabla NOM-241 del Word: ISO-7 > 10 Pa e ISO-8 > 5 Pa', () => {
    expect(FORMATO_DEFAULT.textos.tablaClases).toContain('| > 10 Pa |');
    expect(FORMATO_DEFAULT.textos.tablaClases).toContain('| > 5 Pa |');
  });
  it('no permite «validada» sin límite ni área validada sin área', () => {
    expect(erroresInstrumento({ spec_estado: 'validada', area_estado: 'pendiente' })).toHaveLength(1);
    expect(erroresInstrumento({ spec_estado: 'validada', spec_lie: 5, area_estado: 'validada' })).toHaveLength(1);
    expect(erroresInstrumento({ spec_estado: 'validada', spec_lie: 5, area_estado: 'validada', area_id: 'x' })).toEqual([]);
  });
  it('firmantes: ELABORÓ, REVISÓ y AUTORIZÓ con nombre y cargo', () => {
    const f = firmantesReporte([{ rol: 'Revisor', nombre: 'Ana', cargo: 'Director' }]);
    expect(f.map(x => x.rol)).toEqual(['Elaboró', 'Revisó', 'Autorizó']);
    expect(f[1]).toEqual({ rol: 'Revisó', nombre: 'Ana', cargo: 'Director' });
  });
  it('sin código configurado el archivo es AT-…_<título>_<periodo>_v1', () => {
    expect(nombreArchivoReporte(identificadoresReporte(FORMATO_DEFAULT).prefijoArchivos, ['AT-2026-007', 'Instrumentos INS-PRO-31', 'T2 2026', 'v1'], 'docx')).toBe('AT-2026-007_Instrumentos_INS-PRO-31_T2_2026_v1.docx');
  });
  it('semáforo sin amarillo: rojo, naranja, verde', () => {
    expect(semaforo([{ clave: 'x', nivel: 'naranja', mensaje: '' }])).toBe('naranja');
  });
});
