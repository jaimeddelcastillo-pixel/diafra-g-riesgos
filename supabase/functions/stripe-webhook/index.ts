import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

// Mapa de Price IDs → producto interno
const PRICE_TO_PRODUCT: Record<string, string> = {
  price_1TQ7jKKfwzAg4OKvxoc4fDOi: "starter",
  price_1TQ7jFKfwzAg4OKv51yn1CmC: "professional",
  price_1TQ7jKKfwzAg4OKvjXcDjzgn: "enterprise",
  price_1TQ7kVKfwzAg4OKvjU9mVaun: "curso",
  price_1TQ7lbKfwzAg4OKvwQwizz4f: "protocolos",
  price_1TbRUHKfwzAg4OKvWE8uMR6y: "dc3_extra",
  price_PENDIENTE_CONSULTAS_IA_100: "consultas_ia_100",
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 3,
  professional: 10,
  enterprise: 9999,
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
  curso: "Curso + DC-3 + 1 Mes TRACEA",
  consultas_ia_100: "Pack 100 consultas IA",
};

const CONSULTAS_POR_PACK: Record<string, number> = {
  consultas_ia_100: 100,
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://tracea.com.mx";

async function sendTplEmail(
  supabase: ReturnType<typeof createClient>,
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
) {
  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: { templateName, recipientEmail, idempotencyKey, templateData },
    });
    if (error) console.warn(`send-transactional-email[${templateName}] error`, error);
  } catch (err) {
    console.warn(`send-transactional-email[${templateName}] threw`, err);
  }
}

