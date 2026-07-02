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
  // Planes (suscripciones anuales)
  price_1TomoLKfwzAg4OKvmI0g6yJ4: { mode: "subscription", producto: "starter" },
  price_1TomrAKfwzAg4OKvbEgQq9f3: { mode: "subscription", producto: "professional" },
  price_1TompOKfwzAg4OKvr8GGv5XJ: { mode: "subscription", producto: "enterprise" },
  // Addons (pago único)
  price_1TQ7kVKfwzAg4OKvjU9mVaun: { mode: "payment", producto: "curso" },
  price_1TQ7lbKfwzAg4OKvwQwizz4f: { mode: "payment", producto: "protocolos" },
  price_1TbRUHKfwzAg4OKvWE8uMR6y: { mode: "payment", producto: "dc3_extra" },
  // Pack de 100 consultas IA — reemplazar por el Price ID real cuando se cree en Stripe
  price_1Teja1KfwzAg4OKvi5O0sjgh: { mode: "payment", producto: "consultas_ia_100" },
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
    const requestedQty = Math.max(1, Math.min(100, Number(body.quantity) || 1));
    const action = String(body.action || "checkout"); // "checkout" | "change_plan"
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
      .select("id, nombre, stripe_customer_id, stripe_subscription_id, subscription_status, plan")
      .eq("id", member.org_id)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Cambio de plan en suscripción ya activa (upgrade/downgrade con proration automática).
    if (
      action === "change_plan" &&
      config.mode === "subscription" &&
      org?.stripe_subscription_id &&
      ["active", "trialing", "past_due"].includes(String((org as any).subscription_status ?? ""))
    ) {
      try {
        const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        const currentItem = sub.items.data[0];
        if (!currentItem) throw new Error("La suscripción no tiene items.");
        if (currentItem.price.id === priceId) {
          return new Response(
            JSON.stringify({ error: "Ya estás suscrito a ese plan." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        await stripe.subscriptions.update(org.stripe_subscription_id, {
          items: [{ id: currentItem.id, price: priceId }],
          proration_behavior: "create_prorations",
          metadata: {
            org_id: member.org_id,
            producto: config.producto,
          },
        });
        // El webhook customer.subscription.updated actualizará plan/max_users.
        return new Response(
          JSON.stringify({
            ok: true,
            changed: true,
            url: `${Deno.env.get("APP_URL") || "https://tracea.com.mx"}/checkout/success?change=1`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err) {
        console.error("change_plan error", err);
        return new Response(
          JSON.stringify({ error: `No se pudo cambiar de plan: ${(err as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

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
      line_items: [
        config.producto === "dc3_extra"
          ? {
              price: priceId,
              quantity: requestedQty,
              adjustable_quantity: { enabled: true, minimum: 1, maximum: 100 },
            }
          : { price: priceId, quantity: 1 },
      ],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/planes?cancelled=1`,
      allow_promotion_codes: true,
      // OXXO solo está disponible para pagos únicos (no suscripciones).
      payment_method_types:
        config.mode === "payment" ? ["card", "oxxo"] : ["card"],
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