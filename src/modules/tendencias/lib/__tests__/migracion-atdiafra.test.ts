// F4a: prueba con respaldo de ejemplo, incluida la reversión cuando los conteos no cuadran.
import { describe, it, expect } from 'vitest';
import { vistaPrevia, aplicarExclusiones, mapearInstrumento, construirSnapshotAT, verificarConteos, construirInforme, type Respaldo } from '../migracion-atdiafra';
import type { NormaEspecificacion } from '../norma';

const normas: NormaEspecificacion[] = [{
  id: 'n1', norma: 'NOM-241-SSA1-2025', apartado: 'Apéndice A', clase_iso: 'ISO-7', variable: 'presion',
  texto: '> 10 Pa', lie: 10, lse: null, lie_estricto: true, lse_estricto: false, unidad: 'Pa', sin_valor: false, nota: null, activo: true,
}];

function respaldoEjemplo(): Respaldo {
  return {
    manifest: {
      tablas: {
        tend_sistemas_hvac: 1, tend_areas: 1, tend_instrumentos: 2, tend_objetivos_presion: 0, tend_cambios_filtro: 0,
        tend_registros: 2, tend_semanas: 3, tend_registros_at: 2, tend_registros_at_historial: 0, tend_extracciones: 0, tend_formato: 1,
      },
      usuarios: ['qa@diafra.mx', 'rs@diafra.mx', 'fantasma@diafra.mx'],
      generado_en: '2026-10-01',
    },
    tablas: {
      tend_sistemas_hvac: [{ id: 'h1', codigo: 'UMA-01', nombre_uma: 'UMA 01' }],
      tend_areas: [{ id: 'a1', codigo: 'AR-01', nombre: 'Llenado', iso: 'ISO-7', hvac_id: 'h1' }],
      tend_instrumentos: [
        { id: 'i1', codigo: 'INS-CMB-01', tipo: 'manometro_diferencial', area_id: 'a1', lie_pa: 8, lse_pa: 15, spec_texto: '> 10 Pa', spec_lie: 10, spec_lie_estricto: true, codigo_bitacora: 'BIT-01' },
        { id: 'i2', codigo: 'INS-CMB-02', tipo: 'manometro_diferencial', area_id: 'a1', lie_pa: null, lse_pa: null, spec_texto: 'Magnehelic marca Dwyer serie 2000', spec_lie: null, codigo_bitacora: 'BIT 02 con texto largo' },
      ],
      tend_registros: [
        { id: 'r1', nombre: 'Llenado vs Lavado', instrumento_id: 'i1' },
        { id: 'r2', nombre: 'Registro de prueba', instrumento_id: 'i2' },
      ],
      tend_semanas: [
        { id: 's1', registro_id: 'r1', semana_inicio: '2026-01-05' },
        { id: 's2', registro_id: 'r1', semana_inicio: '2026-01-12' },
        { id: 's3', registro_id: 'r2', semana_inicio: '2026-01-05' },
      ],
      tend_registros_at: [
        { id: 'at1', codigo: 'AT-2026-905', estado: 'emitido', periodo_desde: '2026-01-01', periodo_hasta: '2026-01-31', seleccion: { ids: ['r1'] } },
        { id: 'at2', codigo: 'AT-2026-906', estado: 'anulado', periodo_desde: '2026-01-01', periodo_hasta: '2026-01-31', seleccion: { ids: ['r1'] } },
      ],
      tend_formato: [{ id: 'f1', version: 3, textos: {} }],
    },
    fotos: { '2026/foto1.jpg': new Blob(['x']) },
  };
}

