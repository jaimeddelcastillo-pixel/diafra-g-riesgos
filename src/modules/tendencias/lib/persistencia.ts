import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { FORMATO_DEFAULT, type FormatoForVal16, type Firmante } from './formato-forval16';
import type { Registro, Semana } from './semanas';
import { compressImage } from './compress-image';
import { TABLA_APENDICE_A, citarNormasCompartidas } from './apendice-a';

export type TablaCatalogo = 'tend_sistemas_hvac' | 'tend_areas' | 'tend_instrumentos' | 'tend_objetivos_presion' | 'tend_cambios_filtro';
export async function empresaActiva() {
  const {data,error}=await supabase.rpc('get_user_org_id');
  if(error) throw error;
  if(!data) throw new Error('No hay empresa activa');
  return data;
}
export async function listarCatalogo(tabla: TablaCatalogo) {
  const org=await empresaActiva();
  const {data,error}=await supabase.from(tabla).select('*').eq('org_id',org).order('created_at');
  if(error) throw error;
  return data ?? [];
}
export async function guardarCatalogo(tabla: TablaCatalogo, valores: Record<string,unknown>, id?: string) {
  const org=await empresaActiva();
  const q=id ? supabase.from(tabla).update(valores as never).eq('org_id',org).eq('id',id).select('id') : supabase.from(tabla).insert({...valores,org_id:org} as never).select('id');
  const {data,error}=await q;
  if(error) throw error;
  return (data as {id:string}[] | null)?.[0]?.id ?? id;
}
export async function listarRegistros():Promise<Registro[]> {
  const org=await empresaActiva();
  const {data,error}=await supabase.from('tend_registros').select('*').eq('org_id',org).order('created_at');
  if(error) throw error;
  const semanas: (Semana & {registro_id:string})[]=[];
  for(let offset=0;;offset+=1000){
    const {data:rows,error:e}=await supabase.from('tend_semanas').select('*').eq('org_id',org).order('semana_inicio').order('id').range(offset,offset+999);
    if(e) throw e;
    semanas.push(...(rows ?? []).map(r=>({...r,lecturas:r.lecturas,lecturas_hr:r.lecturas_hr ?? undefined}) as unknown as Semana & {registro_id:string}));
    if(!rows || rows.length<1000) break;
  }
  return (data ?? []).map(r=>({...r,semanas:semanas.filter(s=>s.registro_id===r.id && s.activo!==false)} as unknown as Registro));
}
export async function guardarRegistro(r:Registro) {
  const org=await empresaActiva(); const {semanas,created_at,...head}=r;
  const {error}=await supabase.from('tend_registros').upsert({...head,org_id:org},{onConflict:'id'});
  if(error) throw error;
  // Existing readings are saved only by the guarded week RPC, never by head synchronization.
  for (const semana of semanas) await guardarSemana(r.id,semana);
  // Never remove absent weeks: original synchronization deletes are intentionally not exposed.
}
export async function guardarSemana(registroId:string,s:Semana,motivo?:string) {
  const {error}=await supabase.rpc('tend_guardar_semana',{_registro:registroId,_semana:s as unknown as Json,_motivo:motivo});
  if(error) throw error;
}
export async function subirFoto(file:File) {
  if(file.type.startsWith('image/')) file=await compressImage(file);
  const org=await empresaActiva(); const ext=file.type==='image/png'?'png':file.type==='application/pdf'?'pdf':'jpg';
  const path=`${org}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from('tend-bitacoras').upload(path,file,{upsert:false,contentType:file.type});
  if(error) throw error; return path;
}
export async function retirarCaptura(tipo:'registro'|'semana'|'cambio_filtro',id:string,motivo:string) {
  const {error}=await supabase.rpc('tend_retirar',{_tipo:tipo,_id:id,_motivo:motivo}); if(error)throw error;
}
export async function corregirFechaSemana(id:string,inicio:string,motivo:string) {
  const {error}=await supabase.rpc('tend_corregir_fecha_semana',{_id:id,_inicio:inicio,_motivo:motivo || undefined}); if(error)throw error;
}
export async function historialRetirados() {
  const org=await empresaActiva();
  const [registros,semanas,cambios]=await Promise.all([
    supabase.from('tend_registros').select('*').eq('org_id',org).eq('activo',false),
    supabase.from('tend_semanas').select('*').eq('org_id',org).eq('activo',false),
    supabase.from('tend_cambios_filtro').select('*').eq('org_id',org).eq('activo',false)]);
  if(registros.error || semanas.error || cambios.error)throw registros.error ?? semanas.error ?? cambios.error;
  return [...(registros.data ?? []).map(r=>({tipo:'Registro',nombre:r.nombre,motivo:r.retirado_motivo,fecha:r.retirado_en})),...(semanas.data ?? []).map(s=>({tipo:'Semana',nombre:s.semana_inicio,motivo:s.retirado_motivo,fecha:s.retirado_en})),...(cambios.data ?? []).map(c=>({tipo:'Cambio de filtro',nombre:c.fecha,motivo:c.retirado_motivo,fecha:c.retirado_en}))];
}
export async function abrirFoto(path:string) {
  const org=await empresaActiva(); if(!path.startsWith(`${org}/`)) throw new Error('Archivo de otra empresa');
  const {data,error}=await supabase.storage.from('tend-bitacoras').createSignedUrl(path,3600);
  if(error) throw error; return data.signedUrl;
}
export async function cargarConfiguracion(nombre:string,logo:string|null):Promise<{formato:FormatoForVal16;autoemision:boolean}> {
  const org=await empresaActiva();
  const [{data:f,error},{data:c,error:e}]=await Promise.all([
    supabase.from('tend_formato').select('*').eq('org_id',org).order('version',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('tend_config').select('*').eq('org_id',org).maybeSingle()]);
  if(error || e) throw error ?? e;
  const textos: FormatoForVal16['textos'] & Record<string,string>={...FORMATO_DEFAULT.textos,...(f?.textos as Record<string,string> ?? {})};
  textos.tablaClases=TABLA_APENDICE_A;
  for (const k of Object.keys(textos)) textos[k]=citarNormasCompartidas(textos[k]);
  const empresa=textos.empresa || nombre;
  return {autoemision:c?.permitir_autoemision ?? false,formato:{...FORMATO_DEFAULT,version:f?.version ?? 0,version_formato:f?.version_formato ?? FORMATO_DEFAULT.version_formato,logo:f?.logo || logo,firmantes:(f?.firmantes ?? []) as unknown as Firmante[],textos,identidad:{nombre:empresa,logoDescripcion:textos.logoDescripcion || `Logo ${empresa}`,confidencialidad:textos.confidencialidad || `Documento confidencial propiedad de ${empresa}. Queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.`}}};
}
export async function guardarConfiguracion(f:FormatoForVal16,autoemision:boolean) {
  const org=await empresaActiva();
  const {data:ult,error:e}=await supabase.from('tend_formato').select('version').eq('org_id',org).order('version',{ascending:false}).limit(1).maybeSingle(); if(e) throw e;
  const textos={...f.textos,tablaClases:TABLA_APENDICE_A,...{empresa:f.identidad?.nombre,logoDescripcion:f.identidad?.logoDescripcion,confidencialidad:f.identidad?.confidencialidad}};
  const {error}=await supabase.from('tend_formato').insert({org_id:org,version:(ult?.version ?? 0)+1,version_formato:f.version_formato,logo:f.logo,firmantes:f.firmantes as unknown as Json,textos:textos as Json,tabla_iso:TABLA_APENDICE_A.split('\n').map(r=>r.split('|').map(c=>c.trim()))}); if(error) throw error;
  const {error:ce}=await supabase.from('tend_config').upsert({org_id:org,permitir_autoemision:autoemision},{onConflict:'org_id'}); if(ce) throw ce;
}
// T4c: catálogo normativo (lectura global; solo super_admin escribe) y revisión del catálogo.
export async function listarNormas(){
  const {data,error}=await supabase.from('tend_norma_especificaciones').select('*').order('variable').order('clase_iso');
  if(error) throw error; return (data ?? []) as unknown as import('./norma').NormaEspecificacion[];
}
export async function guardarNorma(id:string,valores:Record<string,unknown>,motivo:string){
  if(motivo.trim().length<5) throw new Error('Motivo obligatorio (mínimo 5 caracteres)');
  const {error}=await supabase.rpc('tend_guardar_norma',{_id:id,_valores:valores as unknown as Json,_motivo:motivo.trim()}); if(error) throw new Error(error.message);
}
export async function mediasTrimestre(){
  const {data,error}=await supabase.rpc('tend_media_trimestre'); if(error) throw error;
  return new Map((data ?? []).map(r=>[r.instrumento_id as string, Number(r.media)]));
}
export async function editarInstrumento(id:string,cambios:Record<string,unknown>,motivo:string){
  const {error}=await supabase.rpc('tend_editar_instrumento',{_id:id,_cambios:cambios as unknown as Json,_motivo:motivo}); if(error) throw error;
}
