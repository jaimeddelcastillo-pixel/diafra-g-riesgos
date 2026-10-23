import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Download, Paperclip, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listarCatalogo } from './lib/persistencia';
import { vacio, type Fila } from './lib/catalogo';
import { anularResultado, calcular, capturarResultado, exportarResultados, listarResultados, periodos, revisarResultado, subirEvidencia, urlEvidencia, type Periodo, type Resultado } from './lib/resultados';

interface KpiCaptura { tabla: 'kpi_definiciones' | 'kpi_puesto'; id: string; codigo: string; nombre: string; grupo: string; frecuencia: string; tendencia: string; meta: number; unidad: string; nivel: string; estado: string; capturistas: string[] }
interface Edicion { num: string; den: string; comentario: string; evidencia?: File; fechaEvento: string; descripcion: string }
const edicionVacia: Edicion = { num: '', den: '', comentario: '', fechaEvento: '', descripcion: '' };
const fmt = (v: number | null | undefined, d = 2) => v === null || v === undefined ? '—' : Number(v.toFixed(d)).toLocaleString('es-MX');

export default function Captura() {
  const auth = useAuth(); const qc = useQueryClient();
  const qcCatalogo = useQuery({ queryKey: ['k1-catalogo', auth.orgId, auth.user?.id], queryFn: listarCatalogo, enabled: !!auth.orgId });
  const qcResultados = useQuery({ queryKey: ['k2-resultados', auth.orgId], queryFn: listarResultados, enabled: !!auth.orgId });
  const c = qcCatalogo.data ?? vacio(); const resultados = qcResultados.data ?? [];
  const kpis = useMemo<KpiCaptura[]>(() => [
    ...c.KPI_SGC.filter(f => f.activo !== false).map(f => ({ tabla: 'kpi_definiciones' as const, id: String(f.id), codigo: String(f.codigo), nombre: String(f.nombre), grupo: String(f.proceso), frecuencia: String(f.frecuencia), tendencia: String(f.tendencia), meta: Number(f.meta), unidad: String(f.unidad), nivel: String(f.nivel), estado: String(f.estado), capturistas: (f.capturistas as unknown as string[] | undefined) ?? [] })),
    ...c.KPI_Puesto.filter(f => f.activo !== false).map(f => ({ tabla: 'kpi_puesto' as const, id: String(f.id), codigo: String(f.codigo), nombre: String(f.nombre), grupo: String(f.puesto), frecuencia: String(f.frecuencia), tendencia: String(f.tendencia), meta: Number(f.meta), unidad: String(f.unidad), nivel: '', estado: String(f.estado), capturistas: (f.capturistas as unknown as string[] | undefined) ?? [] })),
  ], [c]);
  const ops = useMemo<Periodo[]>(() => periodos([...new Set(kpis.map(k => k.frecuencia).filter(f => f !== 'por evento'))]), [kpis]);
  const [periodoClave, setPeriodoClave] = useState(''); const [mios, setMios] = useState(false); const [grupo, setGrupo] = useState('todos');
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({}); const [busy, setBusy] = useState(false);
  const [accion, setAccion] = useState<{ tipo: 'corregir' | 'anular' | 'revisar'; resultado: Resultado; kpi: KpiCaptura } | null>(null); const [motivo, setMotivo] = useState('');
  const periodo: Periodo | 'evento' | null = periodoClave === 'evento' ? 'evento' : ops.find(p => `${p.frecuencia}|${p.inicio}` === periodoClave) ?? null;
  const esRevisor = auth.hasRole('responsable_sanitario') || auth.hasRole('aseguramiento_calidad');
  const puedeCapturar = (k: KpiCaptura) => esRevisor || auth.hasRole('admin') || (auth.user?.id ? k.capturistas.includes(auth.user.id) : false);
  const resultadoDe = (k: KpiCaptura) => resultados.find(r => (r.kpi_definicion_id === k.id || r.kpi_puesto_id === k.id) && (periodo === 'evento' ? r.fecha_evento === ediciones[k.id]?.fechaEvento : r.periodo_inicio === (periodo as Periodo | null)?.inicio));
  const filtrados = kpis.filter(k => (periodo === 'evento' ? k.frecuencia === 'por evento' : periodo ? k.frecuencia === periodo.frecuencia : false))
    .filter(k => !mios || (auth.user?.id ? k.capturistas.includes(auth.user.id) : false))
    .filter(k => grupo === 'todos' || k.grupo === grupo);
  const grupos = [...new Set(kpis.filter(k => periodo === 'evento' ? k.frecuencia === 'por evento' : periodo ? k.frecuencia === periodo.frecuencia : false).map(k => k.grupo).filter(Boolean))];
  const setEd = (id: string, parcial: Partial<Edicion>) => setEdiciones(e => ({ ...e, [id]: { ...(e[id] ?? edicionVacia), ...parcial } }));
  const refrescar = async () => { await qc.invalidateQueries({ queryKey: ['k2-resultados'] }); await qc.invalidateQueries({ queryKey: ['pendientes'] }); };
  const guardar = async (k: KpiCaptura, existente?: Resultado, motivoCorreccion?: string) => {
    const ed = ediciones[k.id] ?? edicionVacia;
    if (ed.num.trim() === '' || !Number.isFinite(Number(ed.num))) { toast.error('Numerador no numérico'); return; }
    const den = ed.den.trim() === '' ? null : Number(ed.den);
    if (den !== null && !Number.isFinite(den)) { toast.error('Denominador no numérico'); return; }
    setBusy(true);
    try {
      let evidenciaPath = existente?.evidencia_path ?? '';
      if (ed.evidencia) evidenciaPath = await subirEvidencia(String(auth.orgId), k.id, ed.evidencia);
      await capturarResultado({ tabla: k.tabla, kpiId: k.id, periodoInicio: periodo === 'evento' ? undefined : (periodo as Periodo | null)?.inicio, periodoFin: periodo === 'evento' ? undefined : (periodo as Periodo | null)?.fin, fechaEvento: periodo === 'evento' ? ed.fechaEvento : undefined, descripcionEvento: ed.descripcion, numerador: Number(ed.num), denominador: den, evidenciaPath, comentario: ed.comentario, motivo: motivoCorreccion ?? '', resultadoId: existente?.id });
      setEdiciones(e => { const n = { ...e }; delete n[k.id]; return n; });
      await refrescar(); toast.success(existente ? 'Resultado corregido y auditado' : 'Resultado capturado');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const exportar = () => {
    const filas = filtrados.map(k => { const r = resultadoDe(k); return { Codigo: k.codigo, Nombre: k.nombre, Periodo: periodo === 'evento' ? (r?.fecha_evento ?? '') : periodo ? `${periodo.inicio} al ${periodo.fin}` : '', Numerador: r?.numerador ?? '', Denominador: r?.denominador ?? '', Valor: r?.valor ?? '', 'Cumplimiento %': r?.cumplimiento != null ? Math.round(r.cumplimiento * 100) : '', Semaforo: r?.semaforo ?? '', Estado: r?.estado ?? 'sin captura', Evidencia: r?.evidencia_path ? 'Sí' : 'No', Comentario: r?.comentario ?? '' }; });
    if (!filas.length) { toast.error('Sin KPI en el periodo'); return; }
    const url = URL.createObjectURL(new Blob([new Uint8Array(exportarResultados(filas))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = 'Indicadores-resultados-K2.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Select value={periodoClave} onValueChange={setPeriodoClave}><SelectTrigger className="w-72" aria-label="Periodo"><SelectValue placeholder="Seleccionar periodo" /></SelectTrigger><SelectContent>{ops.map(p => <SelectItem key={`${p.frecuencia}|${p.inicio}`} value={`${p.frecuencia}|${p.inicio}`}>{p.etiqueta}</SelectItem>)}{kpis.some(k => k.frecuencia === 'por evento') && <SelectItem value="evento">por evento</SelectItem>}</SelectContent></Select>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={mios} onCheckedChange={v => setMios(v === true)} aria-label="Los que me tocan" />Los que me tocan</label>
      <Select value={grupo} onValueChange={setGrupo}><SelectTrigger className="w-56" aria-label="Puesto o proceso"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los puestos y procesos</SelectItem>{grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" onClick={exportar} disabled={!periodo || busy}><Download className="mr-2 h-4 w-4" />Exportar Excel</Button>
    </div>
    {!periodo ? <p className="py-6 text-muted-foreground">Selecciona un periodo para capturar.</p> : qcCatalogo.isLoading || qcResultados.isLoading ? <p>Cargando…</p> : !filtrados.length ? <p className="py-6 text-muted-foreground">Sin KPI para este periodo.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>KPI</TableHead><TableHead>Numerador</TableHead><TableHead>Denominador</TableHead><TableHead>Valor / cumplimiento</TableHead><TableHead>Semáforo</TableHead><TableHead>Evidencia y comentario</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{filtrados.map(k => {
      const r = resultadoDe(k); const ed = ediciones[k.id] ?? edicionVacia; const editando = k.id in ediciones;
      const calc = editando && ed.num.trim() !== '' && Number.isFinite(Number(ed.num)) ? calcular(r ? r.unidad_copia : k.unidad, r ? r.tendencia_copia : k.tendencia, r ? r.meta_copia : k.meta, Number(ed.num), ed.den.trim() === '' ? null : Number(ed.den)) : null;
      const bloqueado = k.estado !== 'validado'; const sinPermiso = !puedeCapturar(k);
      return <TableRow key={k.id}>
        <TableCell className="min-w-48"><span className="font-medium">{k.codigo}</span> · {k.nombre}<div className="text-xs text-muted-foreground">{k.grupo} · meta {fmt(r?.meta_copia ?? k.meta)} {r?.unidad_copia ?? k.unidad} · {k.tendencia}{k.nivel === 'SGC' ? ' · evidencia obligatoria' : ''}</div>{periodo === 'evento' && <div className="mt-2 space-y-2"><Input type="date" aria-label={`Fecha del evento de ${k.codigo}`} value={ed.fechaEvento} disabled={!!r || bloqueado || sinPermiso} onChange={e => setEd(k.id, { fechaEvento: e.target.value })} /><Input placeholder="Descripción del evento" aria-label={`Descripción del evento de ${k.codigo}`} value={ed.descripcion} disabled={!!r || bloqueado || sinPermiso} onChange={e => setEd(k.id, { descripcion: e.target.value })} /></div>}</TableCell>
        <TableCell><Input className="w-24" type="number" step="any" aria-label={`Numerador de ${k.codigo}`} value={editando ? ed.num : String(r?.numerador ?? '')} disabled={bloqueado || sinPermiso} onChange={e => setEd(k.id, { num: e.target.value })} /></TableCell>
        <TableCell>{(r?.unidad_copia ?? k.unidad) === 'número' ? '—' : <Input className="w-24" type="number" step="any" aria-label={`Denominador de ${k.codigo}`} value={editando ? ed.den : String(r?.denominador ?? '')} disabled={bloqueado || sinPermiso} onChange={e => setEd(k.id, { den: e.target.value })} />}</TableCell>
        <TableCell className="whitespace-nowrap">{calc ? <>{fmt(calc.valor)} {r?.unidad_copia ?? k.unidad}<div className="text-xs text-muted-foreground">{calc.cumplimiento != null ? `${Math.round(calc.cumplimiento * 100)}%` : 'sin cumplimiento'}</div></> : r ? <>{fmt(r.valor)} {r.unidad_copia}<div className="text-xs text-muted-foreground">{r.cumplimiento != null ? `${Math.round(r.cumplimiento * 100)}%` : 'sin cumplimiento'}</div></> : '—'}</TableCell>
        <TableCell><Badge variant={(calc?.semaforo ?? r?.semaforo) === 'verde' ? 'default' : 'outline'}>{calc?.semaforo ?? r?.semaforo ?? '—'}</Badge></TableCell>
        <TableCell className="min-w-56 space-y-2">{r?.evidencia_path && !editando ? <Button size="sm" variant="link" className="h-auto p-0" onClick={() => void urlEvidencia(r.evidencia_path!).then(u => window.open(u, '_blank')).catch(e => toast.error((e as Error).message))}><Paperclip className="mr-1 h-3 w-3" />Ver evidencia</Button> : <Input type="file" aria-label={`Evidencia de ${k.codigo}`} disabled={bloqueado || sinPermiso} onChange={e => setEd(k.id, { evidencia: e.target.files?.[0] })} />}<Textarea placeholder="Comentario" aria-label={`Comentario de ${k.codigo}`} value={editando ? ed.comentario : (r?.comentario ?? '')} disabled={bloqueado || sinPermiso} onChange={e => setEd(k.id, { comentario: e.target.value })} /></TableCell>
        <TableCell>{r ? <Badge variant={r.estado === 'revisado' ? 'default' : 'outline'}>{r.estado}</Badge> : bloqueado ? <Badge variant="outline">borrador</Badge> : <span className="text-muted-foreground">sin captura</span>}</TableCell>
        <TableCell><div className="flex gap-1">
          {bloqueado ? <span className="max-w-40 text-xs text-muted-foreground">Solo se capturan KPI validados y activos</span> : sinPermiso ? <span className="max-w-40 text-xs text-muted-foreground">Sin asignación de captura</span> : !r || editando ? <Button size="sm" disabled={busy} onClick={() => r ? (setAccion({ tipo: 'corregir', resultado: r, kpi: k }), setMotivo('')) : void guardar(k)}><Save className="mr-1 h-4 w-4" />{r ? 'Corregir' : 'Guardar'}</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => setEd(k.id, { num: String(r.numerador), den: r.denominador != null ? String(r.denominador) : '', comentario: r.comentario, fechaEvento: r.fecha_evento ?? '', descripcion: r.descripcion_evento })}>Editar</Button>}
          {r && !editando && esRevisor && r.estado === 'capturado' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void (async () => { setBusy(true); try { await revisarResultado(r.id, ''); await refrescar(); toast.success('Resultado revisado'); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } })()}><Check className="mr-1 h-4 w-4" />Revisar</Button>}
          {r && !editando && (esRevisor || auth.hasRole('admin')) && <Button size="sm" variant="ghost" aria-label={`Anular resultado de ${k.codigo}`} disabled={busy} onClick={() => { setAccion({ tipo: 'anular', resultado: r, kpi: k }); setMotivo(''); }}><Ban className="h-4 w-4" /></Button>}
        </div></TableCell>
      </TableRow>;
    })}</TableBody></Table></div>}
    <Dialog open={!!accion} onOpenChange={v => { if (!v && !busy) setAccion(null); }}><DialogContent><DialogHeader><DialogTitle>{accion?.tipo === 'anular' ? 'Anular' : 'Corregir'} resultado de {accion?.kpi.codigo}</DialogTitle></DialogHeader><Label htmlFor="k2-motivo">Motivo obligatorio (mínimo 5 caracteres)</Label><Textarea id="k2-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} /><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setAccion(null)}>Cancelar</Button><Button disabled={busy || motivo.trim().length < 5} onClick={() => { if (!accion) return; void (async () => { setBusy(true); try { if (accion.tipo === 'anular') { await anularResultado(accion.resultado.id, motivo); toast.success('Resultado anulado y auditado'); } else { await guardar(accion.kpi, accion.resultado, motivo); } setAccion(null); await refrescar(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } })(); }}>{accion?.tipo === 'anular' ? 'Anular' : 'Guardar corrección'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
