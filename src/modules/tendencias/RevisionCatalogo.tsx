// T4c: Revisión del catálogo (admin y RS). Semáforo automático por instrumento; edición individual con motivo y auditoría.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AreaClasificada, Instrumento } from './lib/catalogos';
import { revisarInstrumento, semaforo, CLASES_INSTRUMENTO } from './lib/norma';
import { editarInstrumento, mediasTrimestre } from './lib/persistencia';
import SugerenciaNorma, { useNormas, marcarCriterioInterno } from './SugerenciaNorma';

const COLOR = { verde: 'bg-success', amarillo: 'bg-warning', rojo: 'bg-destructive' } as const;
const CAMPOS: { key: string; label: string; type?: 'number' | 'boolean' | 'clase' | 'estado' }[] = [
  { key: 'codigo_bitacora', label: 'Código de bitácora (corto, p. ej. BIT-CMB-24-43)' },
  { key: 'clase_instrumento', label: 'Tipo de instrumento', type: 'clase' },
  { key: 'spec_estado', label: 'Estado de especificación', type: 'estado' },
  { key: 'spec_texto', label: 'Texto de especificación' },
  { key: 'spec_lie', label: 'LIE', type: 'number' },
  { key: 'spec_lie_estricto', label: 'LIE estricto (>)', type: 'boolean' },
  { key: 'spec_lse', label: 'LSE', type: 'number' },
  { key: 'spec_lse_estricto', label: 'LSE estricto (<)', type: 'boolean' },
  { key: 'spec_referencia', label: 'Referencia normativa' },
  { key: 'spec_nota', label: 'Nota (p. ej. criterio interno)' },
  { key: 'escala_min', label: 'Escala del instrumento: mínimo', type: 'number' },
  { key: 'escala_max', label: 'Escala del instrumento: máximo', type: 'number' },
  { key: 'escala_unidad', label: 'Unidad de la escala' },
  { key: 'op_min_pa', label: 'Rango de operación mínimo (informativo)', type: 'number' },
  { key: 'op_max_pa', label: 'Rango de operación máximo (informativo)', type: 'number' },
];

