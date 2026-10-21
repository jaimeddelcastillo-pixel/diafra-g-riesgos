import { describe, expect, it, vi } from 'vitest';
import { elegirFirmante, esAutorizante, listarUsuariosFirmantes, usuarioDelFirmante, tieneSuplenciaAutorizar, verificarAutorizante } from '../firmantes-empresa';
import { cargarConfiguracion, guardarConfiguracion } from '../persistencia';
import { FORMATO_DEFAULT } from '../formato-forval16';

const mocks = vi.hoisted(() => ({ empresa: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock('../persistencia', async importOriginal => ({ ...await importOriginal<typeof import('../persistencia')>(), empresaActiva: mocks.empresa }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
const usuarios = [{ id: 'qa-1', nombre: 'Persona QA', cargo: 'Responsable QA' }];

describe('Firmantes de la plantilla', () => {
  it('guarda el user_id opcional junto con nombre y cargo conservando el rol', () => {
    expect(elegirFirmante({ rol: 'Revisó', nombre: 'Anterior', cargo: 'Anterior' }, 'qa-1', usuarios))
      .toEqual({ rol: 'Revisó', nombre: 'Persona QA', cargo: 'Responsable QA', user_id: 'qa-1' });
  });
  it('no cambia firmantes históricos ni acepta usuarios fuera de las opciones de empresa', () => {
    const anterior = { rol: 'Elaboró', nombre: 'Original', cargo: 'Original QA' };
    expect(elegirFirmante(anterior, 'otra-empresa', usuarios)).toEqual(anterior);
    expect(usuarioDelFirmante(anterior, usuarios)).toBe('manual');
  });
  it('los cambios futuros de perfil no modifican la copia seleccionada', () => {
    const perfiles = usuarios.map(u => ({ ...u }));
    const firmante = elegirFirmante({ rol: 'Autorizó', nombre: '', cargo: '' }, 'qa-1', perfiles);
    perfiles[0].nombre = 'Nombre nuevo';
    expect(firmante.nombre).toBe('Persona QA');
  });
  it('mantiene la identidad aunque se editen nombre y cargo manualmente', () => {
    const f = elegirFirmante({ rol: 'Revisó', nombre: '', cargo: '' }, 'qa-1', usuarios);
    expect(usuarioDelFirmante({ ...f, nombre: 'Texto editado', cargo: 'Cargo editado' }, usuarios)).toBe('qa-1');
  });
  it('no liga plantillas antiguas por coincidencia de nombre y cargo', () => {
    expect(usuarioDelFirmante({ rol: 'Revisó', nombre: 'Persona QA', cargo: 'Responsable QA' }, usuarios)).toBe('manual');
  });
  it('quitar la asociación conserva los textos y elimina user_id', () => {
    expect(elegirFirmante({ rol: 'Elaboró', nombre: 'Persona QA', cargo: 'Responsable QA', user_id: 'qa-1' }, 'manual', usuarios))
      .toEqual({ rol: 'Elaboró', nombre: 'Persona QA', cargo: 'Responsable QA' });
  });
  it('un perfil sin cargo conserva identidad y permite escribir un cargo', () => {
    const f = elegirFirmante({ rol: 'Revisó', nombre: '', cargo: 'Anterior' }, 'qa-1', [{ ...usuarios[0], cargo: null }]);
    expect(f).toEqual({ rol: 'Revisó', nombre: 'Persona QA', cargo: '', user_id: 'qa-1' });
    expect(usuarioDelFirmante({ ...f, cargo: 'Cargo escrito' }, usuarios)).toBe('qa-1');
  });
  it('reconoce Autorizó independientemente de acentos y mayúsculas', () => {
    expect(esAutorizante('AUTORIZÓ')).toBe(true);
    expect(esAutorizante('Revisó')).toBe(false);
  });
  const ahora = Date.parse('2026-10-21T19:22:00Z');
  const suplencia = { suplente_user_id: 'qa-1', fecha_inicio: '2026-10-21T19:22:00Z', fecha_fin: '2026-10-22T19:22:00Z', revocada_en: null, facultades: ['autorizar'] };
  it('acepta suplencia vigente de autorizar desde su inicio y no en su fin', () => {
    expect(tieneSuplenciaAutorizar('qa-1', [suplencia], ahora)).toBe(true);
    expect(tieneSuplenciaAutorizar('qa-1', [suplencia], Date.parse(suplencia.fecha_fin))).toBe(false);
  });
  it('no acepta suplencias revocadas, futuras, ajenas o solo para anular', () => {
    expect(tieneSuplenciaAutorizar('qa-1', [{ ...suplencia, revocada_en: '2026-10-21T19:22:00Z' }], ahora)).toBe(false);
    expect(tieneSuplenciaAutorizar('qa-1', [suplencia], ahora - 1)).toBe(false);
    expect(tieneSuplenciaAutorizar('qa-2', [suplencia], ahora)).toBe(false);
    expect(tieneSuplenciaAutorizar('qa-1', [{ ...suplencia, facultades: ['anular'] }], ahora)).toBe(false);
  });
  it.each([true, false])('el aviso usa el resultado de has_role en servidor: RS=%s', async rs => {
    mocks.empresa.mockResolvedValue('empresa-es-prueba');
    mocks.rpc.mockResolvedValue({ data: rs, error: null });
    const filtros: [string, unknown][] = [];
    mocks.from.mockImplementation(tabla => {
      const cadena = {
        select: vi.fn(() => cadena),
        eq: vi.fn((k, v) => { filtros.push([k, v]); return cadena; }),
        maybeSingle: vi.fn().mockResolvedValue({ data: tabla === 'profiles' ? { id: 'qa-1' } : { user_id: 'qa-1' }, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return cadena;
    });
    expect(await verificarAutorizante('qa-1')).toBe(rs);
    expect(mocks.rpc).toHaveBeenCalledWith('has_role', { _user_id: 'qa-1', _role: 'responsable_sanitario' });
    expect(filtros).toContainEqual(['org_id', 'empresa-es-prueba']);
    expect(filtros).toContainEqual(['activo', true]);
  });
  it('guarda y vuelve a cargar user_id sin exigirlo a firmantes históricos ni bloquear Autorizó', async () => {
    const firmantes = [
      { rol: 'Autorizó', nombre: 'Persona QA', cargo: 'Cargo manual QA', user_id: 'qa-1' },
      { rol: 'Revisó', nombre: 'Histórico QA', cargo: 'Cargo QA' },
    ];
    mocks.rpc.mockResolvedValue({ data: 'empresa-es-prueba', error: null });
    let guardados: unknown;
    mocks.from.mockImplementation(tabla => {
      const cadena = {
        select: vi.fn(() => cadena), eq: vi.fn(() => cadena), order: vi.fn(() => cadena), limit: vi.fn(() => cadena),
        maybeSingle: vi.fn().mockImplementation(async () => ({ data: tabla === 'tend_formato' ? { version: 2, firmantes: guardados ?? firmantes, textos: {}, logo: null } : { permitir_autoemision: false }, error: null })),
        insert: vi.fn(async valor => { guardados = valor.firmantes; return { error: null }; }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
      return cadena;
    });
    await guardarConfiguracion({ ...FORMATO_DEFAULT, firmantes }, false);
    expect(guardados).toEqual(firmantes);
    expect((await cargarConfiguracion('Empresa QA', null)).formato.firmantes).toEqual(firmantes);
  });
  it('consulta solo miembros de la empresa resuelta por el servidor y perfiles activos', async () => {
    mocks.empresa.mockResolvedValue('empresa-es-prueba');
    const miembrosEq = vi.fn().mockResolvedValue({ data: [{ user_id: 'qa-1' }], error: null });
    const order = vi.fn().mockResolvedValue({ data: usuarios, error: null });
    const activoEq = vi.fn().mockReturnValue({ order });
    const idsIn = vi.fn().mockReturnValue({ eq: activoEq });
    mocks.from.mockImplementation(tabla => ({ select: () => tabla === 'org_members' ? { eq: miembrosEq } : { in: idsIn } }));
    expect(await listarUsuariosFirmantes()).toEqual(usuarios);
    expect(miembrosEq).toHaveBeenCalledWith('org_id', 'empresa-es-prueba');
    expect(idsIn).toHaveBeenCalledWith('id', ['qa-1']);
    expect(activoEq).toHaveBeenCalledWith('activo', true);
  });
});