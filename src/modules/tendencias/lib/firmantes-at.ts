import { supabase } from '@/integrations/supabase/client';
import { ROLES_FIRMA, type ElegiblesFirmantes, type Firmante } from './formato-forval16';
import type { UsuarioFirmante } from './firmantes-empresa';

export interface UsuarioElegible extends UsuarioFirmante { puede_autorizar: boolean }
export async function listarElegibles(): Promise<UsuarioElegible[]> {
  const { data, error } = await supabase.rpc('tend_usuarios_firmantes');
  if (error) throw error;
  return data ?? [];
}

export function opcionesRol(rol: ElegiblesFirmantes['rol'], usuarios: UsuarioElegible[], config?: ElegiblesFirmantes[], autorId?: string): UsuarioElegible[] {
  const ids = config?.find(c => c.rol === rol)?.user_ids ?? [];
  return usuarios.filter(u => (rol !== 'Autorizó' || u.puede_autorizar)
    && (config === undefined || ids.includes(u.id) || (rol === 'Elaboró' && u.id === autorId)));
}

export function firmantePerfil(rol: string, usuario: UsuarioFirmante): Firmante {
  return { rol, user_id: usuario.id, nombre: usuario.nombre ?? '', cargo: usuario.cargo ?? '' };
}

export function firmantesIniciales(usuarios: UsuarioElegible[], autorId: string, config?: ElegiblesFirmantes[]): Firmante[] {
  return ROLES_FIRMA.flatMap(rol => {
    const predeterminado = rol === 'Elaboró' ? autorId : config?.find(c => c.rol === rol)?.default_user_id;
    const usuario = opcionesRol(rol, usuarios, config, autorId).find(u => u.id === predeterminado);
    return usuario ? [firmantePerfil(rol, usuario)] : [];
  });
}

export function validarSeleccion(firmantes: Firmante[], usuarios: UsuarioElegible[], config?: ElegiblesFirmantes[], autorId?: string, emitir = false): void {
  const claves = new Set<string>();
  for (const f of firmantes) {
    const rol = ROLES_FIRMA.find(r => r === f.rol);
    if (!rol || !opcionesRol(rol, usuarios, config, autorId).some(u => u.id === f.user_id)) throw new Error('Selecciona firmantes elegibles de la empresa para cada rol');
    const clave = `${rol}/${f.user_id}`;
    if (claves.has(clave)) throw new Error('Un usuario no puede repetirse en el mismo rol');
    claves.add(clave);
  }
  if (firmantes.filter(f => f.rol === 'Autorizó').length > 1) throw new Error('Autorizó admite un solo firmante');
  if (emitir && ROLES_FIRMA.some(rol => !firmantes.some(f => f.rol === rol))) throw new Error('Selecciona Elaboró, Revisó y Autorizó antes de emitir');
  if (emitir && firmantes.some(f => !f.nombre.trim() || !f.cargo.trim())) throw new Error('Cada firmante requiere nombre y cargo antes de emitir');
}