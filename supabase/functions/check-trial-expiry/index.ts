// Cron diario: detecta organizaciones con plan='curso' cuyo periodo de cortesía
// (created_at + 30 días) vence en 7, 3 o 1 día y envía el correo trial-por-vencer.
// Idempotencia: idempotencyKey incluye org_id + dia_aviso, garantizando un solo
// envío por umbral aunque el cron corra varias veces.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://tracea.com.mx";
const TRIAL_DAYS = 30;
const AVISO_DIAS = [7, 3, 1] as const;

function diasEntre(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ahora = new Date();
  const enviados: Array<Record<string, unknown>> = [];
  const errores: Array<Record<string, unknown>> = [];

  // Buscar organizaciones en periodo de cortesía (plan='curso', activas)
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, nombre, plan, estado, created_at")
    .eq("plan", "curso")
    .eq("estado", "activo");

  if (error) {
    console.error("check-trial-expiry: error consultando orgs", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const org of orgs ?? []) {
    const createdAt = new Date(org.created_at as string);
    const fechaFin = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const dias = diasEntre(ahora, fechaFin);
    if (!AVISO_DIAS.includes(dias as 7 | 3 | 1)) continue;

    // Resolver admin de la organización
    const { data: adminMember } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", org.id)
      .in("role", ["admin", "super_admin"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!adminMember?.user_id) continue;

    const { data: perfil } = await supabase
      .from("profiles")
      .select("email, nombre")
      .eq("id", adminMember.user_id)
      .maybeSingle();

    if (!perfil?.email) continue;

    try {
      const { error: invokeErr } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "trial-por-vencer",
            recipientEmail: perfil.email,
            idempotencyKey: `trial-${org.id}-d${dias}`,
            templateData: {
              nombre: perfil.nombre,
              organizacion: org.nombre,
              dias_restantes: dias,
              fecha_fin: fechaFin.toISOString().slice(0, 10),
              link: `${APP_URL}/precios`,
            },
          },
        },
      );

      if (invokeErr) {
        errores.push({ org_id: org.id, dias, error: invokeErr.message });
      } else {
        enviados.push({ org_id: org.id, email: perfil.email, dias });
      }
    } catch (err) {
      errores.push({ org_id: org.id, dias, error: (err as Error).message });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      total_evaluadas: orgs?.length ?? 0,
      enviados: enviados.length,
      errores: errores.length,
      detalle: { enviados, errores },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});