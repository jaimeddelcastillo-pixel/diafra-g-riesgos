import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorAutenticacionEs } from '@/components/ui/password-utils';
export function CambioTemporal() {
  const auth = useAuth(); const [actual, setActual] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <main className="min-h-screen flex items-center justify-center bg-background p-4"><form className="w-full max-w-sm space-y-4" onSubmit={async e => { e.preventDefault(); if (password !== confirm) { setError('Las contraseñas no coinciden'); return; } setBusy(true); setError(''); try { const { data, error } = await supabase.functions.invoke('cambiar-password-temporal', { body: { current_password: actual, password } }); if (error || data?.error) throw new Error(data?.error ?? error?.message); await auth.refreshOrg(); } catch(e) { setError(errorAutenticacionEs((e as Error).message)); } finally { setBusy(false); } }}>
    <h1 className="text-xl font-semibold">Cambia tu contraseña temporal</h1>
    <div><Label htmlFor="current-password">Contraseña actual</Label><Input id="current-password" type="password" autoComplete="current-password" required value={actual} onChange={e => setActual(e.target.value)}/></div>
    <div><Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)}/></div>
    <div><Label htmlFor="confirm-password">Confirmar contraseña</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)}/></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy || !actual || !password || password !== confirm} className="w-full">Guardar nueva contraseña</Button><Button type="button" variant="outline" className="w-full" onClick={auth.signOut}>Cerrar sesión</Button>
  </form></main>;
}