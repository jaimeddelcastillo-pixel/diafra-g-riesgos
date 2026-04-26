import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2, LogOut, Mail } from "lucide-react";
import { ADDONS, PLANS } from "@/config/plans";

export default function PagoPendiente() {
  const { user, loading, org, signOut, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [pagando, setPagando] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Si la cuenta ya está activa o el usuario es super_admin, no debería ver esta pantalla
  if (isSuperAdmin() || (org && org.estado !== "pendiente")) {
    return <Navigate to="/" replace />;
  }

  // Identificar el plan que eligió originalmente
  const priceId = org?.pending_price_id ?? null;
  const planElegido = priceId
    ? PLANS.find((p) => p.priceId === priceId) ?? null
    : null;
  const addonElegido = priceId
    ? ADDONS.find((a) => a.priceId === priceId) ?? null
    : null;
  const item = planElegido || addonElegido;

  const completarPago = async () => {
    if (!priceId) {
      toast({
        title: "No hay plan seleccionado",
        description: "Visita /precios para elegir un plan.",
        variant: "destructive",
      });
      return;
    }
    setPagando(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No se recibió URL de checkout");
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: "No pudimos iniciar el cobro",
        description: (err as Error).message,
        variant: "destructive",
      });
      setPagando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
            <CreditCard className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle className="text-xl">Completa tu pago</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tu cuenta está creada pero pendiente de pago. Completa tu suscripción para acceder a
            TRACEA.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {item ? (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Plan seleccionado
              </p>
              <p className="font-semibold text-foreground">{item.nombre}</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {item.precio}
                {planElegido && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {planElegido.periodo}
                  </span>
                )}
                {addonElegido && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    pago único
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No registramos qué plan elegiste. Por favor visítanos en{" "}
              <a href="/precios" className="underline font-medium">
                /precios
              </a>{" "}
              para elegir un plan.
            </div>
          )}

          <Button
            className="w-full"
            onClick={completarPago}
            disabled={pagando || !priceId}
          >
            {pagando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" /> Completar pago
              </>
            )}
          </Button>

          {!priceId && (
            <Button asChild variant="outline" className="w-full">
              <a href="/precios">Ver planes</a>
            </Button>
          )}

          <div className="border-t pt-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              ¿Necesitas ayuda? Escríbenos a{" "}
              <a
                href="mailto:soporte@tracea.com.mx"
                className="text-primary underline inline-flex items-center gap-1"
              >
                <Mail className="h-3 w-3" /> soporte@tracea.com.mx
              </a>
            </p>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-xs">
              <LogOut className="h-3 w-3 mr-1" /> Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}