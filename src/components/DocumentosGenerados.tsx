import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileArchive } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TIPOS_DOCUMENTO } from '@/config/documentos';
import { descargarBlob, descargarPorFolio, type DocumentoOriginal } from '@/lib/documentos/originales';

export function DocumentosGenerados() {
  const { orgId } = useAuth();
  const [f, setF] = useState({ folio: '', tipo: 'todos', desde: '', hasta: '', usuario: '' });
  const [pagina, setPagina] = useState(0); const [busy, setBusy] = useState<string | null>(null);
  const cambiar = (c: Partial<typeof f>) => { setF({ ...f, ...c }); setPagina(0); };
  const q = useQuery({ queryKey: ['documentos-generados', orgId, f, pagina], enabled: !!orgId, queryFn: async () => {
    const { data, error } = await supabase.rpc('listar_documentos_archivados', { _folio: f.folio, _tipo: f.tipo === 'todos' ? '' : f.tipo, _desde: (f.desde || null) as never, _hasta: (f.hasta || null) as never, _usuario: f.usuario, _pagina: pagina });
    if (error) throw error; return data as unknown as DocumentoOriginal[];
  } });
  const descargar = async (d: DocumentoOriginal) => { setBusy(d.folio); try { descargarBlob(await descargarPorFolio(d.folio), d.nombre_archivo); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); } };
  return <section id="documentos-generados" className="scroll-mt-20 space-y-4 border-t pt-6">
    <h2 className="flex items-center gap-2 text-base font-semibold"><FileArchive className="h-4 w-4" />Documentos generados</h2>
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-xs">Folio<Input value={f.folio} onChange={e => cambiar({ folio: e.target.value })} /></label>
      <label className="space-y-1 text-xs">Tipo<Select value={f.tipo} onValueChange={tipo => cambiar({ tipo })}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{Object.entries(TIPOS_DOCUMENTO).filter(([, d]) => d.aplicado).map(([t, d]) => <SelectItem key={t} value={t}>{d.titulo} · {d.formato}</SelectItem>)}</SelectContent></Select></label>
      <label className="space-y-1 text-xs">Desde<Input type="date" value={f.desde} onChange={e => cambiar({ desde: e.target.value })} /></label>
      <label className="space-y-1 text-xs">Hasta<Input type="date" value={f.hasta} onChange={e => cambiar({ hasta: e.target.value })} /></label>
      <label className="space-y-1 text-xs">Usuario<Input value={f.usuario} onChange={e => cambiar({ usuario: e.target.value })} /></label>
    </div>
    {q.error && <p role="alert" className="text-destructive">{q.error.message}</p>}
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Documento</TableHead><TableHead>Fecha</TableHead><TableHead>Usuario</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {q.data?.slice(0, 50).map(d => <TableRow key={d.folio}><TableCell className="whitespace-nowrap font-mono text-xs">{d.folio}</TableCell><TableCell>{TIPOS_DOCUMENTO[d.tipo]?.titulo ?? d.tipo}<div className="text-xs text-muted-foreground">{d.nombre_archivo}</div></TableCell><TableCell className="whitespace-nowrap">{new Date(d.generado_en).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</TableCell><TableCell>{d.usuario}</TableCell><TableCell>{d.archivo_path ? <Button size="icon" variant="ghost" aria-label={`Descargar ${d.folio}`} disabled={busy !== null} onClick={() => void descargar(d)}><Download className="h-4 w-4" /></Button> : <span className="text-xs text-muted-foreground">Sin original histórico</span>}</TableCell></TableRow>)}
      {!q.data?.length && <TableRow><TableCell colSpan={5}>{q.isLoading ? 'Cargando…' : 'Sin documentos con estos filtros'}</TableCell></TableRow>}
    </TableBody></Table></div>
    <div className="flex justify-center gap-3"><Button variant="outline" size="sm" disabled={!pagina || q.isFetching} onClick={() => setPagina(pagina - 1)}>Anterior</Button><span className="self-center text-xs">Página {pagina + 1}</span><Button variant="outline" size="sm" disabled={(q.data?.length ?? 0) <= 50 || q.isFetching} onClick={() => setPagina(pagina + 1)}>Siguiente</Button></div>
  </section>;
}
