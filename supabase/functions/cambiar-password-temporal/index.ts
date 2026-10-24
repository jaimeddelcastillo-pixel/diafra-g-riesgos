import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async req => {
  const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return response({ error: 'Método no permitido' }, 405);
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !key) return response({ error: 'Servicio no disponible' }, 503);
  const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } });
  const { data: { user }, error: ue } = await client.auth.getUser(); if (ue || !user) return response({ error: 'Inicia sesión de nuevo' }, 401);
  const body = await req.json().catch(() => null);
  if (typeof body?.password !== 'string' || typeof body?.current_password !== 'string' || !body.password || body.password === body.current_password) return response({ error: 'La nueva contraseña debe ser diferente a la actual' }, 400);
  const { error } = await client.auth.updateUser({ password: body.password, current_password: body.current_password });
  if (error) return response({ error: error.message }, 400);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { error: ae } = await admin.rpc('confirmar_password_temporal', { _usuario: user.id });
  if (ae) return response({ error: 'La contraseña cambió, pero no se pudo habilitar el acceso. Vuelve a intentar con la nueva contraseña.' }, 500);
  return response({ success: true });
});