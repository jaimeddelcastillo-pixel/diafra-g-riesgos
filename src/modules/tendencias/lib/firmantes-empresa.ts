import { supabase } from '@/integrations/supabase/client';
import { empresaActiva } from './persistencia';
import type { Firmante } from './formato-forval16';

export interface UsuarioFirmante { id: string; nombre: string | null; cargo: string | null }

export async function listarUsuariosFirmantes(): Promise<UsuarioFirmante[]> {
  const org = await empresaActiva();
  const { data: miembros, error } = await supabase.from('org_members').select('user_id').eq('org_id', org);
  if (error) throw error;
  const ids = (miembros ?? []).map(m => m.user_id);
  if (!ids.length) return [];
  const { data, error: perfilError } = await supabase.from('profiles')
    .select('id,nombre,cargo').in('id', ids).eq('activo', true).order('nombre');
  if (perfilError) throw perfilError;
  return data ?? [];
}

export function elegirFirmante(actual: Firmante, id: string, usuarios: UsuarioFirmante[]): Firmante {
  const usuario = usuarios.find(u => u.id === id);
  return usuario ? { ...actual, nombre: usuario.nombre ?? '', cargo: usuario.cargo ?? '' } : actual;
}

export function usuarioDelFirmante(firmante: Firmante, usuarios: UsuarioFirmante[]): string {
  return usuarios.find(u => (u.nombre ?? '') === firmante.nombre && (u.cargo ?? '') === firmante.cargo)?.id ?? 'manual';
}