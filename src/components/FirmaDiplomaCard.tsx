import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { errorSuplencia } from '@/lib/suplencias';
export function FirmaDiplomaCard({ cursoId }: { cursoId: string }) {
  const auth = useAuth(); const qc = useQueryClient(); const [firma, setFirma] = useState<string>(); const [nombre, setNombre] = useState<string>(); const [cargo, setCargo] = useState<string>(); const [instructor, setInstructor] = useState<string>(); const [motivo, setMotivo] = useState(''); const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['firma-diploma', cursoId], queryFn: async () => { const { data, error } = await supabase.from('curso_diploma_config').select('*').eq('curso_id', cursoId).order('version', { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data; } });
  const personas = useQuery({ queryKey: ['instructores-diploma'], enabled: auth.isSuperAdmin(), queryFn: async () => { const { data, error } = await supabase.from('profiles').select('id,nombre,email').eq('activo', true).order('nombre'); if (error) throw error; return data ?? []; } });
  const editable = auth.isSuperAdmin() || (!!auth.user && q.data?.instructor_user_id === auth.user.id);
  const image = firma ?? q.data?.firma_png; const name = nombre ?? q.data?.instructor_nombre ?? ''; const position = cargo ?? q.data?.instructor_cargo ?? ''; const userId = instructor ?? q.data?.instructor_user_id ?? '';
  return <Card><CardHeader><CardTitle className="text-base">Firma del instructor · diploma</CardTitle></CardHeader><CardContent className="space-y-3">
    {q.error && <p role="alert" className="text-destructive">{errorSuplencia(q.error)}</p>}
    {image && <img src={image} alt="Firma del instructor" className="h-24 w-52 object-contain"/>}
    {auth.isSuperAdmin() && <><Label htmlFor="firma-instructor">Cuenta del instructor</Label><Select value={userId || 'sin-cuenta'} onValueChange={v => setInstructor(v === 'sin-cuenta' ? '' : v)}><SelectTrigger id="firma-instructor"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="sin-cuenta">Sin cuenta asignada</SelectItem>{personas.data?.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre || p.email}</SelectItem>)}</SelectContent></Select></>}
    <Label htmlFor="firma-nombre">Nombre del instructor</Label><Input id="firma-nombre" disabled={!editable} value={name} onChange={e => setNombre(e.target.value)}/>
    <Label htmlFor="firma-cargo">Cargo del instructor</Label><Input id="firma-cargo" disabled={!editable} value={position} onChange={e => setCargo(e.target.value)}/>
    {editable && <><Label htmlFor="firma-png">Firma PNG</Label><Input id="firma-png" type="file" accept="image/png" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.type !== 'image/png' || file.size > 1000000) { toast.error('Selecciona un PNG de hasta 1 MB'); return; } const reader = new FileReader(); reader.onload = () => setFirma(String(reader.result)); reader.readAsDataURL(file); }}/><Label htmlFor="firma-motivo">Motivo obligatorio</Label><Textarea id="firma-motivo" value={motivo} onChange={e => setMotivo(e.target.value)}/><Button disabled={busy || !image || motivo.trim().length < 5} onClick={async () => { if (!image) return; setBusy(true); try { const { error } = await supabase.rpc('guardar_firma_diploma', { _curso: cursoId, _instructor: userId || null, _nombre: name, _cargo: position, _firma: image, _motivo: motivo }); if (error) throw error; await qc.invalidateQueries({ queryKey: ['firma-diploma', cursoId] }); setFirma(undefined); setNombre(undefined); setCargo(undefined); setInstructor(undefined); setMotivo(''); toast.success('Firma del diploma guardada'); } catch(e) { toast.error(errorSuplencia(e)); } finally { setBusy(false); } }}>Guardar firma del diploma</Button></>}
  </CardContent></Card>;
}