import {useEffect,useRef,useState} from 'react';
import {fotoParaExtraer,type FotoPendiente} from './lib/captura-controles';
import {useAuth} from '@/hooks/useAuth';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import type {Json} from '@/integrations/supabase/types';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Label} from '@/components/ui/label';
import {InformacionRespuestaIA} from '@/components/InformacionRespuestaIA';
import type {TrazaIA} from '@/lib/skills-presentacion';
import {Sparkles,Check} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {detectarLunesFoto,rangoRegistro} from './lib/fotos-bitacora';
import {extraerBitacora} from './lib/extraccion-cliente';
import {toast} from 'sonner';
import {empresaActiva} from './lib/persistencia';
import {propuestaSemana,revisionPendiente} from './lib/extraccion';
import {tieneLecturas} from './lib/captura-controles';
import type {Registro,Semana} from './lib/semanas';

export default function ExtraccionBitacora({registro,semana,puedeEditar,motivo,onPropuesta,onConfirmado,onFecha,fotoNueva}:{fotoNueva?:FotoPendiente;registro:Registro;semana:Semana|null;puedeEditar:boolean;motivo:string;onPropuesta:(s:Semana)=>void;onConfirmado:()=>void;onFecha:(fecha:string)=>void}){
 const auth=useAuth();
 const [busy,setBusy]=useState(false);const [revisado,setRevisado]=useState(false);const [id,setId]=useState<string|null>(null);
 const [fechaDetectada,setFechaDetectada]=useState('');
 const requiereMotivo=tieneLecturas(registro.semanas.find(s=>s.semana_inicio===semana?.semana_inicio));
 const historial=useQuery({queryKey:['tend-extracciones',registro.id],queryFn:async()=>{const org=await empresaActiva();const {data,error}=await supabase.from('tend_extracciones').select('*').eq('org_id',org).eq('registro_id',registro.id).order('created_at',{ascending:false});if(error)throw error;return data ?? [];}});
 const consumo=useQuery({queryKey:['tend-consumo',auth.orgId],queryFn:async()=>{const org=await empresaActiva();const {count,error}=await supabase.from('tend_extracciones').select('id',{count:'exact',head:true}).eq('org_id',org);if(error)throw error;return count ?? 0;}});
 const cargar=(x:NonNullable<typeof historial.data>[number])=>{if(!semana || !x.valores_propuestos || typeof x.valores_propuestos!=='object')return;const fecha=detectarLunesFoto(x.valores_propuestos as Record<string,unknown>);setFechaDetectada(fecha);onPropuesta({...propuestaSemana(x.valores_propuestos as Record<string,unknown>,registro,fecha || semana.semana_inicio),foto_path:x.foto_path});if(fecha)onFecha(fecha);setId(x.id);setRevisado(false);};
 const extraer=async(foto=semana?.foto_path)=>{if(!foto || !semana || !puedeEditar)return;setBusy(true);try{const data=await extraerBitacora(registro.id,foto);const fecha=detectarLunesFoto(data.propuesta);setFechaDetectada(fecha);onPropuesta({...propuestaSemana(data.propuesta,registro,fecha || semana.semana_inicio),foto_path:foto});if(fecha)onFecha(fecha);setId(data.id);setRevisado(false);toast.success('Propuesta lista para revisión');}catch(e){toast.error(e instanceof Error?e.message:String(e));}finally{setBusy(false);void historial.refetch();void consumo.refetch();}};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 const consumida=useRef(fotoNueva?.id);
 useEffect(()=>{const foto=fotoParaExtraer(fotoNueva,registro.id,consumida.current);if(!foto || registro.modulo==='agua')return;consumida.current=fotoNueva?.id;void extraer(foto);},[fotoNueva?.id]);
 if(registro.modulo==='agua')return null;
 const confirmar=async()=>{if(!id || !semana || !revisado || revisionPendiente(semana) || (requiereMotivo && !motivo.trim()))return;setBusy(true);try{const {error}=await supabase.rpc('tend_confirmar_extraccion',{_id:id,_semana:semana as unknown as Json,_motivo:motivo || undefined});if(error)throw error;toast.success('Lecturas confirmadas');setId(null);setRevisado(false);onConfirmado();await historial.refetch();}catch(e){toast.error(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <section className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">Extracción de bitácora</h3><span className="text-xs text-muted-foreground">Consumo de empresa: {consumo.data ?? '…'} extracciones</span>{puedeEditar && <Button variant="outline" disabled={busy || !semana?.foto_path} onClick={()=>void extraer()}><Sparkles className="h-4 w-4 mr-2"/>{busy?'Procesando…':'Extraer propuesta'}</Button>}</div>{id && puedeEditar && <div className="space-y-2"><p className="text-sm">{fechaDetectada?`Lunes detectado: ${fechaDetectada}`:'No se detectó el lunes'}</p><Label htmlFor="fecha-propuesta">Lunes confirmado</Label><Input id="fecha-propuesta" type="date" value={semana?.semana_inicio ?? ''} onChange={e=>{if(!semana || !e.target.value)return;onFecha(e.target.value);onPropuesta({...semana,semana_inicio:e.target.value});setRevisado(false);}}/><Label className="flex items-center gap-2"><Checkbox checked={revisado} onCheckedChange={v=>setRevisado(v===true)}/>Revisé la fecha y corregí las lecturas</Label>{semana && revisionPendiente(semana) && <p role="alert" className="text-sm text-destructive">Hay celdas dudosas pendientes de corregir o marcar N/A.</p>}{requiereMotivo && !motivo.trim() && <p role="alert" className="text-sm text-destructive">La semana ya tiene lecturas. Escribe el motivo de corrección antes de confirmar.</p>}<Button disabled={busy || !revisado || !semana || revisionPendiente(semana) || (requiereMotivo && !motivo.trim())} onClick={()=>void confirmar()}><Check className="h-4 w-4 mr-2"/>Confirmar propuesta</Button></div>}{historial.error && <p role="alert">{historial.error.message}</p>}{historial.data?.map(x=><div key={x.id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm"><span>{new Date(x.created_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})} · {x.estado}</span><InformacionRespuestaIA skills_usadas={x.skills_usadas as unknown as TrazaIA['skills_usadas']} modelo_ia={x.modelo_ia}/>{x.estado==='propuesta' && puedeEditar && <Button size="sm" variant="outline" disabled={busy || !semana} onClick={()=>{try{cargar(x);}catch(e){toast.error(String(e));}}}>Revisar propuesta</Button>}{x.error && <span role="alert" className="text-destructive">{x.error}</span>}</div>)}</section>;
}