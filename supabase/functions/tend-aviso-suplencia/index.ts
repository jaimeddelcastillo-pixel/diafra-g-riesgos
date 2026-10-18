import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders} from 'npm:@supabase/supabase-js@2/cors';
import {z} from 'npm:zod@3';
import {resolverContextoOrg,ContextoOrgError} from '../_shared/contexto-org.ts';
import {enviarYRegistrar} from '../_shared/transactional-email-templates/enviar-y-registrar.ts';
const body=z.object({id:z.string().uuid().optional()});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});const responder=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});try{
 if(req.method!=='POST')return responder({error:'Método no permitido'},405);
 const ctx=await resolverContextoOrg(req);if(ctx.esSuperAdmin || !['admin','responsable_sanitario'].includes(ctx.rolEnOrg ?? ''))return responder({error:'Solo admin o RS registra avisos'},403);
 const parsed=body.safeParse(await req.json());if(!parsed.success)return responder({error:'Solicitud inválida'},400);
 const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url || !key)throw new Error('Correo no configurado');const admin=createClient(url,key);
 let query=admin.from('org_suplencias').select('*').eq('org_id',ctx.orgId).eq('aviso_rs_requerido',true).is('aviso_rs_enviado_en',null).order('created_at').limit(30);if(parsed.data.id)query=query.eq('id',parsed.data.id);
 const {data:rows,error}=await query;if(error)throw error;const {data:org}=await admin.from('organizations').select('nombre').eq('id',ctx.orgId).single();const resultados=[];
 for(const s of rows ?? []){const {data:miembro}=await admin.from('org_members').select('user_id').eq('org_id',ctx.orgId).eq('user_id',s.rs_titular_user_id).eq('role','responsable_sanitario').maybeSingle();const {data:p}=await admin.from('profiles').select('email,activo').eq('id',miembro?.user_id ?? '').maybeSingle();let fallo:string|null=null;if(!p?.activo || !p.email)fallo='RS titular sin correo activo';else{const r=await enviarYRegistrar({templateName:'suplencia-rs',recipientEmail:p.email,idempotencyKey:`suplencia-rs-${s.id}`,templateData:{organizacion:org?.nombre,suplente:s.suplente_nombre,cargo:s.suplente_cargo,inicio:s.fecha_inicio,fin:s.fecha_fin,facultades:s.facultades.join(', '),motivo:s.motivo}});if(!r.data?.success)fallo=r.error?.message ?? r.data?.reason ?? 'Envío pendiente';}
 const {error:e}=await admin.rpc('org_suplencia_aviso_resultado',{_id:s.id,_enviado:!fallo,_error:fallo});if(e)throw e;resultados.push({id:s.id,enviado:!fallo,error:fallo});}
 return responder({resultados});
 }catch(e){return responder({error:e instanceof Error?e.message:'No se pudo enviar el aviso'},e instanceof ContextoOrgError?e.status:500);}});