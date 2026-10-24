import { supabase } from '@/integrations/supabase/client';
export type RolSuplencia = 'admin' | 'responsable_sanitario' | 'aseguramiento_calidad';
export const facultadesSuplencia = (rol: RolSuplencia) => rol === 'aseguramiento_calidad' ? ['autorizar', 'anular', 'validar_kpi'] : ['autorizar', 'anular'];
export function errorSuplencia(error: unknown): string {
  const e = error as { message?: string; code?: string }; const message = e?.message ?? String(error);
  if (e?.code === '23514' || /check constraint|violates.*constraint/.test(message)) return 'No se pudo guardar la suplencia. Revisa el rol, las facultades y las fechas.';
  if (e?.code === '23503') return 'Selecciona un titular y un suplente activos de esta empresa.';
  if (e?.code === '23505') return 'Ya existe una designación que se enciman con estos datos. Revisa el historial.';
  if (/permission denied|row.level security|42501/i.test(message)) return 'No tienes permiso para realizar esta acción en la empresa activa.';
  if (/^[\w\sáéíóúÁÉÍÓÚñÑ.,;:()—¿?¡!<>/\-]+$/.test(message) && !/relation|constraint|column|function|SQL|syntax/i.test(message)) return message;
  return 'No se pudo completar la acción. Revisa los datos y vuelve a intentarlo.';
}
export async function designarSuplencia(input: { rol: RolSuplencia; titular: string; suplente: string; inicio: string; fin: string; categoria: string; motivo: string }) {
  const { data, error } = await supabase.rpc('designar_suplencia', { _rol: input.rol, _titular: input.titular, _suplente: input.suplente, _inicio: new Date(input.inicio).toISOString(), _fin: new Date(input.fin).toISOString(), _categoria: input.categoria, _motivo: input.motivo });
  if (error) throw error; return data;
}