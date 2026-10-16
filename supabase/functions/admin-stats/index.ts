// supabase/functions/admin-stats/index.ts
// Métricas globales para el panel super_admin de TRACEA.
// Corre con service role — bypasea RLS para consultar todas las orgs.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Verificación de firma con el cliente oficial (soporta las claves de firma actuales).
async function verifyAccessToken(token: string, supabaseUrl: string) {
  const client = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims) throw error ?? new Error("Token inválido");
  return data.claims as { sub?: unknown };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verificar JWT por firma y luego autorizar por rol
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let userId: string;
  try {
    const payload = await verifyAccessToken(token, supabaseUrl);
    if (typeof payload.sub !== "string") {
      return json({ error: "No autorizado" }, 401);
    }
    userId = payload.sub;
  } catch (error) {
    console.error("jwtVerify error:", error);
    return json({ error: "No autorizado" }, 401);
  }

  const { data: saCheck } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!saCheck) return json({ error: "Se requiere rol super_admin" }, 403);

  // Obtener org_id desde query param o body
  const url = new URL(req.url);
  let filterOrgId = url.searchParams.get("org_id") ?? null;
  if (!filterOrgId && req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      filterOrgId = body?.org_id ?? null;
    } catch { /* sin body */ }
  }

  try {
    // ── Organizaciones ──────────────────────────────────────────────────────────
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, nombre, slug, plan, activo, max_users, trial_expires_at, created_at, estado, pending_price_id")
      .order("nombre");

    const orgIds = (orgs ?? []).map((o: any) => o.id);

    // ── Miembros por org ────────────────────────────────────────────────────────
    const { data: members } = await admin
      .from("org_members")
      .select("org_id, user_id, role")
      .in("org_id", orgIds);

    const membersByOrg = new Map<string, number>();
    for (const m of members ?? []) {
      membersByOrg.set(m.org_id, (membersByOrg.get(m.org_id) ?? 0) + 1);
    }

    // ── Folios por org ──────────────────────────────────────────────────────────
    const { data: folios } = await admin
      .from("folios")
      .select("id, org_id, estado, created_at, updated_at")
      .in("org_id", orgIds);

    const foliosByOrg = new Map<string, any[]>();
    for (const f of folios ?? []) {
      if (!foliosByOrg.has(f.org_id)) foliosByOrg.set(f.org_id, []);
      foliosByOrg.get(f.org_id)!.push(f);
    }

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const hace7dias = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const hace30dias = new Date(Date.now() - 30 * 86_400_000).toISOString();

    // ── Construir array de orgs enriquecidas ────────────────────────────────────
    const orgsEnriquecidas = (orgs ?? []).map((org: any) => {
      const orgFolios = foliosByOrg.get(org.id) ?? [];
      const ultimoFolio = orgFolios.reduce((max: string | null, f: any) =>
        !max || f.updated_at > max ? f.updated_at : max, null);

      const foliosPorEstado = {
        borrador: orgFolios.filter((f: any) => f.estado === "Borrador").length,
        en_firma: orgFolios.filter((f: any) => f.estado === "En Firma").length,
        aprobado: orgFolios.filter((f: any) => f.estado === "Aprobado").length,
        cerrado: orgFolios.filter((f: any) => f.estado === "Cerrado").length,
      };

      return {
        ...org,
        user_count: membersByOrg.get(org.id) ?? 0,
        folio_count: orgFolios.length,
        folios_mes: orgFolios.filter((f: any) => f.created_at >= inicioMes).length,
        ultimo_folio_at: ultimoFolio,
        folios_por_estado: foliosPorEstado,
        usuarios: (members ?? [])
          .filter((m: any) => m.org_id === org.id)
          .map((m: any) => ({ user_id: m.user_id, role: m.role })),
      };
    });

    // Si se pidió una org específica, devolver solo esa
    if (filterOrgId) {
      const orgDetail = orgsEnriquecidas.find((o: any) => o.id === filterOrgId);
      if (!orgDetail) return json({ error: "Organización no encontrada" }, 404);

      // Enriquecer con perfiles de usuarios
      const userIds = orgDetail.usuarios.map((u: any) => u.user_id);
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, nombre, email, cargo")
        .in("id", userIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const usuariosDetalle = orgDetail.usuarios.map((u: any) => ({
        ...profileMap.get(u.user_id),
        role: u.role,
      }));

      const foliosDetalle = (foliosByOrg.get(filterOrgId) ?? [])
        .sort((a: any, b: any) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 20);

      return json({ org: { ...orgDetail, usuarios: usuariosDetalle, folios: foliosDetalle } });
    }

    // ── Métricas globales ───────────────────────────────────────────────────────
    const metrics = {
      orgs_activas: orgsEnriquecidas.filter((o: any) => o.activo).length,
      orgs_trial: orgsEnriquecidas.filter((o: any) => o.plan === "trial").length,
      usuarios_totales: (members ?? []).length,
      folios_mes: (folios ?? []).filter((f: any) => f.created_at >= inicioMes).length,
    };

    // ── Alertas ─────────────────────────────────────────────────────────────────
    const alertas = {
      trials_por_vencer: orgsEnriquecidas.filter((o: any) =>
        o.plan === "trial" &&
        o.activo &&
        o.trial_expires_at !== null &&
        o.trial_expires_at > now.toISOString() &&
        o.trial_expires_at <= hace7dias
      ).sort((a: any, b: any) => a.trial_expires_at.localeCompare(b.trial_expires_at)),

      sin_actividad: orgsEnriquecidas.filter((o: any) =>
        o.activo && (o.ultimo_folio_at === null || o.ultimo_folio_at < hace30dias)
      ),
    };

    return json({ metrics, orgs: orgsEnriquecidas, alertas });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