export default function RevisionCatalogo({ instrumentos, areas, puedeEditar, onCambio }: {
  instrumentos: Instrumento[]; areas: AreaClasificada[]; puedeEditar: boolean; onCambio: () => void;
}) {
  const normas = useNormas().data ?? [];
  const medias = useQuery({ queryKey: ['tend-medias-trimestre'], queryFn: mediasTrimestre }).data;
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const isoDe = (i: { area_id: string | null }) => areas.find(a => a.id === i.area_id)?.iso ?? null;

  const filas = useMemo(() => instrumentos.filter(i => i.activo).map(i => {
    const h = revisarInstrumento(i, isoDe(i), medias?.get(i.id) ?? null, normas);
    return { i, h, s: semaforo(h) };
  }).sort((a, b) => ['rojo', 'amarillo', 'verde'].indexOf(a.s) - ['rojo', 'amarillo', 'verde'].indexOf(b.s)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [instrumentos, areas, normas, medias]);

  const guardar = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const v: Record<string, unknown> = {};
      for (const c of CAMPOS) {
        let x = edit[c.key];
        if (c.type === 'number') x = x === '' || x == null ? null : Number(x);
        if (c.type === 'boolean') x = !!x;
        if (c.type !== 'number' && c.type !== 'boolean' && x === '') x = null;
        v[c.key] = x ?? null;
      }
      v.especificacion = v.spec_texto;
      v.tipo = edit.tipo;
      const final = marcarCriterioInterno(normas, isoDe({ area_id: (edit.area_id as string | null) ?? null }), v);
      delete final.tipo;
      await editarInstrumento(String(edit.id), final, motivo.trim());
      toast.success('Instrumento actualizado; el cambio quedó en la auditoría con su motivo');
      setEdit(null); onCambio();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const cuenta = (s: string) => filas.filter(f => f.s === s).length;
  return (
    <section className="space-y-3" aria-label="Revisión del catálogo">
      <div>
        <h2 className="font-semibold">Revisión del catálogo</h2>
        <p className="text-sm text-muted-foreground">Revisión automática de cada instrumento contra la norma y la media real del último trimestre. Solo señala; tú decides cada cambio.</p>
        <p className="text-xs text-muted-foreground mt-1">🔴 {cuenta('rojo')} · 🟡 {cuenta('amarillo')} · 🟢 {cuenta('verde')}</p>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8" /><TableHead>Instrumento</TableHead><TableHead>Área / ISO</TableHead><TableHead>Especificación</TableHead>
            <TableHead>Media trimestre</TableHead><TableHead>Hallazgos</TableHead>{puedeEditar && <TableHead>Editar</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {filas.map(({ i, h, s }) => (
              <TableRow key={i.id}>
                <TableCell><span className={`inline-block h-3 w-3 rounded-full ${COLOR[s]}`} aria-label={`Semáforo ${s}`} /></TableCell>
                <TableCell className="whitespace-nowrap"><div className="font-medium">{i.codigo}</div><div className="text-xs text-muted-foreground">{i.codigo_bitacora || '—'}</div></TableCell>
                <TableCell>{areas.find(a => a.id === i.area_id)?.nombre ?? i.area_libre ?? '—'} · {isoDe(i) ?? '—'}</TableCell>
                <TableCell>{i.spec_texto || i.especificacion || '—'}{i.spec_criterio_interno && <div className="text-xs text-muted-foreground">criterio interno</div>}</TableCell>
                <TableCell className="tabular-nums">{medias?.get(i.id) != null ? medias.get(i.id)!.toFixed(1) : '—'}</TableCell>
                <TableCell><ul className="text-xs space-y-0.5">{h.map((x, k) => <li key={k} className={x.nivel === 'rojo' ? 'text-destructive' : 'text-warning'}>{x.mensaje}</li>)}{!h.length && <li className="text-success">Sin observaciones</li>}</ul></TableCell>
                {puedeEditar && <TableCell><Button size="icon" variant="ghost" aria-label={`Editar ${i.codigo}`} onClick={() => { setMotivo(''); setEdit({ ...i }); }}><Pencil className="h-4 w-4" /></Button></TableCell>}
              </TableRow>
            ))}
            {!filas.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin instrumentos activos</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={o => { if (!o) setEdit(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar instrumento · {String(edit?.codigo ?? '')}</DialogTitle></DialogHeader>
          {edit && <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void guardar(); }}>
            <SugerenciaNorma valores={edit} iso={isoDe({ area_id: (edit.area_id as string | null) ?? null })} onAplicar={c => setEdit(e => ({ ...e, ...c }))} />
            {CAMPOS.map(c => {
              const val = edit[c.key];
              return <div key={c.key} className="space-y-2">
                <Label htmlFor={`rev-${c.key}`}>{c.label}</Label>
                {c.type === 'boolean' ? <Switch id={`rev-${c.key}`} checked={!!val} onCheckedChange={v => setEdit(e => ({ ...e, [c.key]: v }))} />
                  : c.type === 'clase' || c.type === 'estado' ? <Select value={String(val ?? '__none')} onValueChange={v => setEdit(e => ({ ...e, [c.key]: v === '__none' ? null : v }))}>
                    <SelectTrigger id={`rev-${c.key}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {(c.type === 'clase' ? CLASES_INSTRUMENTO : [{ value: 'pendiente', label: 'Pendiente' }, { value: 'validada', label: 'Validada' }, { value: 'na', label: 'Sin especificación' }]).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent></Select>
                  : <Input id={`rev-${c.key}`} type={c.type === 'number' ? 'number' : 'text'} step="any" maxLength={c.key === 'codigo_bitacora' ? 24 : undefined} value={val == null ? '' : String(val)} onChange={e => setEdit(x => ({ ...x, [c.key]: e.target.value }))} />}
              </div>;
            })}
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="rev-motivo">Motivo del cambio *</Label>
              <Input id="rev-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Corrección conforme a NOM-241 Apéndice A" />
            </div>
            <div className="sm:col-span-2"><Button type="submit" disabled={busy || motivo.trim().length < 5}>Guardar con motivo</Button></div>
          </form>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
