import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { errorSuplencia } from '@/lib/suplencias';
export interface AutoridadCalidad { modo: string; version: number; autorizadores: string[] }
export const MODOS_CALIDAD: Record<string, string> = { con_ac: 'Con Aseguramiento de Calidad', designado: 'Sin AC, autoriza un designado', rs_maxima: 'Sin AC, el RS es la máxima autoridad' };
export function AutoridadCalidadCard() {
  const auth = useAuth(); const qc = useQueryClient(); const [modo, setModo] = useState<string>(); const [ids, setIds] = useState<string[]>(); const [motivo, setMotivo] = useState(''); const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['autoridad-calidad', auth.orgId], enabled: !!auth.orgId, queryFn: async () => { const { data, error } = await supabase.rpc('mi_autoridad_calidad'); if (error) throw error; return data as unknown as AutoridadCalidad; } });
  const personas = useQuery({ queryKey: ['autoridad-personas', auth.orgId], enabled: !!auth.orgId, queryFn: async () => { const { data: org } = await supabase.rpc('get_user_org_id'); if (!org) return []; const { data, error } = await supabase.from('org_members').select('user_id').eq('org_id', org); if (error) throw error; const ids = (data ?? []).map(m => m.user_id); if (!ids.length) return []; const { data: profiles, error: pe } = await supabase.from('profiles').select('id,nombre,cargo').in('id', ids).eq('activo', true); if (pe) throw pe; return profiles ?? []; } });
  const editable = auth.hasRole('admin') && !auth.isSuperAdmin(); const actual = modo ?? q.data?.modo ?? 'con_ac'; const elegidos = ids ?? q.data?.autorizadores ?? [];
  return <Card><CardHeader><CardTitle className="text-base">Autoridad de calidad</CardTitle></CardHeader><CardContent className="space-y-3">
    {q.error && <p role="alert" className="text-destructive">{errorSuplencia(q.error)}</p>}
    <Label htmlFor="autoridad-modo">Modelo vigente · versión {q.data?.version ?? 0}</Label><Select disabled={!editable || q.isLoading} value={actual} onValueChange={setModo}><SelectTrigger id="autoridad-modo"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(MODOS_CALIDAD).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
    {actual === 'designado' && <div className="space-y-2">{personas.data?.map(p => <Label key={p.id} className="flex gap-2 items-center"><Checkbox disabled={!editable} checked={elegidos.includes(p.id)} onCheckedChange={v => setIds(v ? [...elegidos, p.id] : elegidos.filter(x => x !== p.id))}/>{p.nombre} · {p.cargo || 'Sin cargo en el perfil'}</Label>)}</div>}
    {editable && <><Label htmlFor="autoridad-motivo">Motivo obligatorio</Label><Textarea id="autoridad-motivo" value={motivo} onChange={e => setMotivo(e.target.value)}/><Button disabled={busy || motivo.trim().length < 5} onClick={async () => { setBusy(true); try { const { error } = await supabase.rpc('guardar_autoridad_calidad', { _modo: actual, _autorizadores: elegidos, _motivo: motivo }); if (error) throw error; await qc.invalidateQueries({ queryKey: ['autoridad-calidad'] }); await qc.invalidateQueries({ queryKey: ['k3b-autoriza'] }); setModo(undefined); setIds(undefined); setMotivo(''); toast.success('Autoridad de calidad guardada'); } catch(e) { toast.error(errorSuplencia(e)); } finally { setBusy(false); } }}>Guardar autoridad de calidad</Button></>}
  </CardContent></Card>;
}