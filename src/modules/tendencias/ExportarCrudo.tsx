import {useState} from 'react';
import {Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {toast} from 'sonner';
import {exportarCrudo} from './lib/export-crudo';
import type {Registro} from './lib/semanas';
export default function ExportarCrudo({registro}:{registro:Registro}) {
  const [desde,setDesde]=useState('');const [hasta,setHasta]=useState('');const [busy,setBusy]=useState(false);
  return <section className="flex flex-wrap items-end gap-3 border-t pt-4"><div className="space-y-2"><Label htmlFor="crudo-desde">Desde</Label><Input id="crudo-desde" type="date" value={desde} onChange={e=>setDesde(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="crudo-hasta">Hasta</Label><Input id="crudo-hasta" type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></div><Button variant="outline" disabled={busy || !desde || !hasta || desde>hasta} onClick={async()=>{setBusy(true);try{await exportarCrudo(registro,desde,hasta);toast.success('Excel de datos crudos descargado');}catch(e){toast.error(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}}><Download className="mr-2 h-4 w-4"/>{busy?'Exportando…':'Excel de datos crudos'}</Button></section>;
}