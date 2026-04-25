import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

// Mapa de Price IDs → producto interno
const PRICE_TO_PRODUCT: Record<string, string> = {
  price_1TQ7jKKfwzAg4OKvxoc4fDOi: "starter",
  price_1TQ7jFKfwzAg4OKv51yn1CmC: "professional",
  price_1TQ7jKKfwzAg4OKvjXcDjzgn: "enterprise",
  price_1TQ7kVKfwzAg4OKvjU9mVaun: "curso",
  price_1TQ7lbKfwzAg4OKvwQwizz4f: "protocolos",
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 5,
  professional: 25,
  enterprise: 9999,
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    console.error("Stripe no configurado: faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET");
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature error", err);
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        const priceId = session.metadata?.price_id;
        const producto = priceId ? PRICE_TO_PRODUCT[priceId] : session.metadata?.producto;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

        if (!orgId) {
          console.warn("checkout.session.completed sin org_id en metadata");
          break;
        }

        if (session.mode === "subscription" && producto && PLAN_LIMITS[producto]) {
          // Activar plan
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

          await supabase
            .from("organizations")
            .update({
              plan: producto,
              subscription_status: "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subId,
              max_users: PLAN_LIMITS[producto],
              cancelled_at: null,
            })
            .eq("id", orgId);
        } else if (session.mode === "payment" && producto) {
          // Registrar addon
          await supabase.from("addon_purchases").insert({
            org_id: orgId,
            producto,
            stripe_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
            monto_usd: (session.amount_total ?? 0) / 100,
            metadata: { price_id: priceId },
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = sub.items.data[0]?.price.id;
        const producto = priceId ? PRICE_TO_PRODUCT[priceId] : null;

        const updates: Record<string, unknown> = {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          subscription_current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        };
        if (producto && PLAN_LIMITS[producto]) {
          updates.plan = producto;
          updates.max_users = PLAN_LIMITS[producto];
        }
        if (sub.cancel_at_period_end) {
          updates.cancelled_at = new Date().toISOString();
        } else {
          updates.cancelled_at = null;
        }

        await supabase
          .from("organizations")
          .update(updates)
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await supabase
          .from("organizations")
          .update({
            subscription_status: "canceled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const { data: org } = await supabase
          .from("organizations")
          .select("id, plan")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (!org) break;

        await supabase.from("payment_history").insert({
          org_id: org.id,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id: typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id ?? null,
          monto_usd: (invoice.amount_paid ?? 0) / 100,
          concepto: invoice.lines.data[0]?.description || `Suscripción ${org.plan}`,
          status: "paid",
          invoice_pdf_url: invoice.invoice_pdf,
          hosted_invoice_url: invoice.hosted_invoice_url,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        await supabase
          .from("organizations")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        // ignorar
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook handler error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});