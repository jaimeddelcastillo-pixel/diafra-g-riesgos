import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { aplicarResultadosExcel, leerResultadosExcel, plantillaAnio, previewExcel, type CeldaExcel, type KpiExcel, type VistaExcel } from './lib/excel-resultados';
import type { Resultado } from './lib/resultados';

export default function ImportarResultados({ kpis, resultados, anio, hoy, refrescar }: { kpis: KpiExcel[]; resultados: Resultado[]; anio: number; hoy: string; refrescar: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [vista, setVista] = useState<VistaExcel[] | null>(null); const [celdas, setCeldas] = useState<CeldaExcel[]>([]); const [motivo, setMotivo] = useState('');
  const ejecutar = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  return <>
    <Button variant="outline" disabled={busy} onClick={() => void ejecutar(async () => { const bytes = await plantillaAnio(kpis, resultados, anio, hoy); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); const a = document.createElement('a'); a.href = url; a.download = `Resultados-KPI-${anio}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })}><Download className="mr-2 h-4 w-4"/>Descargar plantilla</Button>
    <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4"/>Importar Excel</Button>
    <input ref={input} type="file" accept=".xlsx" className="sr-only" aria-label="Resultados Excel" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; void ejecutar(async () => { if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB'); const cells = leerResultadosExcel(await file.arrayBuffer()); if (!cells.length) throw new Error('No hay mediciones en el archivo'); setCeldas(cells); setVista(await previewExcel(cells)); setMotivo(''); }); }}/>
    <Dialog open={vista !== null} onOpenChange={v => { if (!v && !busy) setVista(null); }}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>Vista previa · {celdas.length} celdas</DialogTitle></DialogHeader>
      <div className="flex flex-wrap gap-4 text-sm">{['nuevo','cambia','sin cambio','ignorado (periodo abierto)','error'].map(estado => <span key={estado}>{estado}: {vista?.filter(v => v.estado === estado).length ?? 0}</span>)}</div>
      <div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>Hoja / celda</TableHead><TableHead>KPI / periodo</TableHead><TableHead>Estado</TableHead><TableHead>Antes → después</TableHead><TableHead>Error</TableHead></TableRow></TableHeader><TableBody>{vista?.map((v, i) => <TableRow key={i}><TableCell>{v.celda.hoja} · {v.celda.posicion}</TableCell><TableCell>{v.celda.codigo} · {v.celda.inicio}</TableCell><TableCell>{v.estado}</TableCell><TableCell className="min-w-64">{v.antes ? `${v.antes.numerador} / ${v.antes.denominador ?? '—'} · ${v.antes.referencia}` : '—'} → {String(v.celda.numerador)} / {String(v.celda.denominador || '—')} · {v.celda.referencia}</TableCell><TableCell className="text-destructive">{v.error}</TableCell></TableRow>)}</TableBody></Table></div>
      <Label htmlFor="k2-excel-motivo">Motivo obligatorio (mínimo 5 caracteres)</Label><Textarea id="k2-excel-motivo" value={motivo} onChange={e => setMotivo(e.target.value)}/>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setVista(null)}>Cancelar</Button><Button disabled={busy || motivo.trim().length < 5 || !vista?.some(v => v.estado === 'nuevo' || v.estado === 'cambia') || vista.some(v => v.estado === 'error')} onClick={() => void ejecutar(async () => { const n = await aplicarResultadosExcel(celdas, motivo); await refrescar(); setVista(null); toast.success(`${n} resultados importados y auditados`); })}>Aplicar</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}