import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { crearPlantilla, leerPlantilla, previsualizarCatalogo, type Catalogo, type PreviewCatalogo } from './lib/catalogo-excel';
import { listarNormas, mediasTrimestre } from './lib/persistencia';

export default function CatalogoExcel({catalogo,empresa,onCambio}:{catalogo:Catalogo;empresa:string;onCambio:()=>Promise<void>}) {
  const [preview,setPreview]=useState<PreviewCatalogo|null>(null);const [motivo,setMotivo]=useState('');const [busy,setBusy]=useState(false);
  const referencias=useQuery({queryKey:['t4e-referencias',empresa],queryFn:async()=>{const [normas,medias]=await Promise.all([listarNormas(),mediasTrimestre()]);return {normas,medias};}});
  const descargar=async(exportar:boolean)=>{setBusy(true);try{
    const bytes=await crearPlantilla(exportar?catalogo:undefined);
    const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a=document.createElement('a');a.href=url;a.download=`Catalogo-Tendencias-${exportar?empresa.replace(/[^\p{L}\p{N}_-]/gu,'_'):'Plantilla'}-T4e-1.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){toast.error(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
  const aplicar=async()=>{
    if(!preview || motivo.trim().length<5 || preview.errores.length)return;
    setBusy(true);try{
      const {error}=await supabase.rpc('tend_importar_catalogo_excel',{_paquete:preview.paquete as unknown as Json,_motivo:motivo.trim()});
      if(error)throw error;
      await onCambio();setPreview(null);toast.success('Catálogo aplicado y auditado');
    }catch(e){const m=(e as {message?:unknown})?.message;toast.error(typeof m==='string'&&m?m:String(e));}finally{setBusy(false);}
  };
  return <><div className="flex flex-wrap items-center gap-2">
    <Button variant="outline" disabled={busy} onClick={()=>void descargar(false)}><FileSpreadsheet className="mr-2 h-4 w-4"/>Plantilla de Excel</Button>
    <Button variant="outline" disabled={busy} onClick={()=>void descargar(true)}><Download className="mr-2 h-4 w-4"/>Exportar catálogo</Button>
    <Button variant="outline" disabled={busy || !referencias.data} onClick={()=>document.getElementById('importar-catalogo-excel')?.click()}><Upload className="mr-2 h-4 w-4"/>Importar Excel</Button>
    <Input id="importar-catalogo-excel" type="file" accept=".xlsx" className="hidden" aria-label="Archivo del catálogo" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);try{if(file.size>10*1024*1024)throw new Error('El archivo supera 10 MB');setPreview(previsualizarCatalogo(leerPlantilla(await file.arrayBuffer()),catalogo,referencias.data?.normas,referencias.data?.medias));setMotivo('');}catch(err){toast.error(err instanceof Error?err.message:String(err));}finally{setBusy(false);}}}/>
    {referencias.error && <p role="alert" className="text-sm text-destructive">No se pudieron cargar las revisiones del catálogo.</p>}
  </div><Dialog open={!!preview} onOpenChange={v=>{if(!v && !busy)setPreview(null);}}><DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Vista previa del catálogo</DialogTitle></DialogHeader>
    {preview && <><div className="flex flex-wrap gap-3 text-sm">{(['nuevo','cambia','sin cambio','error'] as const).map(estado=><span key={estado}>{estado}: {preview.filas.filter(f=>f.estado===estado).length}</span>)}</div>
    {!!preview.errores.length && <div role="alert" className="text-sm text-destructive">{preview.errores.map((err,i)=><p key={i}>{err}</p>)}</div>}
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Hoja / renglón</TableHead><TableHead>Código</TableHead><TableHead>Estado</TableHead><TableHead>Cambios / revisión</TableHead></TableRow></TableHeader><TableBody>{preview.filas.map((f,i)=><TableRow key={i}><TableCell>{f.hoja} · {f.renglon}</TableCell><TableCell>{f.codigo}</TableCell><TableCell>{f.estado}</TableCell><TableCell>{f.cambios.map(c=><p key={c.campo} className="text-xs break-words">{c.campo}: {String(c.antes ?? '—')} → {String(c.despues ?? '—')}</p>)}{f.avisos.map((a,j)=><p key={j} className="text-xs text-warning">{a}</p>)}</TableCell></TableRow>)}</TableBody></Table></div>
    <Label htmlFor="motivo-catalogo-excel">Motivo obligatorio</Label><Input id="motivo-catalogo-excel" value={motivo} onChange={e=>setMotivo(e.target.value)} disabled={busy}/>
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setPreview(null)}>Cancelar</Button><Button onClick={()=>void aplicar()} disabled={busy || motivo.trim().length<5 || !!preview.errores.length || !preview.filas.some(f=>f.estado==='nuevo' || f.estado==='cambia')}>{busy?'Aplicando…':'Aplicar catálogo'}</Button></div></>}
  </DialogContent></Dialog></>;
}