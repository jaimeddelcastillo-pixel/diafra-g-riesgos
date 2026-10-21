import { describe, expect, it, vi } from 'vitest';
import { elegirFirmante, listarUsuariosFirmantes, usuarioDelFirmante } from '../firmantes-empresa';

const mocks = vi.hoisted(() => ({ empresa: vi.fn(), from: vi.fn() }));
vi.mock('../persistencia', () => ({ empresaActiva: mocks.empresa }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
const usuarios = [{ id: 'qa-1', nombre: 'Persona QA', cargo: 'Responsable QA' }];

describe('Firmantes de la plantilla', () => {
  it('copia nombre y cargo del usuario elegido y conserva el rol sin ampliar el formato', () => {
    expect(elegirFirmante({ rol: 'Revisó', nombre: 'Anterior', cargo: 'Anterior' }, 'qa-1', usuarios))
      .toEqual({ rol: 'Revisó', nombre: 'Persona QA', cargo: 'Responsable QA' });
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