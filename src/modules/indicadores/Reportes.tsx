import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Ban, Check, Download, FilePlus2, GitBranch, Send, Settings, Undo2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prepararDocumento } from '@/lib/documentos';
import { graficaPNG, ESCALA_PNG, PX_16x9 } from '@/lib/documentos/graficas';
import { claseSemaforo } from './lib/semaforo';
import { etiquetaPeriodo, etiquetaSub, fueraDeMeta, num, obtenerResumen, pct, periodosCerrados, type KpiResumen, type Resumen, type TipoPeriodo } from './lib/tablero';
import {
  anularReporte, cancelarReserva, reservaVencida, configActual, construirWordReporte, descargarOriginal, crearReporte, emitirReporte, enviarReporte, faltanAnalisis, guardarConfig, guardarReporte,
  kpisDelAlcance, listarReportes, nuevaVersion, puedeAutorizar, quienTienePendiente, revisarReporte, wordABlob, type Analisis, type Firmantes, type Reporte,
} from './lib/reportes';

const COLOR: Record<string, string> = { verde: 'hsl(var(--success))', amarillo: 'hsl(var(--warning))', rojo: 'hsl(var(--destructive))' };
const ETAPA: Record<string, string> = { edicion: 'En edición', revision: 'En revisión', autorizacion: 'Por autorizar', cerrado: '' };
const descargar = (blob: Blob, nombre: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

/** Off-screen fixed-size charts (one per SGC-level KPI) converted to 300 dpi PNG for the Word. */
function GraficasOcultas({ kpis, refDiv }: { kpis: KpiResumen[]; refDiv: React.RefObject<HTMLDivElement> }) {
  const w = Math.round(PX_16x9.w / ESCALA_PNG); const hgt = Math.round((PX_16x9.h - 120) / ESCALA_PNG);
  return <div ref={refDiv} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0">{kpis.map(k => { const d = k.subperiodos.map(s => ({ sub: etiquetaSub(k.frecuencia, s.inicio), valor: s.valor, semaforo: s.semaforo })); return <div key={k.id} data-kpi={k.id}>
    <BarChart width={w} height={hgt} data={d} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#d1d5db"/><XAxis dataKey="sub" fontSize={12}/><YAxis fontSize={12}/>
      <ReferenceLine y={k.meta} stroke="#1f3a5f" strokeDasharray="6 4"/><Bar dataKey="valor" isAnimationActive={false}>{d.map((x, i) => <Cell key={i} fill={x.semaforo === 'verde' ? '#16a34a' : x.semaforo === 'amarillo' ? '#d97706' : x.semaforo === 'rojo' ? '#dc2626' : '#9ca3af'}/>)}</Bar></BarChart></div>; })}</div>;
}