describe('F4a vista previa', () => {
  it('cuenta contra el manifest y detecta usuarios faltantes', () => {
    const v = vistaPrevia(respaldoEjemplo(), ['qa@diafra.mx', 'rs@diafra.mx'], normas);
    expect(v.conteos.every((c) => c.cuadra)).toBe(true);
    expect(v.usuariosFaltantes).toEqual(['fantasma@diafra.mx']);
  });
  it('lista sospechosos del catálogo con las reglas de la Revisión', () => {
    const v = vistaPrevia(respaldoEjemplo(), ['qa@diafra.mx', 'rs@diafra.mx', 'fantasma@diafra.mx'], normas);
    const s2 = v.sospechosos.find((s) => s.codigo === 'INS-CMB-02');
    expect(s2?.hallazgos.map((h) => h.clave)).toContain('spec_descripcion');
    expect(s2?.hallazgos.map((h) => h.clave)).toContain('bitacora');
  });
  it('falla la vista previa si el conteo no cuadra con el manifest', () => {
    const r = respaldoEjemplo();
    r.manifest.tablas.tend_semanas = 5;
    expect(vistaPrevia(r, [], normas).conteos.find((c) => c.tabla === 'tend_semanas')?.cuadra).toBe(false);
  });
});

describe('F4a exclusiones y conteos', () => {
  it('excluye un registro de prueba y sus semanas con motivo', () => {
    const excl = [{ tabla: 'tend_registros' as const, id: 'r2', nombre: 'Registro de prueba', motivo: 'prueba' }];
    const r = aplicarExclusiones(respaldoEjemplo(), excl);
    expect(r.tablas.tend_registros).toHaveLength(1);
    expect(r.tablas.tend_semanas).toHaveLength(2);
    expect(verificarConteos(respaldoEjemplo(), excl).tend_semanas).toBe(2);
  });
  it('revierte: lanza error cuando el conteo no cuadra', () => {
    const r = respaldoEjemplo();
    r.manifest.tablas.tend_instrumentos = 3;
    expect(() => verificarConteos(r, [])).toThrow(/no cuadra/);
  });
});

describe('F4a mapeo de campos', () => {
  it('lleva LIE/LSE antiguos al rango de operación, nunca a la especificación', () => {
    const m = mapearInstrumento(respaldoEjemplo().tablas.tend_instrumentos![0]);
    expect(m.op_min_pa).toBe(8);
    expect(m.op_max_pa).toBe(15);
    expect(m.lie_pa).toBeNull();
    expect(m.spec_lie).toBe(10);
    expect(m.spec_texto).toBe('> 10 Pa');
  });
  it('copia la descripción del equipo sin borrar la especificación original', () => {
    const m = mapearInstrumento(respaldoEjemplo().tablas.tend_instrumentos![1]);
    expect(m.descripcion_equipo).toBe('Magnehelic marca Dwyer serie 2000');
    expect(m.spec_texto).toBe('Magnehelic marca Dwyer serie 2000');
  });
});

describe('F4a snapshots e informe', () => {
  it('reconstruye el snapshot de un AT emitido con su periodo y selección', () => {
    const r = respaldoEjemplo();
    const at = construirSnapshotAT(r.tablas.tend_registros_at![0], r.tablas.tend_registros!, r.tablas.tend_semanas!, { version: 3 });
    const datos = at.datos_snapshot as { registros: { id: string; semanas: unknown[] }[] };
    expect(datos.registros).toHaveLength(1);
    expect(datos.registros[0].semanas).toHaveLength(2);
    expect(at.formato_snapshot).toEqual({ version: 3 });
    expect(r.tablas.tend_registros_at![1].estado).toBe('anulado');
  });
  it('el informe incluye conteos, excluidos con motivo, sospechosos y snapshots', () => {
    const r = respaldoEjemplo();
    const excl = [{ tabla: 'tend_registros_at' as const, id: 'at2', nombre: 'AT-2026-906', motivo: 'duplicado' }];
    const inf = construirInforme(r, excl, [{ codigo: 'INS-CMB-02', hallazgos: [] }], ['AT-2026-905']);
    expect(inf.conteos.tend_registros_at).toBe(1);
    expect(inf.excluidos[0].motivo).toBe('duplicado');
    expect(inf.snapshotsReconstruidos).toEqual(['AT-2026-905']);
  });
});
