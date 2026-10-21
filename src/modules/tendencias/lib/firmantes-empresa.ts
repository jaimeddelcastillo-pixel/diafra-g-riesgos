import { supabase } from '@/integrations/supabase/client';
import { empresaActiva } from './persistencia';
import type { Firmante } from './formato-forval16';

export interface UsuarioFirmante { id: string; nombre: string | null; cargo: string | null }

export interface SuplenciaFirmante {
  suplente_user_id: string; fecha_inicio: string; fecha_fin: string;
  revocada_en: string | null; facultades: string[];
  estado?: string; aceptada_en?: string | null; rol_sustituido?: string;
}

export function esAutorizante(rol: string): boolean {
  return /^(autoriz|aprob)/.test(rol.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
}

export function tieneSuplenciaAutorizar(id: string, suplencias: SuplenciaFirmante[], ahora = Date.now()): boolean {
  return suplencias.some(s => s.suplente_user_id === id && !s.revocada_en
    && s.estado === 'activa' && !!s.aceptada_en && s.rol_sustituido === 'responsable_sanitario'
    && Date.parse(s.fecha_inicio) <= ahora && ahora < Date.parse(s.fecha_fin)
    && s.facultades.includes('autorizar'));
}

/** Advisory only: actual issuance still checks permissions and separation server-side. */
export async function verificarAutorizante(id: string): Promise<boolean> {
  const org = await empresaActiva();
  const { data: miembro, error } = await supabase.from('org_members').select('user_id')
    .eq('org_id', org).eq('user_id', id).maybeSingle();
  if (error) throw error;
  if (!miembro) return false;
  const [{ data: perfil, error: perfilError }, { data: rs, error: rolError }] = await Promise.all([
    supabase.from('profiles').select('id').eq('id', id).eq('activo', true).maybeSingle(),
    supabase.rpc('rol_efectivo', { _usuario: id, _rol: 'responsable_sanitario' }),
  ]);
  if (perfilError || rolError) throw perfilError ?? rolError;
  return !!perfil && !!rs;
}

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
  if (id === 'manual') {
    const { user_id, ...manual } = actual;
    return manual;
  }
  const usuario = usuarios.find(u => u.id === id);
  return usuario ? { ...actual, user_id: usuario.id, nombre: usuario.nombre ?? '', cargo: usuario.cargo ?? '' } : actual;
}

export function usuarioDelFirmante(firmante: Firmante, usuarios: UsuarioFirmante[]): string {
  // Never infer a real identity from editable text or upgrade historical templates implicitly.
  return firmante.user_id ?? 'manual';
}