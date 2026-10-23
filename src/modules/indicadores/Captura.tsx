import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Download, Link2, Paperclip, Plus, Save, Upload, Pencil } from 'lucide-react';
import { prepararDocumento } from '@/lib/documentos';
import { conservarYDescargar } from '@/lib/documentos/originales';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { listarCatalogo } from './lib/persistencia';
import { vacio } from './lib/catalogo';
import ImportarResultados from './ImportarResultados';
import { claseSemaforo } from './lib/semaforo';
import { referenciaPeriodo } from './lib/excel-resultados';
import { anularResultado, calcular, celdasAnio, etiquetaPeriodo, guardarResultado, hoyMx, ligarEvidencia, listarEvidencias, listarResultados, periodoCerrado, registrarEvidencia, revisarResultado, ultimoCerrado, urlEvidencia, exportarResultados, type Resultado } from './lib/resultados';

interface Kpi { tabla: 'kpi_definiciones' | 'kpi_puesto'; id: string; codigo: string; nombre: string; grupo: string; nivel: string; frecuencia: string; tendencia: string; meta: number; unidad: string; fuente: string; estado: string; capturistas: string[] }
interface Abierto { kpi: Kpi; inicio?: string; fin?: string; resultado?: Resultado }
const fmt = (v: number | null | undefined) => v === null || v === undefined ? '—' : Number(Number(v).toFixed(2)).toLocaleString('es-MX');
/** Solo se exige denominador cuando la unidad no es «número». */
export const faltaDenominador = (unidad: string, den: string) => unidad !== 'número' && den.trim() === '';

