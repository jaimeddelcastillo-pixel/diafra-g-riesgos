import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ADDONS, PLANS, type AddonId, type PlanId } from "@/config/plans";

export default function Planes() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const startCheckout = async (priceId: string, key: PlanId | AddonId) => {
    setLoadingId(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Inicia sesión", description: "Necesitas estar autenticado para comprar." });
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No se recibió URL de checkout");
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Planes y precios</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Elige el plan que mejor se adapte a tu organización. Todos incluyen folios y matriz AMEF ilimitados.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={plan.destacado ? "border-primary shadow-lg relative" : ""}
          >
            {plan.destacado && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Sparkles className="w-3 h-3 mr-1" /> Más popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.nombre}</CardTitle>
              <CardDescription>{plan.descripcion}</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">{plan.precio}</span>
                <span className="text-muted-foreground">{plan.periodo}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.destacado ? "default" : "outline"}
                onClick={() => startCheckout(plan.priceId, plan.id)}
                disabled={loadingId !== null}
              >
                {loadingId === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Suscribirme a ${plan.nombre}`
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>

      <section>
        <header className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Complementos (compra única)</h2>
          <p className="text-muted-foreground">Mejora tu organización con recursos adicionales.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {ADDONS.map((addon) => (
            <Card key={addon.id}>
              <CardHeader>
                <CardTitle>{addon.nombre}</CardTitle>
                <CardDescription>{addon.descripcion}</CardDescription>
                <div className="pt-2">
                  <span className="text-3xl font-bold">{addon.precio}</span>
                  <span className="text-muted-foreground text-sm ml-2">pago único</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {addon.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => startCheckout(addon.priceId, addon.id)}
                  disabled={loadingId !== null}
                >
                  {loadingId === addon.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Comprar ahora"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}