import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import Marco from './Marco';
import { useTendencias } from './hooks';
import { retirarCaptura } from './lib/persistencia';
import { DIAS, TURNOS, rangoFechasRegistro } from './lib/semanas';

export default function ReporteDetalle() {
  const { id } = useParams();
  const q = useTendencias();
  const navigate = useNavigate();
  const registro = q.data?.registros.find(r => r.id === id);
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const retirar = async () => {
    if (!registro || !q.captura || !motivo.trim()) return;
    setBusy(true);
    try {
      await retirarCaptura('registro', registro.id, motivo);
      await q.refresh();
      toast.success('Registro retirado y conservado en historial');
      navigate('/tendencias/reporte');
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <Marco titulo="Detalle del registro">
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild><Link to="/tendencias/reporte"><ArrowLeft className="mr-2 h-4 w-4"/>Volver</Link></Button>
      {registro?.activo && q.captura && <><Button variant="outline" asChild><Link to={`/tendencias/captura?modulo=${registro.modulo}&registroId=${registro.id}`}><Pencil className="mr-2 h-4 w-4"/>Editar</Link></Button><Button variant="outline" onClick={() => setOpen(true)}><Archive className="mr-2 h-4 w-4"/>Retirar</Button></>}
    </div>
    {q.isPending ? <p>Cargando…</p> : q.error ? <p role="alert">{q.error.message}</p> : !registro ? <p role="alert">Registro no disponible</p> : <>
      <section className="space-y-2 border-b pb-4"><h2 className="text-xl font-semibold">{registro.nombre}</h2><p>{q.data?.instrumentos.find(i => i.id === registro.instrumento_id)?.codigo ?? registro.modulo} · {rangoFechasRegistro(registro)}</p><p className="text-muted-foreground">{registro.activo ? 'Activo' : 'Retirado · solo consulta'} · {registro.iso ?? '—'} · {registro.semanas.length} semanas</p></section>
      {registro.semanas.map(s => <section key={s.id ?? s.semana_inicio} className="space-y-3 border-b py-4"><h3 className="font-semibold">Semana {s.semana_inicio}</h3>{(['lecturas', ...(registro.modulo === 'temphr' ? ['lecturas_hr'] : [])] as const).map(campo => <div key={campo} className="overflow-x-auto"><h4>{campo === 'lecturas_hr' ? 'Humedad relativa' : 'Lecturas'} · {campo === 'lecturas_hr' ? '%' : s.unidad}</h4><Table><TableHeader><TableRow><TableHead>Día</TableHead>{TURNOS.map(t => <TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{DIAS.map(d => <TableRow key={d}><TableCell>{d}</TableCell>{TURNOS.map(t => { const p = s[campo as 'lecturas' | 'lecturas_hr']?.find(p => p.dia === d && p.turno === t); return <TableCell key={t}>{p?._na ? 'N/A' : p?.valor ?? '—'}<span className="block text-xs text-muted-foreground">{p?.hora} · {p?.quien}{p?._dudoso && !p._edited ? ' · Dudosa' : ''}</span></TableCell>; })}</TableRow>)}</TableBody></Table></div>)}{s.observaciones && <p>{s.observaciones}</p>}</section>)}
    </>}
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent><DialogHeader><DialogTitle>Retirar registro</DialogTitle></DialogHeader><Label htmlFor="motivo-retirar-registro">Motivo obligatorio</Label><Input id="motivo-retirar-registro" value={motivo} onChange={e => setMotivo(e.target.value)}/><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy || !motivo.trim()} onClick={() => void retirar()}>Confirmar retiro</Button></div></DialogContent></Dialog>
  </Marco>;
}