export default function Captura() {
  const auth = useAuth(); const qc = useQueryClient(); const hoy = hoyMx();
  const qCat = useQuery({ queryKey: ['k1-catalogo', auth.orgId, auth.user?.id], queryFn: listarCatalogo, enabled: !!auth.orgId });
  const qRes = useQuery({ queryKey: ['k2-resultados', auth.orgId], queryFn: listarResultados, enabled: !!auth.orgId });
  const qEv = useQuery({ queryKey: ['k2-evidencias', auth.orgId], queryFn: listarEvidencias, enabled: !!auth.orgId });
  const c = qCat.data ?? vacio(); const resultados = qRes.data ?? []; const evidencias = qEv.data?.evidencias ?? []; const ligas = qEv.data?.ligas ?? [];
  const kpis = useMemo<Kpi[]>(() => [
    ...c.KPI_SGC.filter(f => f.activo !== false).map(f => ({ tabla: 'kpi_definiciones' as const, id: String(f.id), codigo: String(f.codigo), nombre: String(f.nombre), grupo: String(f.proceso ?? ''), nivel: String(f.nivel ?? ''), frecuencia: String(f.frecuencia), tendencia: String(f.tendencia), meta: Number(f.meta), unidad: String(f.unidad), fuente: String(f.fuente ?? ''), estado: String(f.estado), capturistas: (f.capturistas as unknown as string[] | undefined) ?? [] })),
    ...c.KPI_Puesto.filter(f => f.activo !== false).map(f => ({ tabla: 'kpi_puesto' as const, id: String(f.id), codigo: String(f.codigo), nombre: String(f.nombre), grupo: String(f.puesto ?? ''), nivel: 'Puesto', frecuencia: String(f.frecuencia), tendencia: String(f.tendencia), meta: Number(f.meta), unidad: String(f.unidad), fuente: String(f.fuente ?? ''), estado: String(f.estado), capturistas: (f.capturistas as unknown as string[] | undefined) ?? [] })),
  ], [c]);
  const [mios, setMios] = useState(() => new URLSearchParams(window.location.search).get('mios') === '1');
  const [grupo, setGrupo] = useState('todos'); const [nivel, setNivel] = useState('todos');
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [abierto, setAbierto] = useState<Abierto | null>(null); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ num: '', den: '', referencia: '', comentario: '', motivo: '', fecha: '', descripcion: '' });
  const [intento, setIntento] = useState(false);
  const [anular, setAnular] = useState<Resultado | null>(null); const [motivoAnular, setMotivoAnular] = useState('');
  const [periodoEv, setPeriodoEv] = useState(''); const [ligando, setLigando] = useState<string | null>(null); const [selLiga, setSelLiga] = useState<string[]>([]);
  const uid = auth.user?.id;
  const esRevisor = auth.hasRole('responsable_sanitario') || auth.hasRole('aseguramiento_calidad');
  const puedeCapturar = (k: Kpi) => esRevisor || auth.hasRole('admin') || (!!uid && k.capturistas.includes(uid));
  const filtrados = kpis.filter(k => (!mios || (!!uid && k.capturistas.includes(uid))) && (grupo === 'todos' || k.grupo === grupo) && (nivel === 'todos' || k.nivel === nivel));
  const grupos = [...new Set(kpis.map(k => k.grupo).filter(Boolean))].sort();
  const niveles = [...new Set(kpis.map(k => k.nivel).filter(Boolean))];
  const resultadoDe = (k: Kpi, inicio: string) => resultados.find(r => (r.kpi_definicion_id === k.id || r.kpi_puesto_id === k.id) && r.periodo_inicio === inicio);
  const refrescar = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['k2-resultados'] }), qc.invalidateQueries({ queryKey: ['k2-evidencias'] }), qc.invalidateQueries({ queryKey: ['pendientes'] })]); };
  const ejecutar = async (f: () => Promise<void>) => { setBusy(true); try { await f(); await refrescar(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };

  const exportar = () => ejecutar(async () => {
    const nombre = `Resultados-KPI-${anio}.xlsx`;
    const ctx = await prepararDocumento('indicadores.resultados_excel', nombre, { empresa: auth.org?.nombre ?? '', logoPath: auth.org?.logo_url, generadoPor: auth.profile?.nombre || auth.user?.email || '' });
    const filas = filtrados.flatMap(k => resultados.filter(r => (r.kpi_definicion_id === k.id || r.kpi_puesto_id === k.id) && r.periodo_inicio.startsWith(String(anio))).map(r => ({
      Tipo: k.tabla === 'kpi_definiciones' ? 'SGC' : 'Puesto', Código: k.codigo, Nombre: k.nombre, Periodo: etiquetaPeriodo(k.frecuencia, r.periodo_inicio),
      Numerador: r.numerador, Denominador: r.denominador ?? '', Valor: r.valor ?? '', Meta: r.meta_copia, Unidad: r.unidad_copia, Semáforo: r.semaforo, Estado: r.estado, 'Referencia de la fuente': r.referencia_fuente ?? '',
    })));
    await conservarYDescargar(ctx, new Blob([exportarResultados(ctx, filas) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
  });
  const abrir = (kpi: Kpi, inicio?: string, fin?: string) => {
    const r = inicio ? resultadoDe(kpi, inicio) : undefined;
    const etiqueta = inicio ? etiquetaPeriodo(kpi.frecuencia, inicio) : '';
    setForm({ num: r ? String(r.numerador) : '', den: r?.denominador != null ? String(r.denominador) : '', referencia: r?.referencia_fuente || (inicio ? referenciaPeriodo(kpi, inicio) : kpi.fuente || etiqueta), comentario: r?.comentario ?? '', motivo: '', fecha: '', descripcion: '' });
    setIntento(false); setAbierto({ kpi, inicio, fin, resultado: r });
  };
  const unidadAbierta = abierto ? abierto.resultado?.unidad_copia ?? abierto.kpi.unidad : '';
  const esSgc = abierto?.kpi.tabla === 'kpi_definiciones' && abierto.kpi.nivel === 'SGC';
  const errores = abierto ? {
    num: form.num.trim() === '' || !Number.isFinite(Number(form.num)) ? 'Numerador numérico obligatorio' : '',
    den: faltaDenominador(unidadAbierta, form.den) ? 'Denominador obligatorio: la unidad no es «número»' : form.den.trim() !== '' && !Number.isFinite(Number(form.den)) ? 'Denominador no numérico' : '',
    referencia: esSgc && form.referencia.trim() === '' ? 'Referencia de la fuente obligatoria en nivel SGC' : '',
    motivo: abierto.resultado && form.motivo.trim().length < 5 ? 'Motivo obligatorio (mínimo 5 caracteres)' : '',
    evento: !abierto.inicio && (!form.fecha || !form.descripcion.trim()) ? 'Fecha y descripción del evento obligatorias' : !abierto.inicio && form.fecha > hoy ? 'La fecha aún no ocurre' : '',
  } : null;
  const guardar = () => {
    setIntento(true);
    if (!abierto || !errores || Object.values(errores).some(Boolean)) return;
    const a = abierto;
    void ejecutar(async () => {
      await guardarResultado({ tabla: a.kpi.tabla, kpiId: a.kpi.id, periodoInicio: a.inicio, fechaEvento: a.inicio ? undefined : form.fecha, descripcionEvento: form.descripcion, numerador: Number(form.num), denominador: form.den.trim() === '' ? null : Number(form.den), referencia: form.referencia, comentario: form.comentario, motivo: form.motivo, resultadoId: a.resultado?.id });
      setAbierto(null); toast.success(a.resultado ? 'Resultado corregido y auditado' : 'Resultado capturado');
    });
  };
  const calc = abierto && form.num.trim() !== '' && Number.isFinite(Number(form.num)) ? calcular(unidadAbierta, abierto.resultado?.tendencia_copia ?? abierto.kpi.tendencia, abierto.resultado?.meta_copia ?? abierto.kpi.meta, Number(form.num), form.den.trim() === '' ? null : Number(form.den)) : null;
  const evidenciasDe = (r?: Resultado) => r ? ligas.filter(l => l.resultado_id === r.id).map(l => evidencias.find(e => e.id === l.evidencia_id)).filter(Boolean) : [];
  const abrirEvidencia = (path: string) => void urlEvidencia(path).then(u => window.open(u, '_blank')).catch(e => toast.error((e as Error).message));

  const periodosEv = useMemo(() => { const m = new Map<string, { inicio: string; fin: string; etiqueta: string }>(); for (const k of kpis) { const p = ultimoCerrado(k.frecuencia, hoy); if (p) m.set(`${p.inicio}|${p.fin}`, { ...p, etiqueta: etiquetaPeriodo(k.frecuencia, p.inicio) }); } return [...m.values()]; }, [kpis, hoy]);
  const evSel = periodosEv.find(p => `${p.inicio}|${p.fin}` === periodoEv);
  const evLigando = evidencias.find(e => e.id === ligando);
  const resultadosLigables = evLigando ? resultados.filter(r => r.periodo_inicio >= evLigando.periodo_inicio && r.periodo_inicio <= evLigando.periodo_fin) : [];
  const nombreKpi = (r: Resultado) => { const k = kpis.find(x => x.id === (r.kpi_definicion_id ?? r.kpi_puesto_id)); return k ? `${k.codigo} · ${k.nombre}` : 'KPI'; };

  const estadoBadge = (k: Kpi, r?: Resultado) => k.estado !== 'validado' ? <Badge variant="outline">Por validar</Badge> : r ? <Badge variant={r.estado === 'revisado' ? 'default' : 'secondary'}>{r.estado}</Badge> : <span className="text-xs text-muted-foreground">sin captura</span>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Select value={grupo} onValueChange={setGrupo}><SelectTrigger className="w-60" aria-label="Puesto o proceso"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los puestos y procesos</SelectItem>{grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
      <Select value={nivel} onValueChange={setNivel}><SelectTrigger className="w-44" aria-label="Nivel"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los niveles</SelectItem>{niveles.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={mios} onCheckedChange={v => setMios(v === true)} aria-label="Los que me tocan" />Los que me tocan</label>
    </div>
    <Tabs defaultValue="capturar">
      <TabsList><TabsTrigger value="capturar">Por capturar</TabsTrigger><TabsTrigger value="anio">Año</TabsTrigger></TabsList>
      <TabsContent value="capturar" className="space-y-6">
        {qCat.isLoading || qRes.isLoading ? <p>Cargando…</p> : !filtrados.length ? <p className="py-6 text-muted-foreground">Sin KPI con estos filtros.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>KPI</TableHead><TableHead>Periodo</TableHead><TableHead>Valor / cumplimiento</TableHead><TableHead>Semáforo</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{filtrados.map(k => {
          const borrador = k.estado !== 'validado'; const per = ultimoCerrado(k.frecuencia, hoy); const r = per ? resultadoDe(k, per.inicio) : undefined;
          return <TableRow key={k.id} className={cn(borrador && 'text-muted-foreground opacity-60')}>
            <TableCell className="min-w-56"><span className="font-medium">{k.codigo}</span> · {k.nombre}<div className="text-xs text-muted-foreground">{k.grupo} · {k.nivel} · meta {fmt(k.meta)} {k.unidad} · {k.frecuencia}</div></TableCell>
            <TableCell className="whitespace-nowrap">{per ? etiquetaPeriodo(k.frecuencia, per.inicio) : 'por evento'}</TableCell>
            <TableCell className="whitespace-nowrap">{r ? <>{fmt(r.valor)} {r.unidad_copia}<div className="text-xs text-muted-foreground">{r.cumplimiento != null ? `${Math.round(r.cumplimiento * 100)}%` : 'sin cumplimiento'}</div></> : '—'}</TableCell>
            <TableCell>{r ? <Badge variant="outline" className={claseSemaforo(r.semaforo)}>{r.semaforo}</Badge> : '—'}</TableCell>
            <TableCell>{estadoBadge(k, r)}</TableCell>
            <TableCell>{borrador ? null : !puedeCapturar(k) ? <span className="text-xs text-muted-foreground">Sin asignación de captura</span> : per ? <Button size="sm" variant={r ? 'outline' : 'default'} disabled={busy} onClick={() => abrir(k, per.inicio, per.fin)}>{r ? 'Abrir' : 'Capturar'}</Button> : <Button size="sm" disabled={busy} onClick={() => abrir(k)}><Plus className="mr-1 h-4 w-4" />Registrar evento</Button>}</TableCell>
          </TableRow>;
        })}</TableBody></Table></div>}
        <section className="space-y-3 rounded-md border p-4">
          <h3 className="font-semibold">Evidencias del periodo</h3>
          <p className="text-sm text-muted-foreground">Archivo opcional: el registro oficial es el papel. Súbelo una vez y lígalo a varios resultados del periodo.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={periodoEv} onValueChange={setPeriodoEv}><SelectTrigger className="w-56" aria-label="Periodo de la evidencia"><SelectValue placeholder="Periodo" /></SelectTrigger><SelectContent>{periodosEv.map(p => <SelectItem key={`${p.inicio}|${p.fin}`} value={`${p.inicio}|${p.fin}`}>{p.etiqueta}</SelectItem>)}</SelectContent></Select>
            <Label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', (!evSel || busy) && 'pointer-events-none opacity-50')}><Upload className="h-4 w-4" />Subir archivo<input type="file" className="sr-only" aria-label="Archivo de evidencia" disabled={!evSel || busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f && evSel) void ejecutar(async () => { await registrarEvidencia(String(auth.orgId), evSel.inicio, evSel.fin, f); toast.success('Evidencia registrada'); }); }} /></Label>
          </div>
          {evidencias.length > 0 && <ul className="space-y-1 text-sm">{evidencias.slice(0, 20).map(e => <li key={e.id} className="flex flex-wrap items-center gap-2"><Button size="sm" variant="link" className="h-auto p-0" onClick={() => abrirEvidencia(e.path)}><Paperclip className="mr-1 h-3 w-3" />{e.nombre}</Button><span className="text-xs text-muted-foreground">{e.periodo_inicio} al {e.periodo_fin} · {ligas.filter(l => l.evidencia_id === e.id).length} resultados</span><Button size="sm" variant="outline" disabled={busy} onClick={() => { setLigando(e.id); setSelLiga(ligas.filter(l => l.evidencia_id === e.id).map(l => l.resultado_id)); }}><Link2 className="mr-1 h-3 w-3" />Ligar</Button></li>)}</ul>}
        </section>
      </TabsContent>
      <TabsContent value="anio">
        <div className="mb-3 flex flex-wrap items-center gap-3"><Select value={String(anio)} onValueChange={v => setAnio(Number(v))}><SelectTrigger className="w-32" aria-label="Año"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 6 }, (_, i) => Number(hoy.slice(0, 4)) - i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select><ImportarResultados kpis={filtrados} resultados={resultados} anio={anio} hoy={hoy} refrescar={refrescar}/><Button variant="outline" disabled={busy} onClick={() => void exportar()}><Download className="mr-2 h-4 w-4"/>Exportar resultados</Button></div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="min-w-56">KPI</TableHead>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map(m => <TableHead key={m} className="text-center">{m}</TableHead>)}</TableRow></TableHeader><TableBody>{filtrados.map(k => {
          const borrador = k.estado !== 'validado'; const celdas = celdasAnio(k.frecuencia, anio);
          return <TableRow key={k.id} className={cn(borrador && 'text-muted-foreground opacity-60')}>
            <TableCell><span className="font-medium">{k.codigo}</span> · {k.nombre}<div className="text-xs text-muted-foreground">{k.frecuencia} · meta {fmt(k.meta)} {k.unidad}</div></TableCell>
            {borrador ? <TableCell colSpan={12} className="text-center"><Badge variant="outline">Por validar</Badge></TableCell> : !celdas.length ? <TableCell colSpan={12} className="text-center text-xs text-muted-foreground">por evento · usa «Registrar evento» en Por capturar</TableCell> : celdas.map(p => {
              const r = resultadoDe(k, p.inicio); const cerrado = periodoCerrado(p.fin, hoy); const habil = cerrado && puedeCapturar(k);
              return <TableCell key={p.inicio} colSpan={p.meses} className="p-1 text-center"><Button variant="outline" type="button" disabled={!habil || busy} aria-label={`${k.codigo} ${etiquetaPeriodo(k.frecuencia, p.inicio)}`} title={cerrado ? `${etiquetaPeriodo(k.frecuencia, p.inicio)} · ${r?.semaforo ?? 'sin captura'} · ${r?.estado ?? ''}` : 'El periodo aún no cierra'} onClick={() => abrir(k, p.inicio, p.fin)} className={cn('h-9 w-full min-w-12 gap-1 rounded border p-1 text-xs disabled:cursor-not-allowed disabled:opacity-100', r ? claseSemaforo(r.semaforo) : 'border-dashed hover:bg-muted')}>{r ? <>{fmt(r.valor)}{r.estado === 'revisado' ? <Check className="h-3 w-3 shrink-0" aria-label="Revisado"/> : <Pencil className="h-3 w-3 shrink-0" aria-label="Capturado"/>}</> : cerrado ? '+' : ''}</Button></TableCell>;
            })}
          </TableRow>;
        })}</TableBody></Table></div>
      </TabsContent>
    </Tabs>

    <Dialog open={!!abierto} onOpenChange={v => { if (!v && !busy) setAbierto(null); }}><DialogContent className="max-w-lg">{abierto && errores && <>
      <DialogHeader><DialogTitle>{abierto.kpi.codigo} · {abierto.inicio ? etiquetaPeriodo(abierto.kpi.frecuencia, abierto.inicio) : 'Registrar evento'}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{abierto.kpi.nombre} · meta {fmt(abierto.resultado?.meta_copia ?? abierto.kpi.meta)} {unidadAbierta} · {abierto.resultado?.tendencia_copia ?? abierto.kpi.tendencia}</p>
      <div className="grid gap-3">
        {!abierto.inicio && <><div><Label htmlFor="k2-fecha">Fecha del evento</Label><Input id="k2-fecha" type="date" max={hoy} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div><div><Label htmlFor="k2-desc">Descripción del evento</Label><Input id="k2-desc" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>{intento && errores.evento && <p className="text-sm text-destructive">{errores.evento}</p>}</>}
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="k2-num">Numerador</Label><Input id="k2-num" type="number" step="any" value={form.num} onChange={e => setForm({ ...form, num: e.target.value })} aria-invalid={intento && !!errores.num} />{intento && errores.num && <p className="mt-1 text-xs text-destructive">{errores.num}</p>}</div>
          <div><Label htmlFor="k2-den">Denominador{unidadAbierta === 'número' ? ' (no aplica)' : ''}</Label><Input id="k2-den" type="number" step="any" disabled={unidadAbierta === 'número'} value={form.den} onChange={e => setForm({ ...form, den: e.target.value })} aria-invalid={!!errores.den && (intento || form.num !== '')} />{errores.den && (intento || form.num !== '') && <p className="mt-1 text-xs text-destructive">{errores.den}</p>}</div>
        </div>
        {calc && <p className="text-sm">Valor {fmt(calc.valor)} {unidadAbierta} · {calc.cumplimiento != null ? `${Math.round(calc.cumplimiento * 100)}%` : 'sin cumplimiento'} · <Badge variant="outline" className={claseSemaforo(calc.semaforo)}>{calc.semaforo}</Badge></p>}
        <div><Label htmlFor="k2-ref">Referencia de la fuente{esSgc ? ' (obligatoria en SGC)' : ' (opcional)'}</Label><Input id="k2-ref" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} aria-invalid={intento && !!errores.referencia} />{intento && errores.referencia && <p className="mt-1 text-xs text-destructive">{errores.referencia}</p>}</div>
        <div><Label htmlFor="k2-com">Comentario</Label><Textarea id="k2-com" value={form.comentario} onChange={e => setForm({ ...form, comentario: e.target.value })} /></div>
        {abierto.resultado && <div><Label htmlFor="k2-mot">Motivo de la corrección</Label><Textarea id="k2-mot" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />{intento && errores.motivo && <p className="mt-1 text-xs text-destructive">{errores.motivo}</p>}</div>}
        {abierto.resultado && <div className="text-sm">{evidenciasDe(abierto.resultado).length ? evidenciasDe(abierto.resultado).map(e => <Button key={e!.id} size="sm" variant="link" className="h-auto p-0 pr-3" onClick={() => abrirEvidencia(e!.path)}><Paperclip className="mr-1 h-3 w-3" />{e!.nombre}</Button>) : abierto.resultado.evidencia_path ? <Button size="sm" variant="link" className="h-auto p-0" onClick={() => abrirEvidencia(abierto.resultado!.evidencia_path!)}><Paperclip className="mr-1 h-3 w-3" />Evidencia</Button> : <span className="text-muted-foreground">Sin archivo ligado (opcional)</span>}</div>}
      </div>
      <DialogFooter className="flex-wrap gap-2">
        {abierto.resultado && esRevisor && abierto.resultado.estado === 'capturado' && <Button variant="outline" disabled={busy} onClick={() => { const r = abierto.resultado!; void ejecutar(async () => { await revisarResultado(r.id, ''); setAbierto(null); toast.success('Resultado revisado'); }); }}><Check className="mr-1 h-4 w-4" />Revisar</Button>}
        {abierto.resultado && (esRevisor || auth.hasRole('admin')) && <Button variant="ghost" disabled={busy} onClick={() => { setAnular(abierto.resultado!); setMotivoAnular(''); setAbierto(null); }}><Ban className="mr-1 h-4 w-4" />Anular</Button>}
        <Button variant="outline" disabled={busy} onClick={() => setAbierto(null)}>Cancelar</Button>
        <Button disabled={busy} onClick={guardar}><Save className="mr-1 h-4 w-4" />{abierto.resultado ? 'Guardar corrección' : 'Guardar'}</Button>
      </DialogFooter>
    </>}</DialogContent></Dialog>

    <Dialog open={!!anular} onOpenChange={v => { if (!v && !busy) setAnular(null); }}><DialogContent><DialogHeader><DialogTitle>Anular resultado</DialogTitle></DialogHeader><Label htmlFor="k2-anular">Motivo obligatorio (mínimo 5 caracteres)</Label><Textarea id="k2-anular" value={motivoAnular} onChange={e => setMotivoAnular(e.target.value)} /><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setAnular(null)}>Cancelar</Button><Button disabled={busy || motivoAnular.trim().length < 5} onClick={() => { const r = anular!; void ejecutar(async () => { await anularResultado(r.id, motivoAnular); setAnular(null); toast.success('Resultado anulado y auditado'); }); }}>Anular</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!ligando} onOpenChange={v => { if (!v && !busy) setLigando(null); }}><DialogContent><DialogHeader><DialogTitle>Ligar «{evLigando?.nombre}» a resultados</DialogTitle></DialogHeader>
      {!resultadosLigables.length ? <p className="text-sm text-muted-foreground">No hay resultados capturados en este periodo.</p> : <div className="max-h-80 space-y-2 overflow-y-auto">{resultadosLigables.map(r => { const ya = ligas.some(l => l.evidencia_id === ligando && l.resultado_id === r.id); return <label key={r.id} className="flex items-center gap-2 text-sm"><Checkbox checked={selLiga.includes(r.id)} disabled={ya} onCheckedChange={v => setSelLiga(s => v === true ? [...s, r.id] : s.filter(x => x !== r.id))} />{nombreKpi(r)} · {r.periodo_inicio}</label>; })}</div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setLigando(null)}>Cancelar</Button><Button disabled={busy || !selLiga.length} onClick={() => { const id = ligando!; const nuevos = selLiga.filter(r => !ligas.some(l => l.evidencia_id === id && l.resultado_id === r)); if (!nuevos.length) { setLigando(null); return; } void ejecutar(async () => { const n = await ligarEvidencia(id, nuevos); setLigando(null); toast.success(`Evidencia ligada a ${n} resultados`); }); }}>Ligar</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
