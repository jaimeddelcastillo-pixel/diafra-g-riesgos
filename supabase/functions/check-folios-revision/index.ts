// Cron diario: detecta folios Cerrado con updated_at anterior al corte de 12 meses
// y notifica al Responsable Sanitario para revisión periódica (NOM-241 §6.5 / ISO 14971 §10).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://tracea.com.mx";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Shared with the Inicio card; preserves the original UTC setMonth overflow.
  const { data: fechaCorte, error: corteError } = await admin.rpc("folios_revision_corte");
  if (corteError || !fechaCorte) {
    return new Response(JSON.stringify({ error: corteError?.message ?? "No se pudo calcular la fecha de corte" }), {
      status: 500, headers: corsHeaders,
    });
  }

  const { data: folios, error } = await admin
    .from("folios")
    .select("id, codigo, proceso_equipo, org_id, updated_at, norma_folio")
    .eq("estado", "Cerrado")
    .lt("updated_at", fechaCorte);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let notificados = 0;

  for (const folio of folios ?? []) {
    // ¿Ya notificamos en los últimos 30 días?
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);

    const { data: yaNotif } = await admin
      .from("audit_trail")
      .select("id")
      .eq("tabla", "folios")
      .eq("registro_id", folio.id)
      .eq("accion", "REVISION_12M_NOTIFICADA")
      .gt("created_at", hace30.toISOString())
      .limit(1);
    if (yaNotif && yaNotif.length > 0) continue;

    // RS de la organización
    const { data: rsRoles } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", folio.org_id)
      .eq("role", "responsable_sanitario");

    const { data: org } = await admin
      .from("organizations")
      .select("nombre")
      .eq("id", folio.org_id)
      .maybeSingle();

    const mesesTranscurridos = Math.floor(
      (Date.now() - new Date(folio.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30),
    );

    for (const rs of rsRoles ?? []) {
      const { data: perfil } = await admin
        .from("profiles")
        .select("email, nombre")
        .eq("id", rs.user_id)
        .maybeSingle();
      if (!perfil?.email) continue;

      await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "folio-revision-pendiente",
          recipientEmail: perfil.email,
          idempotencyKey: `folio-revision-${folio.id}-${new Date().toISOString().slice(0, 7)}`,
          templateData: {
            nombre: perfil.nombre,
            folio_codigo: folio.codigo,
            proceso: folio.proceso_equipo,
            organizacion: org?.nombre ?? "TRACEA",
            meses: mesesTranscurridos,
            norma_nombre: folio.norma_folio ?? "NOM-241",
            link: `${APP_URL}/folios/${folio.id}`,
          },
        },
      });
      notificados++;
    }

    // Registrar evento para no repetir
    await admin.from("audit_trail").insert({
      tabla: "folios",
      registro_id: folio.id,
      org_id: folio.org_id,
      accion: "REVISION_12M_NOTIFICADA",
      valor_nuevo: { meses: mesesTranscurridos, fecha_corte: new Date().toISOString() },
    });
  }

  return new Response(
    JSON.stringify({ revisados: folios?.length ?? 0, notificados }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});