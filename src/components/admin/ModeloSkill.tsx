import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {toast} from 'sonner';
export default function ModeloSkill({clave,modelo}:{clave:string;modelo:string|null}) {
  const qc=useQueryClient();const [valor,setValor]=useState(modelo ?? '');const [motivo,setMotivo]=useState('');const [busy,setBusy]=useState(false);
  return <section className="space-y-3 border-y py-4"><Label htmlFor="modelo-skill">Modelo de la tarea</Label><Input id="modelo-skill" value={valor} onChange={e=>setValor(e.target.value)} placeholder="proveedor/modelo"/><Label htmlFor="motivo-modelo">Motivo del cambio</Label><Input id="motivo-modelo" value={motivo} onChange={e=>setMotivo(e.target.value)}/><Button variant="outline" disabled={busy || !valor.trim() || !motivo.trim() || valor.trim()===modelo} onClick={async()=>{setBusy(true);try{const {error}=await supabase.rpc('configurar_modelo_skill',{_clave:clave,_modelo:valor.trim(),_motivo:motivo.trim()});if(error)throw error;await qc.invalidateQueries({queryKey:['ia-skills']});setMotivo('');toast.success('Modelo actualizado con motivo en la bitácora');}catch(e){toast.error(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}}>Guardar modelo</Button></section>;
}