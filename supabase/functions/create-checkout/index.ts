import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mapa de Price IDs autorizados → tipo (suscripción o pago único)
const PRICE_CATALOG: Record<string, { mode: "subscription" | "payment"; producto: string }> = {
  // Planes (suscripciones mensuales)
  price_1TQ7jKKfwzAg4OKvxoc4fDOi: { mode: "subscription", producto: "starter" },
  price_1TQ7jFKfwzAg4OKv51yn1CmC: { mode: "subscription", producto: "professional" },
  price_1TQ7jKKfwzAg4OKvjXcDjzgn: { mode: "subscription", producto: "enterprise" },
  // Addons (pago único)
  price_1TQ7kVKfwzAg4OKvjU9mVaun: { mode: "payment", producto: "curso" },
  price_1TQ7lbKfwzAg4OKvwQwizz4f: { mode: "payment", producto: "protocolos" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe no configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const email = claimsData.claims.email as string | undefined;

    const body = await req.json().catch(() => ({}));
    const priceId = String(body.priceId || "");
    const config = PRICE_CATALOG[priceId];
    if (!config) {
      return new Response(JSON.stringify({ error: "Price ID no autorizado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obtener org del usuario
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: member } = await admin
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!member?.org_id) {
      return new Response(
        JSON.stringify({ error: "Usuario sin organización" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (member.role !== "admin" && member.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Solo administradores pueden comprar" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: org } = await admin
      .from("organizations")
      .select("id, nombre, stripe_customer_id")
      .eq("id", member.org_id)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Reutilizar customer si existe; si no, crearlo
    let customerId = org?.stripe_customer_id ?? null;
    if (!customerId) {
      // Buscar por email primero
      if (email) {
        const found = await stripe.customers.list({ email, limit: 1 });
        if (found.data.length > 0) customerId = found.data[0].id;
      }
      if (!customerId) {
        const created = await stripe.customers.create({
          email,
          name: org?.nombre,
          metadata: { org_id: member.org_id, user_id: userId },
        });
        customerId = created.id;
      }
      await admin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", member.org_id);
    }

    const appUrl = Deno.env.get("APP_URL") || "https://tracea.com.mx";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: config.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/planes?cancelled=1`,
      allow_promotion_codes: true,
      metadata: {
        org_id: member.org_id,
        user_id: userId,
        producto: config.producto,
        price_id: priceId,
      },
      ...(config.mode === "subscription"
        ? {
            subscription_data: {
              metadata: {
                org_id: member.org_id,
                producto: config.producto,
              },
            },
          }
        : {}),
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});