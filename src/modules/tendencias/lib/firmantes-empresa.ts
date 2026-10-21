import { supabase } from '@/integrations/supabase/client';
import { empresaActiva } from './persistencia';
import type { Firmante } from './formato-forval16';

export interface UsuarioFirmante { id: string; nombre: string | null; cargo: string | null }

export interface SuplenciaFirmante {
  suplente_user_id: string; fecha_inicio: string; fecha_fin: string;
  revocada_en: string | null; facultades: string[];
}

export function esAutorizante(rol: string): boolean {
  return /^(autoriz|aprob)/.test(rol.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
}

export function tieneSuplenciaAutorizar(id: string, suplencias: SuplenciaFirmante[], ahora = Date.now()): boolean {
  return suplencias.some(s => s.suplente_user_id === id && !s.revocada_en
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
  const [{ data: perfil, error: perfilError }, { data: rs, error: rolError }, { data: suplencias, error: suplenciaError }] = await Promise.all([
    supabase.from('profiles').select('id').eq('id', id).eq('activo', true).maybeSingle(),
    supabase.rpc('has_role', { _user_id: id, _role: 'responsable_sanitario' }),
    supabase.from('org_suplencias').select('suplente_user_id,fecha_inicio,fecha_fin,revocada_en,facultades')
      .eq('org_id', org).eq('suplente_user_id', id),
  ]);
  if (perfilError || rolError || suplenciaError) throw perfilError ?? rolError ?? suplenciaError;
  return !!perfil && (!!rs || tieneSuplenciaAutorizar(id, suplencias ?? []));
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