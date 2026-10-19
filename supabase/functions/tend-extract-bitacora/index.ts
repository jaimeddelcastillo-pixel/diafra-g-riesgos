import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders} from 'npm:@supabase/supabase-js@2/cors';
import {z} from 'npm:zod@3';
class HttpError extends Error{constructor(m:string,public status:number){super(m);}}
import {resolverContextoOrg,ContextoOrgError} from '../_shared/contexto-org.ts';
import {cargarSkill,interpolar,registrarSkillFaltante} from '../_shared/skills.ts';
import {leerBitacoraPrivada} from '../_shared/documento-contenido.ts';
import {contextoFechaMexico,fechaMexico} from '../_shared/fecha-mexico.ts';
import {normalizarLecturas} from '../_shared/bitacora-lecturas.ts';
import {resolverFechasBitacora} from '../_shared/bitacora-fechas.ts';
import {getLovableAiGatewayRunId,getLovableAiGatewayResponseHeaders} from '../_shared/run-id.ts';

const requestSchema=z.object({registro_id:z.string().uuid(),foto_path:z.string().min(1).max(500)}).strict();
const texto=z.union([z.string(),z.number()]).nullish().transform(v=>v==null?'':String(v));
const lectura=z.object({dia:z.string(),turno:z.string(),valor:z.number().nullish().transform(v=>v??null),hora:texto.transform(v=>v||null),quien:texto.transform(v=>v||null),confianza:z.number().nullish().transform(v=>v??null)});
const comunes={mes:texto,anio:texto,instrumento:texto,area:texto,observaciones:texto};
const anioDudoso=z.boolean().nullish().transform(v=>v??null);
const dias=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const turnos=['Mañana','Media tarde','Tarde'];
function comprobarLecturas(rows:unknown){
 const parsed=normalizarLecturas(z.array(lectura).parse(rows));
 if(parsed.length!==21 || new Set(parsed.map(p=>`${p.dia}/${p.turno}`)).size!==21 || parsed.some(p=>!dias.includes(p.dia) || !turnos.includes(p.turno)))throw new Error('Propuesta incompleta: requiere 21 combinaciones únicas por variable');
 return parsed.map(p=>({...p,confianza:p.confianza===null?null:Math.max(0,Math.min(1,p.confianza))}));
}
Deno.serve(async req=>{
 const respond=(data:unknown,status=200,extra?:HeadersInit)=>new Response(JSON.stringify(data),{status,headers:getLovableAiGatewayResponseHeaders(extra,{...corsHeaders,'Content-Type':'application/json'})});
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return respond({error:'Método no permitido'},405);
  let admin:any;let id:string|undefined;let orgId:string|undefined;let skills:unknown[]=[];let modelo:string|undefined;let runId:string|null|undefined;
 try{
  const ctx=await resolverContextoOrg(req);orgId=ctx.orgId;
  if(ctx.esSuperAdmin || !['admin','responsable_sanitario','comite_tecnico','operador'].includes(ctx.rolEnOrg ?? ''))return respond({error:'Sin permiso de extracción'},403);
  const body=requestSchema.safeParse(await req.json());if(!body.success)return respond({error:'Solicitud inválida'},400);
  const url=Deno.env.get('SUPABASE_URL');const anon=Deno.env.get('SUPABASE_ANON_KEY');const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const key=Deno.env.get('LOVABLE_API_KEY');
  if(!url || !anon || !service || !key)return respond({error:'Extracción IA no configurada'},401);
  const user=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization') ?? ''}},auth:{persistSession:false}});admin=createClient(url,service);
  const {data:acceso,error:ae}=await user.rpc('tend_acceso',{_org:ctx.orgId,_escritura:true,_roles:['operador','comite_tecnico','admin','responsable_sanitario']});if(ae || !acceso)return respond({error:'Tendencias no disponible para extracción'},403);
  const {data:pausa,error:pauseError}=await admin.from('tend_ia_control').select('*').eq('org_id',ctx.orgId).maybeSingle();if(pauseError)throw pauseError;if(pausa?.bloqueado)return respond({error:pausa.mensaje},pausa.status ?? 403);
  const {data:r,error:re}=await user.from('tend_registros').select('id,modulo,nombre,activo').eq('org_id',ctx.orgId).eq('id',body.data.registro_id).single();if(re || !r?.activo)return respond({error:'Registro no disponible'},404);
  if(!['temphr','presiones','filtros'].includes(r.modulo))return respond({error:'Agua se captura manualmente'},400);
  const media=await leerBitacoraPrivada(user,ctx.orgId,body.data.foto_path);
  const clave=`extraccion_bitacora_${r.modulo}`;let skill;
  try{skill=await cargarSkill(admin,clave);}catch{throw await registrarSkillFaltante(admin,ctx.orgId,clave,'tend-extract-bitacora');}
   const {data:config,error:ce}=await admin.from('ia_skills').select('modelo_ia').eq('clave',clave).eq('ambito','tarea').single();
   if(ce || !config?.modelo_ia)return respond({error:'Modelo de la skill no configurado'},401);
   modelo=config.modelo_ia;
   if(!modelo?.startsWith('google/'))return respond({error:'El modelo configurado requiere un contrato de extracción compatible'},400);
   skills=[{id:skill.id,clave:skill.clave,version:skill.version,sha256:skill.sha256,estado:'vigente',modelo_ia:modelo}];
   const {data:primera,error:pe}=await user.from('tend_semanas').select('semana_inicio').eq('org_id',ctx.orgId).eq('registro_id',r.id).order('semana_inicio').limit(1).maybeSingle();
   if(pe)throw pe;
   const anioActual=Number(fechaMexico().slice(0,4));
   const vars={empresa:'',anio_min:String(primera?Number(primera.semana_inicio.slice(0,4)):anioActual-1),anio_max:String(anioActual+1)};
  const {data:org,error:oe}=await admin.from('organizations').select('nombre').eq('id',ctx.orgId).single();if(oe)throw oe;
  const {data:reserva,error:reserveError}=await user.from('tend_extracciones').insert({org_id:ctx.orgId,registro_id:r.id,modulo:r.modulo,foto_path:body.data.foto_path,solicitado_por:ctx.userId}).select('id').single();if(reserveError)throw reserveError;id=reserva.id;
  const fechas=z.array(z.object({dia:z.string(),fecha:z.string()}));
   const schema=r.modulo==='temphr'?z.object({...comunes,anio_dudoso:anioDudoso,fechas_columnas:fechas,lecturas_t:z.array(lectura),lecturas_hr:z.array(lectura)}):z.object({...comunes,anio_dudoso:anioDudoso,unidad:texto,fechas_columnas:fechas,lecturas:z.array(lectura)});
    const runIn=getLovableAiGatewayRunId(req);
    const aiRes=await fetch('https://ai.gateway.lovable.dev/v1/chat/completions',{method:'POST',signal:req.signal,headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json','X-Lovable-AIG-SDK':'fetch',...(runIn?{'X-Lovable-AIG-Run-ID':runIn}:{})},body:JSON.stringify({model:modelo,reasoning_effort:'minimal',response_format:{type:'json_object'},messages:[{role:'system',content:`${interpolar(skill.texto,{...vars,empresa:org.nombre})}\n${contextoFechaMexico()}\nResponde únicamente con JSON.`},{role:'user',content:[{type:'image_url',image_url:{url:`data:${media.mime};base64,${media.base64}`}}]}]})});
    runId=aiRes.headers.get('X-Lovable-AIG-Run-ID') ?? runIn;
    if(!aiRes.ok){const t=await aiRes.text();let m=`Error de IA (${aiRes.status})`;try{const j=JSON.parse(t);m=j.message ?? j.error?.message ?? m;}catch{/* keep */}throw new HttpError(m,aiRes.status);}
    const aiJson=await aiRes.json();
    const texto=String(aiJson?.choices?.[0]?.message?.content ?? '').replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
    if(!texto)throw new Error('La IA no produjo una propuesta; solicitud terminada');
   let propuesta:any;
   try{propuesta=schema.parse(JSON.parse(texto));}catch{throw new Error('La IA no produjo una propuesta válida; la foto permanece para captura manual');}
  if(r.modulo==='temphr'){propuesta.lecturas_t=comprobarLecturas(propuesta.lecturas_t);propuesta.lecturas_hr=comprobarLecturas(propuesta.lecturas_hr);}else propuesta.lecturas=comprobarLecturas(propuesta.lecturas);
   const rows=[...(propuesta.lecturas_t ?? []),...(propuesta.lecturas_hr ?? []),...(propuesta.lecturas ?? [])];
   const fechasComprobadas=resolverFechasBitacora(propuesta,primera?.semana_inicio,anioActual);
   propuesta.fechas_columnas_originales=propuesta.fechas_columnas;
   propuesta.fechas_columnas=fechasComprobadas.fechas_columnas;
   propuesta.fechas_requieren_revision=fechasComprobadas.requiere_revision;
   propuesta.requiere_revision=fechasComprobadas.requiere_revision || (rows.length>0 && rows.filter(p=>p.valor===null || p.confianza===null || p.confianza<0.70).length/rows.length>0.15);
   const usage=aiJson?.usage ?? {};
   const {error:saveError}=await admin.rpc('tend_extraccion_resultado',{_id:id,_propuesta:propuesta,_skills:skills,_modelo:modelo,_input:usage.prompt_tokens ?? 0,_output:usage.completion_tokens ?? 0});if(saveError)throw saveError;
    return respond({id,propuesta,skills_usadas:skills,modelo_ia:modelo},200,runId?{'X-Lovable-AIG-Run-ID':runId}:undefined);
 }catch(e){
   let status=e instanceof ContextoOrgError||e instanceof HttpError?e.status:500;const message=e instanceof Error?e.message:'No se pudo extraer la bitácora';
   if(e instanceof DOMException && e.name==='AbortError')status=499;
  if(admin && orgId && [402,403].includes(status)){const {error}=await admin.from('tend_ia_control').upsert({org_id:orgId,bloqueado:true,status,mensaje:message,updated_at:new Date().toISOString()});if(error)console.error('No se pudo persistir pausa IA',error.code);}
  if(admin && id){const {error}=await admin.rpc('tend_extraccion_resultado',{_id:id,_propuesta:null,_skills:skills,_modelo:modelo,_error:message});if(error)console.error('No se pudo registrar error de extracción',error.code);}
  return respond({error:message,id},status);
 }
});