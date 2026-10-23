import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prepararDocumento } from '@/lib/documentos';
import { conservarYDescargar } from '@/lib/documentos/originales';
import { claseSemaforo } from './lib/semaforo';
import { etiquetaPeriodo, etiquetaSub, exportarTablero, flecha, fueraDeMeta, num, obtenerResumen, pct, periodosCerrados, type KpiResumen, type TipoPeriodo } from './lib/tablero';

const COLOR: Record<string, string> = { verde: 'hsl(var(--success))', amarillo: 'hsl(var(--warning))', rojo: 'hsl(var(--destructive))' };
const Sem = ({ s }: { s: string }) => <Badge variant="outline" className={claseSemaforo(s)}>{s}</Badge>;

function Grafica({ k }: { k: KpiResumen }) {
  const datos = k.subperiodos.map(s => ({ sub: etiquetaSub(k.frecuencia, s.inicio), valor: s.valor, semaforo: s.semaforo }));
  if (!datos.length) return <p className="text-sm text-muted-foreground">Sin resultados en el periodo.</p>;
  return <div className="h-56 w-full" aria-label={`Gráfica de ${k.codigo}`}><ResponsiveContainer><BarChart data={datos} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-border"/><XAxis dataKey="sub"/><YAxis/><RTooltip/>
    <ReferenceLine y={k.meta} stroke="hsl(var(--primary))" strokeDasharray="6 4" label={{ value: `Meta ${k.meta}`, position: 'right', fontSize: 11 }}/>
    <Bar dataKey="valor" name={k.unidad}>{datos.map((d, i) => <Cell key={i} fill={COLOR[d.semaforo] ?? 'hsl(var(--muted-foreground))'}/>)}</Bar>
  </BarChart></ResponsiveContainer></div>;
}

