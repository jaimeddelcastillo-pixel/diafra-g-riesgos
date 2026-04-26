// supabase/functions/customer-portal/index.ts
// Crea una sesión de Stripe Customer Portal para que el admin
// gestione su suscripción (cambiar plan, cancelar, ver facturas, métodos de pago).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe no configurado" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Token inválido" }, 401);
    const userId = claimsData.claims.sub as string;
    const email = claimsData.claims.email as string | undefined;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validar admin de la org
    const { data: member } = await admin
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!member?.org_id) return json({ error: "Usuario sin organización" }, 400);
    if (member.role !== "admin" && member.role !== "super_admin") {
      return json({ error: "Solo administradores pueden gestionar la suscripción" }, 403);
    }

    const { data: org } = await admin
      .from("organizations")
      .select("id, nombre, stripe_customer_id")
      .eq("id", member.org_id)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    let customerId = org?.stripe_customer_id ?? null;
    if (!customerId) {
      // Intentar localizar por email (caso: admin compró desde otro flujo)
      if (email) {
        const found = await stripe.customers.list({ email, limit: 1 });
        if (found.data.length > 0) customerId = found.data[0].id;
      }
      if (!customerId) {
        return json({ error: "No tienes una suscripción activa para gestionar" }, 400);
      }
      await admin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", member.org_id);
    }

    const appUrl = Deno.env.get("APP_URL") || "https://tracea.com.mx";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/configuracion`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("customer-portal error", err);
    return json({ error: (err as Error).message }, 500);
  }
});