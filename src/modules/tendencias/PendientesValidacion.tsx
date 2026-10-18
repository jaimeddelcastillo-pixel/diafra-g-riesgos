import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Instrumento, AreaClasificada } from './lib/catalogos';
import { guardarCatalogo } from './lib/persistencia';

export default function PendientesValidacion({ instrumentos, areas, puedeEditar, onEditar, onCambio }: { instrumentos: Instrumento[]; areas: AreaClasificada[]; puedeEditar: boolean; onEditar: (i: Instrumento) => void; onCambio: () => void }) {
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [area, setArea] = useState('todos');
  const [accion, setAccion] = useState<{ i: Instrumento; campo: 'spec_estado' | 'area_estado'; estado: 'validada' | 'na' }>();
  const [referencia, setReferencia] = useState('');
  const [busy, setBusy] = useState(false);
  const activos = instrumentos.filter(i => i.activo);
  const pendienteSpec = (i: Instrumento) => !i.spec_estado || i.spec_estado === 'pendiente';
  const pendienteArea = (i: Instrumento) => i.area_estado === 'pendiente';
  const pendientes = activos.filter(i => pendienteSpec(i) || pendienteArea(i));
  const filas = pendientes.filter(i => (filtro === 'todos' || (filtro === 'spec' ? pendienteSpec(i) : pendienteArea(i))) && (tipo === 'todos' || i.tipo === tipo) && (area === 'todos' || i.area_id === area) && `${i.codigo} ${i.parametro} ${i.area_libre ?? ''}`.toLowerCase().includes(buscar.toLowerCase()));
  const elegir = (i: Instrumento, campo: 'spec_estado' | 'area_estado', estado: 'validada' | 'na') => { setAccion({ i, campo, estado }); setReferencia(i.spec_referencia ?? ''); };
  const confirmar = async () => {
    if (!accion || !puedeEditar) return;
    const { i, campo, estado } = accion;
    if (campo === 'area_estado' && !i.area_id && !i.area_libre?.trim()) { toast.error('Asigna el área antes de validarla'); return; }
    if (campo === 'spec_estado' && estado === 'validada' && i.spec_lie == null && i.spec_lse == null && !i.spec_texto?.trim() && !i.especificacion?.trim()) { toast.error('Edita la especificación o los límites antes de validar'); return; }
    setBusy(true);
    try { await guardarCatalogo('tend_instrumentos', { [campo]: estado, ...(campo === 'spec_estado' ? { spec_referencia: referencia.trim() || null, spec_fecha_validacion: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) } : {}) }, i.id); setAccion(undefined); onCambio(); toast.success(estado === 'na' ? 'Especificación marcada N/A' : 'Validación guardada'); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4">
    <h2 className="font-semibold">Pendientes de validación · {pendientes.length} instrumentos</h2>
    <div className="flex flex-wrap gap-4 text-sm"><span>Especificación: {activos.filter(pendienteSpec).length}</span><span>Área: {activos.filter(pendienteArea).length}</span></div>
    <div className="grid gap-2 sm:grid-cols-4"><Input aria-label="Buscar pendientes" placeholder="Código o parámetro" value={buscar} onChange={e => setBuscar(e.target.value)}/><Select value={filtro} onValueChange={setFiltro}><SelectTrigger aria-label="Pendiente"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todos">Todos los pendientes</SelectItem><SelectItem value="spec">Especificación</SelectItem><SelectItem value="area">Área</SelectItem></SelectContent></Select><Select value={tipo} onValueChange={setTipo}><SelectTrigger aria-label="Tipo de instrumento"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todos">Todos los tipos</SelectItem>{['termohigrometro','manometro_diferencial','manometro_filtro','otro'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={area} onValueChange={setArea}><SelectTrigger aria-label="Área de pendientes"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todos">Todas las áreas</SelectItem>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.codigo} · {a.nombre}</SelectItem>)}</SelectContent></Select></div>
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Instrumento</TableHead><TableHead>Área</TableHead><TableHead>Especificación / límites</TableHead><TableHead>Pendiente</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filas.map(i => <TableRow key={i.id}><TableCell>{i.codigo}<span className="block text-xs">{i.parametro}</span></TableCell><TableCell>{areas.find(a => a.id === i.area_id)?.codigo ?? i.area_libre ?? '—'}</TableCell><TableCell>{i.spec_texto ?? i.especificacion ?? '—'}<span className="block text-xs">{i.spec_lie ?? '—'} / {i.spec_lse ?? '—'}{i.tipo === 'termohigrometro' ? ` · HR ${i.spec_lie_hr ?? '—'} / ${i.spec_lse_hr ?? '—'}` : ''}</span></TableCell><TableCell>{[pendienteSpec(i) ? 'Especificación' : '', pendienteArea(i) ? 'Área' : ''].filter(Boolean).join(' · ')}</TableCell><TableCell><div className="flex flex-wrap gap-2">{puedeEditar && <><Button size="icon" variant="ghost" title="Editar instrumento" aria-label={`Editar ${i.codigo}`} onClick={() => onEditar(i)}><Pencil className="h-4 w-4"/></Button>{pendienteSpec(i) && <><Button size="sm" variant="outline" onClick={() => elegir(i, 'spec_estado', 'validada')}><Check className="mr-1 h-4 w-4"/>Validar especificación</Button><Button size="sm" variant="outline" onClick={() => elegir(i, 'spec_estado', 'na')}>N/A</Button></>}{pendienteArea(i) && <Button size="sm" variant="outline" onClick={() => elegir(i, 'area_estado', 'validada')}><Check className="mr-1 h-4 w-4"/>Validar área</Button>}</>}</div></TableCell></TableRow>)}{!filas.length && <TableRow><TableCell colSpan={5}>Sin pendientes en esta selección</TableCell></TableRow>}</TableBody></Table></div>
    <Dialog open={!!accion} onOpenChange={v => { if (!v && !busy) setAccion(undefined); }}><DialogContent><DialogHeader><DialogTitle>{accion?.estado === 'na' ? 'Marcar especificación N/A' : 'Confirmar validación'} · {accion?.i.codigo}</DialogTitle></DialogHeader>{accion?.campo === 'spec_estado' && <><Label htmlFor="referencia-validacion">Referencia normativa / justificación N/A</Label><Input id="referencia-validacion" value={referencia} onChange={e => setReferencia(e.target.value)}/></>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setAccion(undefined)}>Cancelar</Button><Button disabled={busy} onClick={() => void confirmar()}>Confirmar</Button></div></DialogContent></Dialog>
  </section>;
}