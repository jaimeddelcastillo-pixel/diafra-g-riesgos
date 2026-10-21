import {supabase} from '@/integrations/supabase/client';
import type {Json} from '@/integrations/supabase/types';
import {empresaActiva} from './persistencia';
import type {Firmante} from './formato-forval16';
import type {RegistroAT} from './snapshot-forval16';
export async function listarAT(){const org=await empresaActiva();const {data,error}=await supabase.from('tend_registros_at').select('*').eq('org_id',org).order('codigo',{ascending:false});if(error)throw error;return data ?? [];}
export async function guardarAT(valores:Record<string,unknown>,id?:string):Promise<RegistroAT>{const org=await empresaActiva();const q=id?supabase.from('tend_registros_at').update(valores as never).eq('id',id).eq('org_id',org):supabase.from('tend_registros_at').insert({...valores,org_id:org,codigo:''} as never);const {data,error}=await q.select().single();if(error)throw error;return data;}
export async function cambiarEstadoAT(id:string,estado:'emitido'|'anulado'|'borrador',motivo?:string,firmantes?:Firmante[]){return guardarAT({estado,...(estado==='emitido' && firmantes?{firmantes_at:firmantes}:{}),...(estado==='borrador'?{motivo_version:motivo}:estado==='anulado'?{motivo_anulacion:motivo}:{})},id);}
export async function historialAT(id:string){const org=await empresaActiva();const {data,error}=await supabase.from('tend_registros_at_historial').select('*').eq('org_id',org).eq('registro_id',id).order('version',{ascending:false});if(error)throw error;return data ?? [];}
export const json=(v:unknown)=>v as Json;