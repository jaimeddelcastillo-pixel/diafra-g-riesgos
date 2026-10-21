// T5b: módulos por empresa (organization_features). Solo super_admin; motivo obligatorio y auditado.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Boxes } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const MODULOS_PANEL = [
  { clave: 'riesgos', nombre: 'Gestión de Riesgos' },
  { clave: 'institutional_brain', nombre: 'Cerebro Institucional' },
  { clave: 'tendencias', nombre: 'Análisis de Tendencias' },
] as const;

export const motivoValido = (m: string) => m.trim().length >= 5;

export async function cambiarModulo(orgId: string, clave: string, activo: boolean, motivo: string) {
  if (!motivoValido(motivo)) throw new Error('Motivo obligatorio (mínimo 5 caracteres)');
  const { error } = await supabase.rpc('admin_set_modulo', { _org: orgId, _clave: clave, _activo: activo, _motivo: motivo.trim() });
  if (error) throw new Error(error.message);
}

export default function ModulosEmpresaCard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [pend, setPend] = useState<{ clave: string; nombre: string; activo: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const q = useQuery({
    queryKey: ['admin-modulos-org', orgId],
    queryFn: async () => {
      const [f, m, acc] = await Promise.all([
        supabase.from('organization_features').select('feature_key,activo,activado_en').eq('org_id', orgId),
        supabase.from('modulos').select('clave,estado'),
        Promise.all(MODULOS_PANEL.map(async (x) => {
          const { data } = await supabase.rpc('org_tiene_modulo', { _org: orgId, _modulo: x.clave });
          return [x.clave, !!data] as const;
        })),
      ]);
      if (f.error) throw f.error;
      return { feats: f.data ?? [], mods: m.data ?? [], acceso: Object.fromEntries(acc) as Record<string, boolean> };
    },
  });

  const confirmar = async () => {
    if (!pend) return;
    setGuardando(true);
    try {
      await cambiarModulo(orgId, pend.clave, pend.activo, motivo);
      toast.success(`${pend.nombre} ${pend.activo ? 'activado' : 'desactivado'}`);
      setPend(null); setMotivo('');
      await qc.invalidateQueries({ queryKey: ['admin-modulos-org', orgId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4" /> Módulos</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {MODULOS_PANEL.map((m) => {
          const f = q.data?.feats.find((x) => x.feature_key === m.clave);
          const beta = q.data?.mods.find((x) => x.clave === m.clave)?.estado === 'beta';
          const on = !!q.data?.acceso[m.clave];
          return (
            <div key={m.clave} className="flex items-center justify-between gap-3 border rounded-md px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{m.nombre}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f?.activo && f.activado_en ? `Activado el ${new Date(f.activado_en).toLocaleDateString('es-MX')}` : on ? 'Incluido en el plan' : 'Sin activar'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={on ? 'default' : 'outline'} className="text-[10px]">{!on ? 'Inactivo' : beta ? 'Beta' : 'Activo'}</Badge>
                <Switch checked={on} disabled={q.isLoading} aria-label={`Módulo ${m.nombre}`}
                  onCheckedChange={(v) => { setMotivo(''); setPend({ clave: m.clave, nombre: m.nombre, activo: v }); }} />
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground">Desactivar oculta el módulo a la empresa; sus datos se conservan.</p>
      </CardContent>
      <Dialog open={!!pend} onOpenChange={(o) => !o && setPend(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pend?.activo ? 'Activar' : 'Desactivar'} {pend?.nombre}</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPend(null)}>Cancelar</Button>
            <Button disabled={!motivoValido(motivo) || guardando} onClick={confirmar}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
