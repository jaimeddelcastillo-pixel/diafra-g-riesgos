// T4c: catálogo normativo de Tendencias (tabla de referencia por norma). Solo super_admin edita.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNormas } from '@/modules/tendencias/SugerenciaNorma';
import { guardarNorma } from '@/modules/tendencias/lib/persistencia';
import type { NormaEspecificacion } from '@/modules/tendencias/lib/norma';

const VAR = { presion: 'Presión diferencial', temperatura: 'Temperatura', hr: 'HR' } as const;

export default function NormaTendenciasCard() {
  const q = useNormas(); const qc = useQueryClient();
  const [edit, setEdit] = useState<Record<string, Partial<NormaEspecificacion>>>({});
  const val = <K extends keyof NormaEspecificacion>(n: NormaEspecificacion, k: K) => (edit[n.id]?.[k] ?? n[k]) as NormaEspecificacion[K];
  const set = (id: string, k: keyof NormaEspecificacion, v: unknown) => setEdit(e => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const num = (v: string) => (v === '' ? null : Number(v));
  const guardar = async (n: NormaEspecificacion) => {
    const motivo = window.prompt('Motivo del cambio (obligatorio)') ?? '';
    try { await guardarNorma(n.id, edit[n.id] ?? {}, motivo); setEdit(e => { const c = { ...e }; delete c[n.id]; return c; }); await qc.invalidateQueries({ queryKey: ['tend-normas'] }); toast.success('Especificación de la norma guardada'); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Tendencias · Especificaciones de la norma</CardTitle>
        <p className="text-xs text-muted-foreground">Referencia que se sugiere al dar de alta o editar instrumentos en todas las empresas. Cada cambio queda en la auditoría.</p></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Norma</TableHead><TableHead>Clase</TableHead><TableHead>Variable</TableHead><TableHead>Texto</TableHead><TableHead>LIE</TableHead><TableHead>&gt;</TableHead><TableHead>LSE</TableHead><TableHead>Nota</TableHead><TableHead>Activa</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).map(n => (
              <TableRow key={n.id}>
                <TableCell className="whitespace-nowrap text-xs">{n.norma} {n.apartado}</TableCell>
                <TableCell>{n.clase_iso}</TableCell>
                <TableCell className="text-xs">{VAR[n.variable]}</TableCell>
                <TableCell><Input className="h-8 min-w-40" value={val(n, 'texto')} onChange={e => set(n.id, 'texto', e.target.value)} /></TableCell>
                <TableCell><Input className="h-8 w-20" type="number" step="any" value={val(n, 'lie') ?? ''} onChange={e => set(n.id, 'lie', num(e.target.value))} /></TableCell>
                <TableCell><Switch checked={val(n, 'lie_estricto')} onCheckedChange={v => set(n.id, 'lie_estricto', v)} aria-label="LIE estricto" /></TableCell>
                <TableCell><Input className="h-8 w-20" type="number" step="any" value={val(n, 'lse') ?? ''} onChange={e => set(n.id, 'lse', num(e.target.value))} /></TableCell>
                <TableCell><Input className="h-8 min-w-40" value={val(n, 'nota') ?? ''} onChange={e => set(n.id, 'nota', e.target.value || null)} /></TableCell>
                <TableCell><Switch checked={val(n, 'activo')} onCheckedChange={v => set(n.id, 'activo', v)} aria-label="Activa" /></TableCell>
                <TableCell><Button size="sm" variant="outline" disabled={!edit[n.id]} onClick={() => guardar(n)}>Guardar</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
