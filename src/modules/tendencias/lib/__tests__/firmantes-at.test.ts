import { describe, expect, it, vi } from 'vitest';
import { firmantesIniciales, firmantePerfil, opcionesRol, validarSeleccion, type UsuarioElegible } from '../firmantes-at';
import { firmantesReporte, type ElegiblesFirmantes } from '../formato-forval16';
import { cambiarEstadoAT } from '../registros-at';

const mocks = vi.hoisted(() => ({ from: vi.fn(), org: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('../persistencia', () => ({ empresaActiva: mocks.org }));
const usuarios: UsuarioElegible[] = [
  { id: 'autor', nombre: 'Autor QA', cargo: 'Analista', puede_autorizar: false },
  { id: 'revisor', nombre: 'Revisor QA', cargo: null, puede_autorizar: false },
  { id: 'rs', nombre: 'RS QA', cargo: 'Responsable sanitario', puede_autorizar: true },
  { id: 'suplente', nombre: 'Suplente QA', cargo: 'Suplente', puede_autorizar: true },
];
const config: ElegiblesFirmantes[] = [
  { rol: 'Elaboró', user_ids: ['revisor'], default_user_id: 'revisor' },
  { rol: 'Revisó', user_ids: ['revisor', 'rs'], default_user_id: 'revisor' },
  { rol: 'Autorizó', user_ids: ['rs', 'suplente'], default_user_id: 'rs' },
];

describe('T5c firmantes por AT', () => {
  it('Elaboró comienza con el usuario que genera el AT aunque la plantilla sugiera otro', () => {
    expect(firmantesIniciales(usuarios, 'autor', config)[0]).toEqual({ rol: 'Elaboró', user_id: 'autor', nombre: 'Autor QA', cargo: 'Analista' });
  });
  it('Revisó y Autorizó toman el predeterminado de sus elegibles', () => {
    expect(firmantesIniciales(usuarios, 'autor', config).map(f => f.user_id)).toEqual(['autor', 'revisor', 'rs']);
  });
  it('los roles sin predeterminado no seleccionan personas arbitrarias', () => {
    expect(firmantesIniciales(usuarios, 'autor', config.map(c => ({ ...c, default_user_id: undefined }))).map(f => f.rol)).toEqual(['Elaboró']);
  });
  it('Autorizó solo ofrece RS o suplente vigente aunque exista otro en la configuración', () => {
    const invalida: ElegiblesFirmantes[] = [{ rol: 'Autorizó', user_ids: ['autor', 'rs', 'suplente'] }];
    expect(opcionesRol('Autorizó', usuarios, invalida).map(u => u.id)).toEqual(['rs', 'suplente']);
    expect(() => validarSeleccion([firmantePerfil('Autorizó', usuarios[0])], usuarios, invalida)).toThrow();
  });
  it('la suplencia vencida deja de ser opción incluso si era predeterminada', () => {
    const actual = usuarios.map(u => ({ ...u, puede_autorizar: u.id === 'rs' }));
    expect(opcionesRol('Autorizó', actual, config).map(u => u.id)).toEqual(['rs']);
  });
  it('varios Elaboró y Revisó conservan identidad, ediciones y un renglón por persona', () => {
    const lista = [...firmantesIniciales(usuarios, 'autor', config), firmantePerfil('Elaboró', usuarios[1]), firmantePerfil('Revisó', usuarios[2])]
      .map(f => f.user_id === 'revisor' ? { ...f, nombre: 'Nombre editado', cargo: 'Cargo escrito' } : f);
    expect(() => validarSeleccion(lista, usuarios, config, 'autor', true)).not.toThrow();
    expect(firmantesReporte(lista).map(f => [f.rol, f.user_id])).toEqual([
      ['Elaboró', 'autor'], ['Elaboró', 'revisor'], ['Revisó', 'revisor'], ['Revisó', 'rs'], ['Autorizó', 'rs'],
    ]);
    expect(lista.filter(f => f.user_id === 'revisor').every(f => f.cargo === 'Cargo escrito')).toBe(true);
  });
  it('no permite varios Autorizó ni usuarios duplicados en un rol', () => {
    expect(() => validarSeleccion([firmantePerfil('Autorizó', usuarios[2]), firmantePerfil('Autorizó', usuarios[3])], usuarios, config)).toThrow();
    expect(() => validarSeleccion([firmantePerfil('Elaboró', usuarios[0]), firmantePerfil('Elaboró', usuarios[0])], usuarios, config, 'autor')).toThrow();
  });
  it('permite escribir cargo faltante antes de emitir', () => {
    const lista = firmantesIniciales(usuarios, 'autor', config);
    expect(() => validarSeleccion(lista, usuarios, config, 'autor')).not.toThrow();
    expect(() => validarSeleccion(lista, usuarios, config, 'autor', true)).toThrow();
    expect(() => validarSeleccion(lista.map(f => ({ ...f, cargo: f.cargo || 'Cargo QA escrito' })), usuarios, config, 'autor', true)).not.toThrow();
  });
  it('los firmantes antiguos sin user_id continúan sin inventar identidades', () => {
    expect(firmantesReporte([{ rol: 'Revisor', nombre: 'Anterior QA', cargo: 'Cargo anterior' }])[1])
      .toEqual({ rol: 'Revisó', nombre: 'Anterior QA', cargo: 'Cargo anterior' });
  });
  it('emite y guarda firmantes en una sola escritura sin convertir al RS en modificador previo', async () => {
    mocks.org.mockResolvedValue('empresa-es-prueba');
    const single = vi.fn().mockResolvedValue({ data: { id: 'at-qa', estado: 'emitido' }, error: null });
    const cadena = { eq: vi.fn(() => cadena), select: vi.fn(() => ({ single })) };
    const update = vi.fn(() => cadena);
    mocks.from.mockReturnValue({ update });
    const firmantes = firmantesIniciales(usuarios, 'autor', config);
    await cambiarEstadoAT('at-qa', 'emitido', undefined, firmantes);
    expect(update).toHaveBeenCalledExactlyOnceWith({ estado: 'emitido', firmantes_at: firmantes });
    expect(cadena.eq).toHaveBeenCalledWith('org_id', 'empresa-es-prueba');
  });
});