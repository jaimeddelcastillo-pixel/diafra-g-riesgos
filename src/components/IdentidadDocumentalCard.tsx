import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileBadge, Pencil, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ROLES_FIRMA, TIPOS_DOCUMENTO } from '@/config/documentos';
import { guardarFormato, guardarIdentidad, type Firma, type Formato, type Identidad } from '@/lib/documentos';

const VACIA: Identidad = { razon_social: '', domicilio: '', leyenda_confidencialidad: '', leyenda_copia: 'Documento controlado', pie: '' };

/** D1: Configuración › Identidad documental. Every save inserts a new version with a reason. */
export function IdentidadDocumentalCard() {
  const { orgId, hasRole, org } = useAuth(); const qc = useQueryClient();
  const puede = hasRole('admin') || hasRole('responsable_sanitario') || hasRole('aseguramiento_calidad');
  const q = useQuery({
    queryKey: ['identidad-documental', orgId], enabled: !!orgId,
    queryFn: async () => {
      const [i, f] = await Promise.all([
        supabase.from('org_identidad_documental').select('*').order('version', { ascending: false }).limit(1),
        supabase.from('org_formatos').select('*').order('version', { ascending: false }),
      ]);
      if (i.error) throw i.error; if (f.error) throw f.error;
      const vigentes = new Map<string, Formato>();
      for (const x of (f.data ?? []) as unknown as Formato[]) if (!vigentes.has(x.tipo)) vigentes.set(x.tipo, x);
      return { identidad: (i.data?.[0] ?? null) as unknown as Identidad | null, formatos: vigentes };
    },
  });
  const [ident, setIdent] = useState<Identidad>(VACIA); const [motivo, setMotivo] = useState('');
  const [edit, setEdit] = useState<Formato | null>(null); const [motivoF, setMotivoF] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setIdent(q.data?.identidad ?? { ...VACIA, razon_social: org?.nombre ?? '' }); }, [q.data, org?.nombre]);
  const ejecutar = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await qc.invalidateQueries({ queryKey: ['identidad-documental'] }); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  const campo = (k: keyof Identidad, label: string, area = false) => (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">{label}
      {area ? <Textarea value={String(ident[k] ?? '')} disabled={!puede} onChange={e => setIdent({ ...ident, [k]: e.target.value })} rows={2} />
        : <Input value={String(ident[k] ?? '')} disabled={!puede} onChange={e => setIdent({ ...ident, [k]: e.target.value })} />}
    </label>);
  const firmasDe = (f: Formato): Firma[] => ROLES_FIRMA.map(rol => { const fi = f.firmas.find(x => x.rol === rol); return { rol, aplica: fi ? fi.aplica !== false : false, cargo: fi?.cargo ?? '' }; });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileBadge className="h-4 w-4" /> Identidad documental
        {q.data?.identidad?.version && <Badge variant="outline">Versión {q.data.identidad.version}</Badge>}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">Datos que aparecen en el encabezado y pie de los documentos exportados. El logo es el de la empresa; si no hay logo, el encabezado muestra la razón social. Cada guardado crea una versión nueva; los documentos ya generados conservan la versión con la que se emitieron.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo('razon_social', 'Razón social')}{campo('domicilio', 'Domicilio')}
          <label className="space-y-1 text-xs font-medium text-muted-foreground">Leyenda de copia
            <Select value={ident.leyenda_copia} disabled={!puede} onValueChange={v => setIdent({ ...ident, leyenda_copia: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Documento controlado">Documento controlado</SelectItem><SelectItem value="Copia no controlada">Copia no controlada</SelectItem></SelectContent></Select>
          </label>
          {campo('pie', 'Texto libre del pie')}
          <div className="sm:col-span-2">{campo('leyenda_confidencialidad', 'Leyenda de confidencialidad', true)}</div>
        </div>
        {puede && <div className="flex flex-wrap items-end gap-2"><label className="flex-1 space-y-1 text-xs font-medium text-muted-foreground">Motivo del cambio<Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Mínimo 5 caracteres" /></label>
          <Button size="sm" disabled={busy || motivo.trim().length < 5} onClick={() => void ejecutar(async () => { await guardarIdentidad(ident, motivo); setMotivo(''); toast.success('Nueva versión de identidad guardada'); })}><Save className="mr-1 h-3.5 w-3.5" />Guardar versión</Button></div>}

        <div>
          <h4 className="mb-2 text-sm font-semibold">Formatos por tipo de documento</h4>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Código</TableHead><TableHead>Versión</TableHead><TableHead>Vigente desde</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{Object.entries(TIPOS_DOCUMENTO).map(([tipo, t]) => { const f = q.data?.formatos.get(tipo); return (
              <TableRow key={tipo}><TableCell><div className="font-medium">{f?.titulo || t.titulo}</div><div className="text-xs text-muted-foreground">{t.modulo} · {t.formato}{!t.aplicado && ' · aún no usa esta identidad'}</div></TableCell>
                <TableCell className="font-mono text-xs">{f?.codigo || <span className="text-muted-foreground">{t.codigoSugerido ? `sugerido ${t.codigoSugerido}` : '—'}</span>}</TableCell>
                <TableCell>{f?.version_formato || '—'}{f?.version ? <span className="ml-1 text-xs text-muted-foreground">(v{f.version})</span> : null}</TableCell>
                <TableCell>{f?.vigente_desde ?? '—'}</TableCell>
                <TableCell>{puede && <Button size="sm" variant="ghost" aria-label={`Editar formato ${t.titulo}`} onClick={() => { setMotivoF(''); setEdit(f ? { ...f, firmas: firmasDe(f) } : { tipo, codigo: t.codigoSugerido ?? '', version_formato: '', titulo: t.titulo, firmas: firmasDe({ firmas: [] } as unknown as Formato), vigente_desde: null }); }}><Pencil className="h-3.5 w-3.5" /></Button>}</TableCell></TableRow>); })}</TableBody></Table></div>
        </div>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Formato · {edit && (TIPOS_DOCUMENTO[edit.tipo]?.titulo ?? edit.tipo)}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">Título<Input value={edit.titulo} onChange={e => setEdit({ ...edit, titulo: e.target.value })} /></label>
              <label className="space-y-1 text-xs">Código del formato<Input value={edit.codigo} maxLength={40} onChange={e => setEdit({ ...edit, codigo: e.target.value })} /></label>
              <label className="space-y-1 text-xs">Versión<Input value={edit.version_formato} maxLength={10} onChange={e => setEdit({ ...edit, version_formato: e.target.value })} /></label>
              <label className="space-y-1 text-xs">Vigente desde<Input type="date" value={edit.vigente_desde ?? ''} onChange={e => setEdit({ ...edit, vigente_desde: e.target.value || null })} /></label>
            </div>
            <div className="space-y-2"><p className="text-xs font-medium">Puestos de firma</p>
              {edit.firmas.map((fi, i) => <div key={fi.rol} className="grid grid-cols-[120px_1fr] items-center gap-2 text-xs"><label className="flex items-center gap-2 font-semibold"><Checkbox checked={fi.aplica !== false} onCheckedChange={v => setEdit({ ...edit, firmas: edit.firmas.map((x, j) => j === i ? { ...x, aplica: v === true } : x) })} />{fi.rol}</label>
                <Input aria-label={`Cargo sugerido ${fi.rol}`} placeholder="Cargo sugerido" disabled={fi.aplica === false} value={fi.cargo} onChange={e => setEdit({ ...edit, firmas: edit.firmas.map((x, j) => j === i ? { ...x, cargo: e.target.value } : x) })} /></div>)}
            </div>
            <label className="space-y-1 text-xs">Motivo del cambio<Input value={motivoF} onChange={e => setMotivoF(e.target.value)} placeholder="Mínimo 5 caracteres" /></label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button disabled={busy || motivoF.trim().length < 5} onClick={() => edit && void ejecutar(async () => { await guardarFormato(edit, motivoF); setEdit(null); toast.success('Nueva versión del formato guardada'); })}>Guardar versión</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
