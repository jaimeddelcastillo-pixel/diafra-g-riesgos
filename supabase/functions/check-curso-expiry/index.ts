import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://tracea.com.mx";

async function getOrgAdminContact(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
) {
  const { data: org } = await supabase
    .from("organizations")
    .select("nombre")
    .eq("id", orgId)
    .maybeSingle();

  const { data: adminMember } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .in("role", ["admin", "super_admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!adminMember?.user_id) {
    return { email: null, nombre: null, org_nombre: (org as any)?.nombre ?? null };
  }
  const { data: perfil } = await supabase
    .from("profiles")
    .select("email, nombre")
    .eq("id", adminMember.user_id)
    .maybeSingle();
  return {
    email: (perfil as any)?.email ?? null,
    nombre: (perfil as any)?.nombre ?? null,
    org_nombre: (org as any)?.nombre ?? null,
  };
}

async function sendTplEmail(
  supabase: ReturnType<typeof createClient>,
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
) {
  try {
    const { error } = await enviarYRegistrar({ templateName, recipientEmail, idempotencyKey, templateData });
    if (error) console.warn(`send-transactional-email[${templateName}] error`, error);
  } catch (err) {
    console.warn(`send-transactional-email[${templateName}] threw`, err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ahora = new Date();
  const en5dias = new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000);
  let avisos = 0;
  let suspendidos = 0;

  try {
    // 1) Aviso día 25: cursos que vencen en <=5 días y aún no se ha enviado el aviso
    const { data: porVencer } = await supabase
      .from("organizations")
      .select("id, nombre, curso_expira_en, stripe_subscription_id, subscription_status")
      .eq("tiene_curso_pagado", true)
      .is("curso_aviso_5d_enviado_at", null)
      .lte("curso_expira_en", en5dias.toISOString())
      .gt("curso_expira_en", ahora.toISOString());

    for (const org of porVencer ?? []) {
      const tieneSubActiva =
        !!(org as any).stripe_subscription_id &&
        ["active", "trialing"].includes((org as any).subscription_status ?? "");
      if (tieneSubActiva) continue; // no hace falta avisar

      const contact = await getOrgAdminContact(supabase, (org as any).id);
      if (contact.email) {
        await sendTplEmail(
          supabase,
          "trial-por-vencer",
          contact.email,
          {
            nombre: contact.nombre,
            organizacion: contact.org_nombre,
            dias_restantes: 5,
            fecha_vencimiento: new Date((org as any).curso_expira_en).toLocaleDateString(
              "es-MX",
              { day: "2-digit", month: "long", year: "numeric" },
            ),
            link: `${APP_URL}/precios`,
          },
          `curso-aviso-5d-${(org as any).id}-${(org as any).curso_expira_en}`,
        );
      }
      await supabase
        .from("organizations")
        .update({ curso_aviso_5d_enviado_at: ahora.toISOString() })
        .eq("id", (org as any).id);
      avisos++;
    }

    // 2) Día 30: vencidos sin suscripción activa → suspender acceso a plataforma
    //    DC-3 y descargas permanecen en sus buckets (no se borran).
    const { data: vencidos } = await supabase
      .from("organizations")
      .select("id, stripe_subscription_id, subscription_status, plan")
      .eq("tiene_curso_pagado", true)
      .lt("curso_expira_en", ahora.toISOString());

    for (const org of vencidos ?? []) {
      const tieneSubActiva =
        !!(org as any).stripe_subscription_id &&
        ["active", "trialing"].includes((org as any).subscription_status ?? "");
      if (tieneSubActiva) {
        // Tiene plan pagado: solo limpiar bandera de curso
        await supabase
          .from("organizations")
          .update({ tiene_curso_pagado: false })
          .eq("id", (org as any).id);
        continue;
      }
      await supabase
        .from("organizations")
        .update({
          tiene_curso_pagado: false,
          estado: "suspendido",
        })
        .eq("id", (org as any).id);
      suspendidos++;
    }

    return new Response(
      JSON.stringify({ ok: true, avisos, suspendidos }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("check-curso-expiry error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});