function TablaKpis({ kpis }: { kpis: KpiResumen[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead/><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Meta</TableHead><TableHead>Subperiodos</TableHead><TableHead>Acumulado</TableHead><TableHead>Cumplimiento</TableHead><TableHead>Semáforo</TableHead><TableHead>Tendencia</TableHead></TableRow></TableHeader>
    <TableBody>{kpis.map(k => <Fragment key={k.id}><TableRow className="cursor-pointer" onClick={() => setAbierto(abierto === k.id ? null : k.id)}>
      <TableCell><Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`${abierto === k.id ? 'Cerrar' : 'Abrir'} ${k.codigo}`}>{abierto === k.id ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</Button></TableCell>
      <TableCell className="font-medium">{k.codigo}</TableCell><TableCell className="min-w-48">{k.nombre}</TableCell>
      <TableCell className="whitespace-nowrap">{k.meta} {k.unidad}{k.meta_cambio && <div className="text-xs text-warning">Meta cambió: {k.metas.join(' → ')}</div>}</TableCell>
      <TableCell className="text-xs">{k.subperiodos.map(s => `${etiquetaSub(k.frecuencia, s.inicio)} ${num(s.valor)}`).join(' · ') || '—'}</TableCell>
      <TableCell>{num(k.valor)}</TableCell><TableCell>{pct(k.cumplimiento)}</TableCell><TableCell><Sem s={k.semaforo}/></TableCell>
      <TableCell title={k.valor_anterior == null ? 'Sin dato anterior' : `Anterior: ${num(k.valor_anterior)}`}>{flecha(k.tendencia_periodo)} <span className="text-xs text-muted-foreground">{num(k.valor_anterior)}</span></TableCell>
    </TableRow>{abierto === k.id && <TableRow><TableCell colSpan={9}><Grafica k={k}/></TableCell></TableRow>}</Fragment>)}
    {!kpis.length && <TableRow><TableCell colSpan={9} className="text-muted-foreground">Sin indicadores</TableCell></TableRow>}</TableBody></Table></div>;
}

export default function Tablero() {
  const auth = useAuth();
  const [tipo, setTipo] = useState<TipoPeriodo>('trimestre');
  const opciones = periodosCerrados(tipo);
  const [inicio, setInicio] = useState(opciones[0].inicio);
  const [puestoAbierto, setPuestoAbierto] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['k3a-resumen', auth.orgId, tipo, inicio], queryFn: () => obtenerResumen(tipo, inicio), enabled: !!auth.orgId });
  const r = q.data;
  const exportar = async () => { if (!r) return; try {
    const nombre = `Tablero-indicadores-${etiquetaPeriodo(r.tipo, r.inicio).replace(' ', '-')}.xlsx`;
    const ctx = await prepararDocumento('indicadores.tablero_excel', nombre, { empresa: auth.org?.nombre ?? '', logoPath: auth.org?.logo_url, generadoPor: auth.profile?.nombre || auth.user?.email || '' });
    const nombres = Object.fromEntries(r.puestos.map(p => [p.puesto_id, `${p.codigo} · ${p.nombre}`]));
    await conservarYDescargar(ctx, new Blob([exportarTablero(ctx, r, nombres) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
  } catch (e) { toast.error((e as Error).message ?? String(e)); } };
  const i = r?.indice_sgc;
  const procesos = r ? [...new Set(r.kpis.filter(k => k.tipo === 'SGC').map(k => k.proceso ?? 'Sin proceso'))] : [];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end gap-3">
      <Select value={tipo} onValueChange={v => { const t = v as TipoPeriodo; setTipo(t); setInicio(periodosCerrados(t)[0].inicio); }}><SelectTrigger className="w-40" aria-label="Tipo de periodo"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="trimestre">Trimestre</SelectItem><SelectItem value="semestre">Semestre</SelectItem><SelectItem value="año">Año</SelectItem></SelectContent></Select>
      <Select value={inicio} onValueChange={setInicio}><SelectTrigger className="w-40" aria-label="Periodo"><SelectValue/></SelectTrigger><SelectContent>{opciones.map(o => <SelectItem key={o.inicio} value={o.inicio}>{o.etiqueta}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" onClick={exportar} disabled={!r}><Download className="mr-2 h-4 w-4"/>Exportar Excel</Button>
    </div>
    {q.isLoading && <p>Cargando…</p>}
    {q.error && <p role="alert" className="text-destructive">{q.error.message}</p>}
    {r && i && <>
      <section className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Índice SGC · {etiquetaPeriodo(r.tipo, r.inicio)}</CardTitle></CardHeader><CardContent className="space-y-2">
          <div className="flex items-center gap-3"><span className="text-3xl font-bold">{pct(i.indice)}</span><Sem s={i.semaforo}/></div>
          <p className="text-sm text-muted-foreground">Periodo anterior ({etiquetaPeriodo(r.tipo, r.anterior.inicio)}): {pct(i.indice_anterior)}{i.indice != null && i.indice_anterior != null && ` · ${i.indice > i.indice_anterior ? '↑ sube' : i.indice < i.indice_anterior ? '↓ baja' : '→ igual'}`}</p>
          <p className="text-sm text-muted-foreground">{i.con_dato} de {i.total} KPI con dato</p>
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Semáforos SGC</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
          {([['verde', i.verde], ['amarillo', i.amarillo], ['rojo', i.rojo], ['sin base', i.sin_base], ['sin captura', i.sin_captura]] as const).map(([s, n]) => <Badge key={s} variant="outline" className={`${claseSemaforo(s)} text-sm`}>{s}: {n}</Badge>)}
        </CardContent></Card>
      </section>
      <section className="space-y-4"><h2 className="font-semibold">Por proceso</h2>
        {procesos.map(p => { const pr = r.procesos.find(x => x.proceso === p); return <div key={p} className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{p}</h3>{pr && <><span className="text-sm">{pct(pr.indice)}</span><Sem s={pr.semaforo}/><span className="text-xs text-muted-foreground">{pr.con_dato} de {pr.total} con dato</span></>}</div><TablaKpis kpis={r.kpis.filter(k => k.tipo === 'SGC' && (k.proceso ?? 'Sin proceso') === p)}/></div>; })}
        {!procesos.length && <p className="text-muted-foreground">Sin KPI del SGC validados.</p>}
      </section>
      <section className="space-y-2"><h2 className="font-semibold">Por puesto</h2>
        <Table><TableHeader><TableRow><TableHead/><TableHead>Puesto</TableHead><TableHead>Calificación</TableHead><TableHead>Semáforo</TableHead><TableHead>KPI con dato</TableHead></TableRow></TableHeader><TableBody>
          {r.puestos.map(p => <Fragment key={p.puesto_id}><TableRow className="cursor-pointer" onClick={() => setPuestoAbierto(puestoAbierto === p.puesto_id ? null : p.puesto_id)}>
            <TableCell>{puestoAbierto === p.puesto_id ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</TableCell><TableCell>{p.codigo} · {p.nombre}</TableCell><TableCell>{pct(p.calificacion)}</TableCell><TableCell><Sem s={p.semaforo}/></TableCell><TableCell>{p.con_dato} de {p.total}</TableCell>
          </TableRow>{puestoAbierto === p.puesto_id && <TableRow><TableCell colSpan={5}><TablaKpis kpis={r.kpis.filter(k => k.tipo === 'Puesto' && k.puesto_id === p.puesto_id)}/></TableCell></TableRow>}</Fragment>)}
          {!r.puestos.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sin KPI por puesto validados</TableCell></TableRow>}
        </TableBody></Table>
      </section>
      <section className="space-y-2"><h2 className="font-semibold">Fuera de meta</h2><TablaKpis kpis={fueraDeMeta(r)}/></section>
    </>}
  </div>;
}
