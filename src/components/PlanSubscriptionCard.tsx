import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Sparkles, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PLANS, type PlanId } from "@/config/plans";

interface OrgSubscription {
  id: string;
  nombre: string;
  plan: string;
  estado: string;
  trial_expires_at: string | null;
  subscription_current_period_end: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  trial: "Prueba gratuita",
  starter: "Starter",
  professional: "Professional",
  pro: "Professional",
  enterprise: "Enterprise",
};

const PLAN_PRICE: Record<string, string> = {
  starter: "$85 USD / mes",
  professional: "$225 USD / mes",
  pro: "$225 USD / mes",
  enterprise: "$475 USD / mes",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function PlanSubscriptionCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingCheckout, setLoadingCheckout] = useState<PlanId | null>(null);

  const { data: org, isLoading } = useQuery<OrgSubscription | null>({
    queryKey: ["plan-subscription-card", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: member } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!member?.org_id) return null;

      const { data, error } = await supabase
        .from("organizations")
        .select(
          "id, nombre, plan, estado, trial_expires_at, subscription_current_period_end, subscription_status, stripe_customer_id, stripe_subscription_id"
        )
        .eq("id", member.org_id)
        .maybeSingle();
      if (error) throw error;
      return data as OrgSubscription | null;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string };
    },
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
    onError: (e: any) => toast.error(e.message || "No se pudo abrir el portal"),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string };
    },
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
    onError: (e: any) => {
      toast.error(e.message || "No se pudo iniciar el checkout");
      setLoadingCheckout(null);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Plan y suscripción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!org) return null;

  const planId = (org.plan ?? "trial").toLowerCase();
  const planLabel = PLAN_LABEL[planId] ?? org.plan;
  const isTrial = planId === "trial";
  const isEnterprise = planId === "enterprise";
  const isPaid = planId === "starter" || planId === "professional" || planId === "pro";
  const trialDias = isTrial ? diasRestantes(org.trial_expires_at) : null;
  const trialVencido = isTrial && trialDias !== null && trialDias <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Plan y suscripción
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Plan actual:</span>
          <Badge className="text-xs">{planLabel}</Badge>
          {isPaid && PLAN_PRICE[planId] && (
            <span className="text-xs text-muted-foreground">{PLAN_PRICE[planId]}</span>
          )}
          {org.estado === "suspendido" && (
            <Badge variant="destructive" className="text-[10px]">Suspendida</Badge>
          )}
        </div>

        {/* ── Trial ── */}
        {isTrial && (
          <div className="space-y-3">
            {trialVencido ? (
              <p className="text-sm text-destructive">
                Tu período de prueba ha finalizado. Activa un plan para seguir usando TRACEA.
              </p>
            ) : trialDias !== null ? (
              <p className="text-sm text-muted-foreground">
                Te quedan <strong>{trialDias} día{trialDias === 1 ? "" : "s"}</strong> de prueba
                (hasta el {formatDate(org.trial_expires_at)}).
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Estás usando la versión de prueba.
              </p>
            )}
            <Button onClick={() => navigate("/precios")} className="gap-2">
              <Sparkles className="h-4 w-4" /> Ver planes y activar
            </Button>
          </div>
        )}

        {/* ── Starter / Professional ── */}
        {isPaid && (
          <div className="space-y-3">
            {org.subscription_current_period_end && (
              <p className="text-sm text-muted-foreground">
                Próximo cobro:{" "}
                <strong className="text-foreground">
                  {formatDate(org.subscription_current_period_end)}
                </strong>
              </p>
            )}

            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Mejorar mi plan
              </p>
              <div className="flex flex-wrap gap-2">
                {PLANS.filter((p) => {
                  // Solo mostrar planes superiores al actual
                  if (planId === "starter") return p.id !== "starter";
                  if (planId === "professional" || planId === "pro") return p.id === "enterprise";
                  return false;
                }).map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant="outline"
                    disabled={
                      checkoutMutation.isPending && loadingCheckout === p.id
                    }
                    onClick={() => {
                      setLoadingCheckout(p.id);
                      checkoutMutation.mutate(p.priceId);
                    }}
                  >
                    {checkoutMutation.isPending && loadingCheckout === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    Cambiar a {p.nombre} — {p.precio}{p.periodo}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={portalMutation.isPending}
                onClick={() => portalMutation.mutate()}
                className="gap-2"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Gestionar suscripción
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={portalMutation.isPending}
                onClick={() => {
                  if (
                    !confirm(
                      "Vas a abrir el portal de suscripción para cancelar. ¿Continuar?"
                    )
                  )
                    return;
                  portalMutation.mutate();
                }}
                className="gap-2 text-destructive hover:text-destructive"
              >
                Cancelar suscripción
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Desde el portal puedes actualizar método de pago, descargar facturas o cancelar.
            </p>
          </div>
        )}

        {/* ── Enterprise ── */}
        {isEnterprise && (
          <div className="space-y-3">
            {org.subscription_current_period_end && (
              <p className="text-sm text-muted-foreground">
                Próximo cobro:{" "}
                <strong className="text-foreground">
                  {formatDate(org.subscription_current_period_end)}
                </strong>
              </p>
            )}
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
              <p className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4" /> Plan Enterprise
              </p>
              <p className="text-muted-foreground">
                Para cambios en tu plan Enterprise contáctanos:{" "}
                <a
                  href="mailto:soporte@tracea.com.mx"
                  className="underline text-primary"
                >
                  soporte@tracea.com.mx
                </a>
              </p>
            </div>
            {org.stripe_customer_id && (
              <Button
                variant="outline"
                size="sm"
                disabled={portalMutation.isPending}
                onClick={() => portalMutation.mutate()}
                className="gap-2"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Ver facturas y método de pago
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}