import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Send, Check, X, Square } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type Rol = 'admin' | 'responsable_sanitario';
const nombreRol = (r: string) => r === 'admin' ? 'Administrador' : 'Responsable Sanitario';
const fecha = (v: string) => new Date(v).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

export async function listarSuplencias() {
  const { data: org, error: contextoError } = await supabase.rpc('get_user_org_id');
  if (contextoError) throw contextoError;
  if (!org) return [];
  const { data, error } = await supabase.from('org_suplencias').select('*').eq('org_id', org).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function AvisoSuplencia() {
  const auth = useAuth();
  const q = useQuery({ queryKey: ['suplencias', auth.orgId], queryFn: listarSuplencias, enabled: !!auth.orgId, refetchInterval: 15000 });
  const vigentes = (q.data ?? []).filter(s => s.estado === 'activa' && s.aceptada_en && !s.revocada_en && Date.parse(s.fecha_inicio) <= Date.now() && Date.now() < Date.parse(s.fecha_fin));
  if (!vigentes.length) return null;
  return <div className="border-b bg-accent text-accent-foreground px-4 py-2 text-xs">{vigentes.map(s => <span key={s.id} className="mr-4">{nombreRol(s.rol_sustituido)}: {s.suplente_nombre} · por suplencia de {s.titular_nombre ?? s.rs_titular_nombre} · hasta {fecha(s.fecha_fin)}</span>)}</div>;
}

export default function Suplencias() {
  const auth = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['suplencias', auth.orgId], queryFn: listarSuplencias, enabled: !!auth.orgId, refetchInterval: 15000 });
  const members = useQuery({ queryKey: ['suplencia-miembros', auth.orgId], enabled: !!auth.orgId, queryFn: async () => {
    const { data: org, error: ctxError } = await supabase.rpc('get_user_org_id');
    if (ctxError) throw ctxError;
    if (!org) return [];
    const { data, error } = await supabase.from('org_members').select('user_id,role').eq('org_id', org);
    if (error) throw error;
    const ids = (data ?? []).map(m => m.user_id);
    if (!ids.length) return [];
    const { data: perfiles, error: perfilError } = await supabase.from('profiles').select('id,nombre,cargo').in('id', ids).eq('activo', true).order('nombre');
    if (perfilError) throw perfilError;
    return (perfiles ?? []).map(p => ({ ...p, role: data?.find(m => m.user_id === p.id)?.role }));
  }});
  const [rol, setRol] = useState<Rol>('responsable_sanitario');
  const [titular, setTitular] = useState('');
  const [suplente, setSuplente] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [categoria, setCategoria] = useState('vacaciones');
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [terminar, setTerminar] = useState<string | null>(null);
  const [motivoFin, setMotivoFin] = useState('');
  const editable = !auth.isSuperAdmin() && (auth.hasRole('admin') || auth.hasRole('responsable_sanitario'));
  const recargar = async () => {
    await q.refetch();
    await auth.refreshOrg();
    await qc.invalidateQueries();
  };
  const ejecutar = async (accion: () => Promise<void>) => {
    setBusy(true);
    try { await accion(); await recargar(); } catch (e) { toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e)); } finally { setBusy(false); }
  };
  const avisar = async (id?: string) => {
    const { data, error } = await supabase.functions.invoke('tend-aviso-suplencia', { body: id ? { id } : {} });
    if (error || data?.error) throw new Error(data?.error ?? error?.message);
    if (data?.resultados?.some((r: { enviado: boolean }) => !r.enviado)) toast.warning('Hay avisos pendientes o en proceso');
    else toast.success(data?.resultados?.length ? 'Avisos enviados' : 'No hay avisos pendientes');
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link className="text-sm text-muted-foreground underline" to="/configuracion">Configuración</Link><h1 className="text-2xl font-bold">Suplencias</h1></div>{editable && <Button variant="outline" disabled={busy} onClick={() => void ejecutar(() => avisar())}><Send className="mr-2 h-4 w-4"/>Reintentar avisos</Button>}</div>
    {(q.error || members.error) && <p role="alert" className="text-destructive">{q.error?.message ?? members.error?.message}</p>}
    {editable && <form className="grid gap-4 border-b pb-6 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void ejecutar(async () => {
      const { data, error } = await supabase.rpc('designar_suplencia', { _rol: rol, _titular: titular, _suplente: suplente, _inicio: new Date(inicio).toISOString(), _fin: new Date(fin).toISOString(), _categoria: categoria, _motivo: motivo });
      if (error) throw error;
      toast.success('Designación pendiente de aceptación'); setMotivo('');
      await q.refetch();
      try { await avisar(data); } catch { toast.warning('Designación guardada; aviso pendiente'); }
    }); }}>
      <div className="space-y-2"><Label htmlFor="suplencia-rol">Rol sustituido</Label><Select value={rol} onValueChange={v => { setRol(v as Rol); setTitular(''); }}><SelectTrigger id="suplencia-rol"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="responsable_sanitario">Responsable Sanitario</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="suplencia-titular">Titular</Label><Select value={titular} onValueChange={setTitular}><SelectTrigger id="suplencia-titular"><SelectValue placeholder="Seleccionar titular"/></SelectTrigger><SelectContent>{members.data?.filter(p => p.role === rol).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre} · {p.cargo || 'Sin cargo en el perfil'}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="suplencia-persona">Suplente</Label><Select value={suplente} onValueChange={setSuplente}><SelectTrigger id="suplencia-persona"><SelectValue placeholder="Seleccionar usuario"/></SelectTrigger><SelectContent>{members.data?.filter(p => p.id !== titular && p.role !== 'super_admin').map(p => <SelectItem key={p.id} value={p.id}>{p.nombre} · {p.cargo || 'Sin cargo en el perfil'}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="suplencia-categoria">Categoría del motivo</Label><Select value={categoria} onValueChange={setCategoria}><SelectTrigger id="suplencia-categoria"><SelectValue/></SelectTrigger><SelectContent>{['vacaciones','comisión','ausencia','otro'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="suplencia-inicio">Inicio</Label><Input id="suplencia-inicio" type="datetime-local" required value={inicio} onChange={e => setInicio(e.target.value)}/></div>
      <div className="space-y-2"><Label htmlFor="suplencia-fin">Fin</Label><Input id="suplencia-fin" type="datetime-local" required value={fin} onChange={e => setFin(e.target.value)}/></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="suplencia-motivo">Motivo (sin detalle médico)</Label><Textarea id="suplencia-motivo" required value={motivo} onChange={e => setMotivo(e.target.value)}/></div>
      <Button type="submit" disabled={busy || !titular || !suplente || !motivo.trim()}><Save className="mr-2 h-4 w-4"/>Designar suplencia</Button>
    </form>}
    <section className="space-y-4"><h2 className="font-semibold">Designaciones e historial</h2>{q.isLoading ? <p>Cargando…</p> : !q.data?.length ? <p className="text-muted-foreground">Sin suplencias registradas</p> : q.data.map(s => {
      const vencida = !!s.revocada_en || Date.parse(s.fecha_fin) <= Date.now();
      const estado = vencida && ['activa','pendiente de aceptación'].includes(s.estado) ? 'terminada' : s.estado;
      const propia = s.suplente_user_id === auth.user?.id;
      const puedeTerminar = !auth.isSuperAdmin() && (propia || (s.titular_user_id ?? s.rs_titular_user_id) === auth.user?.id || auth.hasRole(s.rol_sustituido === 'admin' ? 'responsable_sanitario' : 'admin'));
      return <div key={s.id} className="space-y-2 border-b pb-4"><div className="flex flex-wrap justify-between gap-2"><strong>{nombreRol(s.rol_sustituido)} · {s.suplente_nombre}</strong><span className="text-sm text-muted-foreground">{estado}</span></div><p className="text-sm">{s.suplente_cargo} · por suplencia de {s.titular_nombre ?? s.rs_titular_nombre}</p><p className="text-sm">{fecha(s.fecha_inicio)} — {fecha(s.fecha_fin)}</p><p className="text-sm">{s.categoria} · {s.motivo}</p>{s.motivo_terminacion && <p className="text-sm">Terminación: {s.motivo_terminacion}</p>}<p className="text-xs text-muted-foreground">Aviso al titular: {s.aviso_rs_enviado_en ? 'Enviado' : s.aviso_rs_requerido ? 'Pendiente' : 'No requerido'} {s.aviso_rs_error}</p><div className="flex flex-wrap gap-2">{propia && !vencida && estado === 'pendiente de aceptación' && !auth.isSuperAdmin() && <>{[true,false].map(aceptar => <Button key={String(aceptar)} variant={aceptar ? 'default' : 'outline'} disabled={busy} onClick={() => void ejecutar(async () => { const { error } = await supabase.rpc('responder_suplencia', { _id: s.id, _aceptar: aceptar }); if (error) throw error; toast.success(aceptar ? 'Suplencia aceptada' : 'Designación rechazada'); })}>{aceptar ? <Check className="mr-2 h-4 w-4"/> : <X className="mr-2 h-4 w-4"/>}{aceptar ? 'Aceptar' : 'Rechazar'}</Button>)}</>}{puedeTerminar && !vencida && ['activa','pendiente de aceptación'].includes(estado) && <Button variant="outline" disabled={busy} onClick={() => { setTerminar(s.id); setMotivoFin(''); }}><Square className="mr-2 h-4 w-4"/>Terminar anticipadamente</Button>}</div></div>;
    })}</section>
    <Dialog open={!!terminar} onOpenChange={open => { if (!open) setTerminar(null); }}><DialogContent><DialogHeader><DialogTitle>Terminar suplencia</DialogTitle></DialogHeader><Label htmlFor="suplencia-motivo-fin">Motivo obligatorio (sin detalle médico)</Label><Textarea id="suplencia-motivo-fin" value={motivoFin} onChange={e => setMotivoFin(e.target.value)}/><DialogFooter><Button variant="outline" onClick={() => setTerminar(null)}>Cancelar</Button><Button disabled={busy || !motivoFin.trim()} onClick={() => { if (!terminar) return; const id = terminar; void ejecutar(async () => { const { error } = await supabase.rpc('terminar_suplencia', { _id: id, _motivo: motivoFin }); if (error) throw error; setTerminar(null); toast.success('Suplencia terminada'); }); }}>Terminar con motivo</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}