export default function Reportes() {
  const auth = useAuth(); const qc = useQueryClient(); const perfiles = useProfiles(); const graficasRef = useRef<HTMLDivElement>(null);
  const elabora = !auth.isSuperAdmin() && !auth.isImpersonating && ['admin', 'responsable_sanitario', 'aseguramiento_calidad'].some(r => auth.roles.includes(r as typeof auth.roles[number]));
  const lista = useQuery({ queryKey: ['k3b-reportes', auth.orgId], queryFn: listarReportes, enabled: !!auth.orgId });
  const cfg = useQuery({ queryKey: ['k3b-config', auth.orgId], queryFn: configActual, enabled: !!auth.orgId });
  const autoriza = useQuery({ queryKey: ['k3b-autoriza', auth.orgId, auth.user?.id], queryFn: () => puedeAutorizar(auth.orgId!, auth.user!.id), enabled: !!auth.orgId && !!auth.user });
  const [selId, setSelId] = useState<string | null>(null); const [borrador, setBorrador] = useState<Reporte | null>(null);
  const [nuevo, setNuevo] = useState<{ tipo: TipoPeriodo; inicio: string } | null>(null);
  const [motivoDlg, setMotivoDlg] = useState<{ accion: 'anular' | 'nueva' | 'devolver' | 'config' | 'reserva'; motivo: string } | null>(null);
  const [cfgEd, setCfgEd] = useState<{ objetivo: string; alcance: string; metodologia: string; autorizadores: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const sel = lista.data?.find(r => r.id === selId) ?? null; const r = borrador && borrador.id === selId ? borrador : sel;
  const vivo = useQuery({ queryKey: ['k3b-vivo', auth.orgId, sel?.tipo_periodo, sel?.periodo_inicio], queryFn: () => obtenerResumen(sel!.tipo_periodo, sel!.periodo_inicio), enabled: !!sel && sel.estado === 'borrador', refetchInterval: 60000 });
  const resumen: Resumen | undefined = sel?.estado === 'borrador' ? vivo.data : sel?.datos_snapshot ?? undefined;
  const nombre = (id: string | null | undefined) => perfiles.data?.find(p => p.id === id)?.nombre ?? '—';
  const uid = auth.user?.id;
  const ejecutar = async (f: () => Promise<unknown>, ok: string) => { setBusy(true); try { await f(); toast.success(ok); await qc.invalidateQueries({ queryKey: ['k3b-reportes'] }); await qc.invalidateQueries({ queryKey: ['pendientes'] }); setBorrador(null); } catch (e) { toast.error((e as { message?: string })?.message ?? String(e)); } finally { setBusy(false); } };
  const editar = (cambios: Partial<Reporte>) => r && setBorrador({ ...r, ...cambios });
  const editable = !!r && r.estado === 'borrador' && r.etapa === 'edicion' && r.elaboro_por === uid;
  const kpis = r && resumen ? kpisDelAlcance(r, resumen) : [];
  const fuera = r && resumen ? fueraDeMeta({ ...resumen, kpis }) : [];
  const faltan = r && resumen ? faltanAnalisis(r, resumen) : [];
  const guardar = () => r && ejecutar(() => guardarReporte(r.id, { objetivo: r.objetivo, alcance: r.alcance, metodologia: r.metodologia, analisis: r.analisis, conclusiones: r.conclusiones, revisores: r.revisores }), 'Borrador guardado');
  const setAnalisis = (id: string, campo: keyof Analisis, v: string) => r && editar({ analisis: { ...r.analisis, [id]: { causa: '', accion: '', capa: '', ...r.analisis[id], [campo]: v } } });
  const firmantesVivos = (x: Reporte): Firmantes => ({
    elaboro: x.elaboro_por ? { user_id: x.elaboro_por, nombre: nombre(x.elaboro_por), cargo: perfiles.data?.find(p => p.id === x.elaboro_por)?.cargo ?? '', fecha: '' } : null,
    revisaron: x.revisores.map(id => ({ user_id: id, nombre: nombre(id), cargo: perfiles.data?.find(p => p.id === id)?.cargo ?? '', fecha: x.revisiones.find(v => v.user_id === id)?.fecha ?? '' })),
    autorizo: null,
  });
  const word = async () => { if (!r) return; setBusy(true); try {
    const nombreArchivo = `${r.codigo}-v${r.version}${r.estado === 'emitido' ? '' : '-BORRADOR'}.docx`;
    const emitido = r.estado === 'emitido';
    if (emitido) { descargar(await descargarOriginal(r), nombreArchivo); return; }
    if (!resumen) return;
    const ctx = await prepararDocumento('indicadores.reporte_word', nombreArchivo, { empresa: auth.org?.nombre ?? '', logoPath: auth.org?.logo_url, generadoPor: auth.profile?.nombre || auth.user?.email || '' });
    const graficas: Record<string, Uint8Array> = {};
    for (const k of kpis.filter(k => k.tipo === 'SGC' && k.nivel === 'SGC' && k.subperiodos.length)) {
      const svg = graficasRef.current?.querySelector(`[data-kpi="${k.id}"] svg`) as SVGSVGElement | null;
      if (svg) graficas[k.id] = await bytes(await graficaPNG(svg, [`${k.codigo} · ${k.nombre}`], [{ nombre: `Meta ${k.meta} ${k.unidad}`, color: '#1f3a5f', linea: 'dash' }], PX_16x9));
    }
    const doc = construirWordReporte({ ctx, reporte: r, resumen, firmantes: emitido && r.firmantes ? r.firmantes : firmantesVivos(r), graficas, borrador: !emitido });
    descargar(await wordABlob(doc), nombreArchivo);
  } catch (e) { toast.error((e as Error).message ?? String(e)); } finally { setBusy(false); } };
  const opciones = useMemo(() => nuevo ? periodosCerrados(nuevo.tipo) : [], [nuevo]);
  const elegibles = (perfiles.data ?? []).filter(p => p.id !== r?.elaboro_por);

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2">
      {elabora && <Button onClick={() => setNuevo({ tipo: 'trimestre', inicio: periodosCerrados('trimestre')[0].inicio })}><FilePlus2 className="mr-2 h-4 w-4"/>Nuevo reporte</Button>}
      {elabora && <Button variant="outline" onClick={() => setCfgEd({ objetivo: cfg.data?.objetivo ?? '', alcance: cfg.data?.alcance ?? '', metodologia: cfg.data?.metodologia ?? '', autorizadores: cfg.data?.autorizadores ?? [] })}><Settings className="mr-2 h-4 w-4"/>Textos base y autorizadores</Button>}
    </div>
    {lista.error && <p role="alert" className="text-destructive">{lista.error.message}</p>}
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Periodo</TableHead><TableHead>Estado</TableHead><TableHead>Versión</TableHead><TableHead>Pendiente de</TableHead></TableRow></TableHeader><TableBody>
      {(lista.data ?? []).map(x => <TableRow key={x.id} className={`cursor-pointer ${x.id === selId ? 'bg-muted' : ''}`} onClick={() => { setSelId(x.id); setBorrador(null); }}>
        <TableCell className="font-medium">{x.codigo}</TableCell><TableCell>{etiquetaPeriodo(x.tipo_periodo, x.periodo_inicio)}</TableCell>
        <TableCell><Badge variant={x.estado === 'emitido' ? 'default' : x.estado === 'anulado' ? 'destructive' : 'outline'}>{x.estado}</Badge>{x.estado === 'borrador' && <span className="ml-2 text-xs text-muted-foreground">{ETAPA[x.etapa]}</span>}</TableCell>
        <TableCell>{x.version}</TableCell><TableCell>{quienTienePendiente(x)}</TableCell></TableRow>)}
      {!lista.data?.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sin reportes</TableCell></TableRow>}
    </TableBody></Table></div>

    {r && <section className="space-y-5 rounded-md border p-4">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{r.codigo} · v{r.version} · {etiquetaPeriodo(r.tipo_periodo, r.periodo_inicio)}</h2>
        <p className="text-sm text-muted-foreground">{r.estado === 'borrador' ? 'Borrador: datos vivos (se actualizan cada minuto)' : r.estado === 'emitido' ? `Emitido el ${new Date(r.emitido_en ?? '').toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} · solo su snapshot` : `Anulado: ${r.motivo_anulacion ?? ''}`}</p></div>
        <div className="flex flex-wrap gap-2">
          {editable && <Button variant="outline" disabled={busy} onClick={guardar}><Save className="mr-2 h-4 w-4"/>Guardar</Button>}
          {editable && <Button disabled={busy || !r.conclusiones.trim() || faltan.length > 0 || !r.revisores.length} onClick={() => ejecutar(async () => { await guardarReporte(r.id, { objetivo: r.objetivo, alcance: r.alcance, metodologia: r.metodologia, analisis: r.analisis, conclusiones: r.conclusiones, revisores: r.revisores }); await enviarReporte(r.id); }, 'Enviado a revisión')}><Send className="mr-2 h-4 w-4"/>Enviar a revisión</Button>}
          {r.estado === 'borrador' && r.etapa === 'revision' && uid && r.revisores.includes(uid) && !r.revisiones.some(v => v.user_id === uid) && <><Button disabled={busy} onClick={() => ejecutar(() => revisarReporte(r.id, true, ''), 'Revisión registrada')}><Check className="mr-2 h-4 w-4"/>Aprobar revisión</Button><Button variant="outline" disabled={busy} onClick={() => setMotivoDlg({ accion: 'devolver', motivo: '' })}><Undo2 className="mr-2 h-4 w-4"/>Devolver</Button></>}
          {r.estado === 'borrador' && r.etapa === 'autorizacion' && autoriza.data != null && uid !== r.elaboro_por && !r.revisores.includes(uid ?? '') && <Button disabled={busy} onClick={() => ejecutar(() => emitirReporte(r.id), 'Reporte autorizado y emitido')}><Check className="mr-2 h-4 w-4"/>Autorizar y emitir</Button>}
          {r.estado === 'borrador' && reservaVencida(r) && (autoriza.data != null || auth.roles.includes('admin' as typeof auth.roles[number])) && <Button variant="outline" disabled={busy} onClick={() => setMotivoDlg({ accion: 'reserva', motivo: '' })}><Undo2 className="mr-2 h-4 w-4"/>Cancelar reserva vencida</Button>}
          {r.estado !== 'anulado' && <Button variant="outline" disabled={busy || !resumen} onClick={word}><Download className="mr-2 h-4 w-4"/>Word</Button>}
          {r.estado === 'emitido' && elabora && <Button variant="outline" disabled={busy} onClick={() => setMotivoDlg({ accion: 'nueva', motivo: '' })}><GitBranch className="mr-2 h-4 w-4"/>Nueva versión</Button>}
          {r.estado !== 'anulado' && (r.estado === 'emitido' ? autoriza.data != null && uid !== r.elaboro_por : uid === r.elaboro_por || auth.roles.includes('admin' as typeof auth.roles[number])) && <Button variant="outline" disabled={busy} onClick={() => setMotivoDlg({ accion: 'anular', motivo: '' })}><Ban className="mr-2 h-4 w-4"/>Anular</Button>}
        </div></header>
      {(['objetivo', 'alcance', 'metodologia'] as const).map(k => <div key={k} className="space-y-1"><Label htmlFor={`k3b-${k}`}>{k === 'metodologia' ? 'Metodología' : k[0].toUpperCase() + k.slice(1)}</Label><Textarea id={`k3b-${k}`} value={r[k]} disabled={!editable} onChange={e => editar({ [k]: e.target.value })}/></div>)}
      {!resumen ? <p>Cargando resultados…</p> : <>
        <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-medium">Índice SGC: {pct(resumen.indice_sgc.indice)}</span><Badge variant="outline" className={claseSemaforo(resumen.indice_sgc.semaforo)}>{resumen.indice_sgc.semaforo}</Badge><span className="text-muted-foreground">Anterior: {pct(resumen.indice_sgc.indice_anterior)}</span></div>
        <div className="space-y-3"><h3 className="font-semibold">KPI fuera de meta</h3>
          {fuera.map(k => { const obligatorio = k.tipo === 'SGC' && k.nivel === 'SGC' && k.semaforo === 'rojo'; const a = r.analisis[k.id]; return <div key={k.id} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{k.codigo} · {k.nombre}</span><Badge variant="outline" className={claseSemaforo(k.semaforo)}>{k.semaforo}</Badge><span className="text-xs text-muted-foreground">{num(k.valor)} {k.unidad} (meta {k.meta})</span>{obligatorio && <span className="text-xs text-destructive">Análisis obligatorio</span>}</div>
            <div className="grid gap-2 sm:grid-cols-3">{(['causa', 'accion', 'capa'] as const).map(c => <div key={c} className="space-y-1"><Label htmlFor={`k3b-${k.id}-${c}`} className="text-xs">{c === 'causa' ? 'Causa' : c === 'accion' ? 'Acción' : 'Referencia CAPA'}</Label><Input id={`k3b-${k.id}-${c}`} value={a?.[c] ?? ''} disabled={!editable} onChange={e => setAnalisis(k.id, c, e.target.value)}/></div>)}</div></div>; })}
          {!fuera.length && <p className="text-sm text-muted-foreground">Sin KPI fuera de meta.</p>}
          {faltan.length > 0 && <p role="alert" className="text-sm text-destructive">Falta el análisis de: {faltan.map(k => k.codigo).join(', ')}</p>}
        </div>
        <GraficasOcultas refDiv={graficasRef} kpis={kpis.filter(k => k.tipo === 'SGC' && k.nivel === 'SGC')}/>
      </>}
      <div className="space-y-1"><Label htmlFor="k3b-conclusiones">Conclusiones (obligatorias)</Label><Textarea id="k3b-conclusiones" value={r.conclusiones} disabled={!editable} onChange={e => editar({ conclusiones: e.target.value })}/></div>
      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <div><p className="font-semibold">Elaboró</p><p>{r.firmantes?.elaboro?.nombre ?? nombre(r.elaboro_por)}</p></div>
        <div><p className="font-semibold">Revisó</p>{editable ? <div className="space-y-1">{elegibles.map(p => <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={r.revisores.includes(p.id)} onChange={e => editar({ revisores: e.target.checked ? [...r.revisores, p.id] : r.revisores.filter(x => x !== p.id) })}/>{p.nombre ?? p.id}{p.cargo ? ` · ${p.cargo}` : ''}</label>)}</div>
          : (r.firmantes?.revisaron ?? r.revisores.map(id => ({ user_id: id, nombre: nombre(id) }))).map(x => <p key={x.user_id}>{x.nombre}{r.revisiones.some(v => v.user_id === x.user_id) ? ' ✓' : ''}</p>)}</div>
        <div><p className="font-semibold">Autorizó</p><p>{r.firmantes?.autorizo ? `${r.firmantes.autorizo.nombre}${r.firmantes.autorizo.leyenda ?? ''}` : 'Aseguramiento de Calidad'}</p></div>
      </div>
    </section>}

    <Dialog open={!!nuevo} onOpenChange={v => { if (!v) setNuevo(null); }}><DialogContent><DialogHeader><DialogTitle>Nuevo reporte</DialogTitle></DialogHeader>{nuevo && <div className="flex gap-3">
      <Select value={nuevo.tipo} onValueChange={v => { const t = v as TipoPeriodo; setNuevo({ tipo: t, inicio: periodosCerrados(t)[0].inicio }); }}><SelectTrigger aria-label="Tipo de periodo"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="trimestre">Trimestre</SelectItem><SelectItem value="semestre">Semestre</SelectItem><SelectItem value="año">Año</SelectItem></SelectContent></Select>
      <Select value={nuevo.inicio} onValueChange={v => setNuevo({ ...nuevo, inicio: v })}><SelectTrigger aria-label="Periodo"><SelectValue/></SelectTrigger><SelectContent>{opciones.map(o => <SelectItem key={o.inicio} value={o.inicio}>{o.etiqueta}</SelectItem>)}</SelectContent></Select></div>}
      <DialogFooter><Button variant="outline" onClick={() => setNuevo(null)}>Cancelar</Button><Button disabled={busy || !nuevo} onClick={() => nuevo && ejecutar(async () => { const id = await crearReporte(nuevo.tipo, nuevo.inicio); setSelId(id); setNuevo(null); }, 'Borrador creado')}>Crear</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!cfgEd} onOpenChange={v => { if (!v) setCfgEd(null); }}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Textos base y autorizadores (versión {(cfg.data?.version ?? 0) + 1})</DialogTitle></DialogHeader>{cfgEd && <div className="space-y-3">
      {(['objetivo', 'alcance', 'metodologia'] as const).map(k => <div key={k} className="space-y-1"><Label htmlFor={`k3b-cfg-${k}`}>{k === 'metodologia' ? 'Metodología' : k[0].toUpperCase() + k.slice(1)}</Label><Textarea id={`k3b-cfg-${k}`} value={cfgEd[k]} onChange={e => setCfgEd({ ...cfgEd, [k]: e.target.value })}/></div>)}
      <div className="space-y-1"><Label>Autorizan en ausencia de Aseguramiento de Calidad (solo admin)</Label>{(perfiles.data ?? []).map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!auth.roles.includes('admin' as typeof auth.roles[number])} checked={cfgEd.autorizadores.includes(p.id)} onChange={e => setCfgEd({ ...cfgEd, autorizadores: e.target.checked ? [...cfgEd.autorizadores, p.id] : cfgEd.autorizadores.filter(x => x !== p.id) })}/>{p.nombre ?? p.id}</label>)}</div>
    </div>}<DialogFooter><Button variant="outline" onClick={() => setCfgEd(null)}>Cancelar</Button><Button onClick={() => setMotivoDlg({ accion: 'config', motivo: '' })}>Guardar…</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!motivoDlg} onOpenChange={v => { if (!v && !busy) setMotivoDlg(null); }}><DialogContent><DialogHeader><DialogTitle>{motivoDlg?.accion === 'anular' ? 'Anular reporte' : motivoDlg?.accion === 'nueva' ? 'Nueva versión' : motivoDlg?.accion === 'devolver' ? 'Devolver a edición' : motivoDlg?.accion === 'reserva' ? 'Cancelar reserva de emisión vencida' : 'Guardar configuración'}</DialogTitle></DialogHeader>
      <Label htmlFor="k3b-motivo">Motivo obligatorio (mínimo 5 caracteres)</Label><Textarea id="k3b-motivo" value={motivoDlg?.motivo ?? ''} onChange={e => motivoDlg && setMotivoDlg({ ...motivoDlg, motivo: e.target.value })}/>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setMotivoDlg(null)}>Cancelar</Button><Button disabled={busy || (motivoDlg?.motivo.trim().length ?? 0) < 5} onClick={() => { if (!motivoDlg) return; const m = motivoDlg.motivo;
        const f = motivoDlg.accion === 'anular' ? () => anularReporte(r!.id, m) : motivoDlg.accion === 'nueva' ? () => nuevaVersion(r!.id, m) : motivoDlg.accion === 'devolver' ? () => revisarReporte(r!.id, false, m) : motivoDlg.accion === 'reserva' ? () => cancelarReserva(r!.id, m) : async () => { await guardarConfig(cfgEd!, m); setCfgEd(null); await qc.invalidateQueries({ queryKey: ['k3b-config'] }); };
        void ejecutar(async () => { await f(); setMotivoDlg(null); }, 'Cambio guardado y auditado'); }}>Confirmar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