async function getOrgContact(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<{ email: string | null; nombre: string | null; org_nombre: string | null }> {
  const { data: org } = await supabase
    .from("organizations")
    .select("nombre")
    .eq("id", orgId)
    .maybeSingle();

  // Buscar al admin de la organización
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
              estado: "activo",
              stripe_customer_id: customerId,
              stripe_subscription_id: subId,
              max_users: PLAN_LIMITS[producto],
              cancelled_at: null,
              pending_price_id: null,
            })
            .eq("id", orgId);

          // Correo bienvenida-org al admin
          const contact = await getOrgContact(supabase, orgId);
          if (contact.email) {
            await sendTplEmail(
              supabase,
              "bienvenida-org",
              contact.email,
              {
                nombre: contact.nombre,
                organizacion: contact.org_nombre,
                plan: producto,
                max_users: PLAN_LIMITS[producto],
                link: `${APP_URL}/login`,
              },
              `bienvenida-org-${orgId}-${producto}`,
            );
          }
        } else if (session.mode === "payment" && producto) {
          // Si la compra única ya pagada incluye el "curso", también activamos
          // la cuenta para que pueda entrar a la plataforma 30 días.
          if (producto === "curso") {
            // Obtener plan actual para no degradar si ya tiene plan pagado
            const { data: orgCurr } = await supabase
              .from("organizations")
              .select("plan, max_users")
              .eq("id", orgId)
              .maybeSingle();

            const planActual = (orgCurr as any)?.plan as string | undefined;
            const maxActual = ((orgCurr as any)?.max_users as number | undefined) ?? 0;
            const debeAplicarStarter =
              !planActual || planActual === "trial" || planActual === "curso";

            const cursoExpiraEn = new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString();

            const updates: Record<string, unknown> = {
              estado: "activo",
              pending_price_id: null,
              tiene_curso_pagado: true,
              curso_expira_en: cursoExpiraEn,
              curso_aviso_5d_enviado_at: null,
              stripe_customer_id: customerId,
            };
            if (debeAplicarStarter) {
              updates.plan = "starter";
              updates.max_users = Math.max(maxActual, 3);
            }

            await supabase
              .from("organizations")
              .update(updates)
              .eq("id", orgId);

            const contact = await getOrgContact(supabase, orgId);
            if (contact.email) {
              await sendTplEmail(
                supabase,
                "bienvenida-org",
                contact.email,
                {
                  nombre: contact.nombre,
                  organizacion: contact.org_nombre,
                  plan: PLAN_LABELS.curso,
                  link: `${APP_URL}/login`,
                },
                `bienvenida-org-${orgId}-curso-${session.id}`,
              );
            }
          }
          // DC-3 adicional: incrementar saldo según cantidad comprada.
          let dc3Qty = 0;
          if (producto === "dc3_extra") {
            try {
              const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
              dc3Qty = li.data.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
            } catch (_e) {
              dc3Qty = 1;
            }
            if (dc3Qty > 0) {
              const { data: orgRow } = await supabase
                .from("organizations")
                .select("dc3_adicionales_disponibles")
                .eq("id", orgId)
                .maybeSingle();
              const saldoActual = ((orgRow as any)?.dc3_adicionales_disponibles as number | undefined) ?? 0;
              await supabase
                .from("organizations")
                .update({ dc3_adicionales_disponibles: saldoActual + dc3Qty })
                .eq("id", orgId);
            }
          }
          // Pack de consultas IA — incrementar saldo de extras (idempotente).
          if (producto && CONSULTAS_POR_PACK[producto]) {
            const cantidad = CONSULTAS_POR_PACK[producto];
            // Idempotencia: si ya hay un addon_purchases con esta session_id, no re-acreditar.
            const { data: existing } = await supabase
              .from("addon_purchases")
              .select("id")
              .eq("stripe_session_id", session.id)
              .maybeSingle();
            if (!existing) {
              const { data: orgRow } = await supabase
                .from("organizations")
                .select("consultas_ia_extras")
                .eq("id", orgId)
                .maybeSingle();
              const saldoActual = ((orgRow as any)?.consultas_ia_extras as number | undefined) ?? 0;
              const nuevoSaldo = saldoActual + cantidad;
              await supabase
                .from("organizations")
                .update({ consultas_ia_extras: nuevoSaldo })
                .eq("id", orgId);

              const contact = await getOrgContact(supabase, orgId);
              if (contact.email) {
                await sendTplEmail(
                  supabase,
                  "consultas-ia-acreditadas",
                  contact.email,
                  {
                    nombre: contact.nombre,
                    organizacion: contact.org_nombre,
                    cantidad,
                    total_extras: nuevoSaldo,
                    link: `${APP_URL}/login`,
                  },
                  `consultas-ia-acreditadas-${session.id}`,
                );
              }
            }
          }
          // Registrar addon
          await supabase.from("addon_purchases").insert({
            org_id: orgId,
            producto,
            stripe_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
            monto_usd: (session.amount_total ?? 0) / 100,
            metadata: { price_id: priceId, ...(producto === "dc3_extra" ? { quantity: dc3Qty } : {}) },
          });
        }
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        // OXXO: el pago se confirma horas después → activar igual que en completed
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        const priceId = session.metadata?.price_id;
        const producto = priceId ? PRICE_TO_PRODUCT[priceId] : session.metadata?.producto;
        if (!orgId) break;

        if (session.mode === "payment" && producto === "curso") {
          const { data: orgCurr } = await supabase
            .from("organizations")
            .select("plan, max_users")
            .eq("id", orgId)
            .maybeSingle();
          const planActual = (orgCurr as any)?.plan as string | undefined;
          const maxActual = ((orgCurr as any)?.max_users as number | undefined) ?? 0;
          const debeAplicarStarter =
            !planActual || planActual === "trial" || planActual === "curso";
          const cursoExpiraEn = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString();
          const updates: Record<string, unknown> = {
            estado: "activo",
            pending_price_id: null,
            tiene_curso_pagado: true,
            curso_expira_en: cursoExpiraEn,
            curso_aviso_5d_enviado_at: null,
          };
          if (debeAplicarStarter) {
            updates.plan = "starter";
            updates.max_users = Math.max(maxActual, 3);
          }
          await supabase.from("organizations").update(updates).eq("id", orgId);
        }
        // OXXO: pack de consultas IA
        if (session.mode === "payment" && producto && CONSULTAS_POR_PACK[producto]) {
          const cantidad = CONSULTAS_POR_PACK[producto];
          const { data: existing } = await supabase
            .from("addon_purchases")
            .select("id")
            .eq("stripe_session_id", session.id)
            .maybeSingle();
          if (!existing) {
            const { data: orgRow } = await supabase
              .from("organizations")
              .select("consultas_ia_extras")
              .eq("id", orgId)
              .maybeSingle();
            const saldoActual = ((orgRow as any)?.consultas_ia_extras as number | undefined) ?? 0;
            const nuevoSaldo = saldoActual + cantidad;
            await supabase
              .from("organizations")
              .update({ consultas_ia_extras: nuevoSaldo })
              .eq("id", orgId);
            await supabase.from("addon_purchases").insert({
              org_id: orgId,
              producto,
              stripe_session_id: session.id,
              stripe_payment_intent_id: typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
              monto_usd: (session.amount_total ?? 0) / 100,
              metadata: { price_id: priceId, oxxo: true },
            });
            const contact = await getOrgContact(supabase, orgId);
            if (contact.email) {
              await sendTplEmail(
                supabase,
                "consultas-ia-acreditadas",
                contact.email,
                {
                  nombre: contact.nombre,
                  organizacion: contact.org_nombre,
                  cantidad,
                  total_extras: nuevoSaldo,
                  link: `${APP_URL}/login`,
                },
                `consultas-ia-acreditadas-${session.id}`,
              );
            }
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        if (!orgId) break;
        // Mantener pendiente; el usuario verá la pantalla de pago pendiente
        await supabase
          .from("organizations")
          .update({ estado: "pendiente" })
          .eq("id", orgId);
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
        // Sincronizar gate de acceso con estado real de Stripe
        if (sub.status === "active" || sub.status === "trialing") {
          updates.estado = "activo";
          updates.pending_price_id = null;
        } else if (sub.status === "past_due" || sub.status === "unpaid") {
          updates.estado = "suspendido";
        } else if (sub.status === "canceled" || sub.status === "incomplete_expired") {
          updates.estado = "cancelado";
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
            estado: "cancelado",
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
          .update({ subscription_status: "past_due", estado: "suspendido" })
          .eq("stripe_customer_id", customerId);

        const { data: org } = await supabase
          .from("organizations")
          .select("id, nombre, plan")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (org?.id) {
          const contact = await getOrgContact(supabase, (org as any).id);
          if (contact.email) {
            const planLabel = PLAN_LABELS[(org as any).plan] || (org as any).plan || "TRACEA";
            const monto = ((invoice.amount_due ?? invoice.amount_remaining ?? 0) / 100).toFixed(2);
            const moneda = (invoice.currency || "usd").toUpperCase();
            await sendTplEmail(
              supabase,
              "pago-fallido",
              contact.email,
              {
                nombre: contact.nombre,
                organizacion: (org as any).nombre,
                concepto: `Suscripción ${planLabel}`,
                monto: `${moneda} ${monto}`,
                link: `${APP_URL}/precios`,
              },
              `pago-fallido-${invoice.id}`,
            );
          }
        }
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