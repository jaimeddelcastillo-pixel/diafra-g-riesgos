import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { TrazaIA } from '@/lib/skills-presentacion';
import type { Semana } from './semanas';
export type ResultadoExtraccion = { id: string; propuesta: Record<string, unknown>; skills_usadas: TrazaIA['skills_usadas']; modelo_ia: string };
export class ErrorExtraccion extends Error {
  constructor(message: string, public status: number) { super(message); }
  get terminal() { return [401, 402, 403, 404].includes(this.status); }
}
export async function extraerBitacora(registro: string, path: string): Promise<ResultadoExtraccion> {
  const { data, error } = await supabase.functions.invoke('tend-extract-bitacora', { body: { registro_id: registro, foto_path: path } });
  if (error || data?.error) {
    let message = data?.error ?? error?.message ?? 'No se pudo extraer'; let status = 500;
    if (error && 'context' in error && error.context instanceof Response) {
      status = error.context.status;
      try { const response = await error.context.json(); message = response.error ?? message; } catch { /* Keep safe error. */ }
    }
    throw new ErrorExtraccion(message, status);
  }
  if (!data?.id || !data?.propuesta) throw new Error('No se recibió una propuesta válida');
  return data as ResultadoExtraccion;
}
export async function confirmarExtraccion(id: string, semana: Semana, motivo: string) {
  const { error } = await supabase.rpc('tend_confirmar_extraccion', { _id: id, _semana: semana as unknown as Json, _motivo: motivo || undefined });
  if (error) throw error;
}