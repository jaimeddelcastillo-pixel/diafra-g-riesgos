import { createClient } from 'npm:@supabase/supabase-js@2.100.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.100.0/cors';
import { Packer } from 'docx';
import { construirContexto, construirWordReporte, kpisDelAlcance, etiquetaSub, type Logo, type Reporte } from './word.ts';

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(x => x.toString(16).padStart(2, '0')).join('');
const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] ?? c));

/** Server-rendered editable SVG with a PNG fallback; data and meta come only from the frozen summary. */
function charts(r: Reporte): Record<string, Uint8Array> {
  if (!r.datos_snapshot) throw new Error('Falta el resumen congelado');
  return Object.fromEntries(kpisDelAlcance(r, r.datos_snapshot).filter(k => k.tipo === 'SGC' && k.nivel === 'SGC' && k.subperiodos.length).map(k => {
    const max = Math.max(1, k.meta, ...k.subperiodos.map(s => s.valor ?? 0));
    const y = (v: number) => 940 - v / max * 780;
    const width = 1600 / k.subperiodos.length;
    const bars = k.subperiodos.map((s, j) => `<rect x="${160 + j * width + width * .15}" y="${y(s.valor ?? 0)}" width="${width * .7}" height="${940 - y(s.valor ?? 0)}" fill="${s.semaforo === 'verde' ? '#16a34a' : s.semaforo === 'amarillo' ? '#d97706' : s.semaforo === 'rojo' ? '#dc2626' : '#9ca3af'}"/><text x="${160 + (j + .5) * width}" y="980" text-anchor="middle">${escape(etiquetaSub(k.frecuencia, s.inicio))}</text><text x="${160 + (j + .5) * width}" y="${y(s.valor ?? 0) - 12}" text-anchor="middle">${s.valor ?? '—'}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1890" height="1063" viewBox="0 0 1890 1063"><rect width="1890" height="1063" fill="white"/><g font-family="Calibri,Arial" font-size="30" fill="#1f3a5f"><text x="945" y="65" text-anchor="middle">${escape(k.codigo + ' · ' + k.nombre)}</text><line x1="160" y1="940" x2="1760" y2="940" stroke="#d1d5db"/><line x1="160" y1="${y(k.meta)}" x2="1760" y2="${y(k.meta)}" stroke="#1f3a5f" stroke-dasharray="12 8"/>${bars}<text x="945" y="1040" text-anchor="middle">Meta ${k.meta} ${escape(k.unidad)}</text></g></svg>`;
    return [k.id, new TextEncoder().encode(svg)];
  }));
}

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