import { createClient } from 'npm:@supabase/supabase-js@2.100.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.100.0/cors';
import { Packer } from 'docx';
import { construirContexto, construirWordReporte, type Logo, type Reporte } from './word.ts';

import { charts } from './charts.ts';

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(x => x.toString(16).padStart(2, '0')).join('');
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ error: 'Solo POST' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key || !service) throw new Error('Configuración no disponible');
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return response({ error: 'Sesión requerida' }, 401);
    const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
    const { data: user, error: authError } = await client.auth.getUser();
    if (authError || !user.user) return response({ error: 'Sesión inválida' }, 401);
    const { id } = await req.json();
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) return response({ error: 'Reporte inválido' }, 400);
    const { data: reservation, error } = await client.rpc('preparar_emision_kpi_word', { _id: id });
    if (error) throw error;
    if (reservation.emitido) return response({ folio: reservation.reporte.formato_snapshot.folio });
    const admin = createClient(url, service);
    // An expiring server lease prevents simultaneous requests from generating two originals.
    const { data: claimed, error: claimError } = await admin.rpc('reclamar_emision_kpi_word', { _id: id, _token: reservation.token });
    if (claimError) throw claimError;
    if (!claimed) return response({ error: 'Emisión en curso; vuelve a consultar el reporte' }, 409);
    let logo: Logo | null = reservation.logo ?? null;
    const r = reservation.reporte as Reporte;
    if (!r.formato_snapshot || !r.firmantes || !r.datos_snapshot) throw new Error('Falta el snapshot de emisión');
    const snapshot = r.formato_snapshot as typeof r.formato_snapshot & { empresa: string; logo_origen: string | null };
    const existing = await admin.storage.from('documentos-generados').download(reservation.path);
    let content: Uint8Array;
    if (existing.data) {
      content = new Uint8Array(await existing.data.arrayBuffer());
      const { data: saved, error: readError } = await admin.from('kpi_reportes').select('emision_preparada').eq('id', id).single();
      if (readError) throw readError;
      logo = saved.emision_preparada.logo ?? null;
    } else {
      if (!Object.prototype.hasOwnProperty.call(reservation, 'logo')) {
        const origin = snapshot.logo_origen;
        if (origin) {
          // Only org-logos paths on this backend are fetched: no arbitrary URL/SSRF.
          const prefix = `${url}/storage/v1/object/public/org-logos/`;
          const path = origin.startsWith(prefix) ? decodeURIComponent(origin.slice(prefix.length)) : origin;
          if (/^https?:/i.test(path) || !path.startsWith(reservation.org_id + '/')) throw new Error('Ruta del logo fuera de la empresa');
          const { data: image, error: imageError } = await admin.storage.from('org-logos').download(path);
          if (imageError || !image) throw new Error('No se pudo congelar el logo de la empresa');
          if (!['image/png', 'image/jpeg'].includes(image.type)) throw new Error('El logo debe ser PNG o JPEG');
          const b = new Uint8Array(await image.arrayBuffer());
          let binary = ''; for (const byte of b) binary += String.fromCharCode(byte);
          logo = { dataUrl: `data:${image.type};base64,${btoa(binary)}`, format: image.type === 'image/png' ? 'PNG' : 'JPEG' };
        }
        const { error: freezeError } = await admin.rpc('congelar_logo_kpi_word', { _id: id, _token: reservation.token, _logo: logo });
        if (freezeError) throw freezeError;
      }
      const ctx = construirContexto('indicadores.reporte_word', snapshot, { empresa: snapshot.empresa, generadoPor: r.firmantes.autorizo?.nombre ?? '', logo });
      content = new Uint8Array(await Packer.toBuffer(construirWordReporte({ ctx, reporte: r, resumen: r.datos_snapshot, firmantes: r.firmantes, graficas: charts(r), graficasSvg: true, borrador: false })));
      const { error: uploadError } = await admin.storage.from('documentos-generados').upload(reservation.path, content, { upsert: false, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      if (uploadError) throw uploadError;
    }
    const { data: done, error: confirmError } = await admin.rpc('confirmar_emision_kpi_word', { _id: id, _token: reservation.token, _logo: logo, _sha256: await hash(content) });
    if (confirmError) throw confirmError;
    return response({ folio: done.folio });
  } catch (e) {
    return response({ error: (e as Error).message ?? 'No se pudo emitir el reporte' }, 400);
  }
});