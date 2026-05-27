import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type NormaSel = "NOM-241" | "NOM-059" | "MULTI";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { org, refreshOrg, loading } = useAuth();
  const { toast } = useToast();

  const [norma, setNorma] = useState<NormaSel>("NOM-241");
  const [guardando, setGuardando] = useState(false);
  const [intentos, setIntentos] = useState(0);

  // Refrescar org en el primer render por si el webhook recién se procesó.
  useEffect(() => {
    refreshOrg().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-poll si el curso aún no se refleja como pagado (webhook lento)
  useEffect(() => {
    if (!org || (org as any)?.tiene_curso_pagado) return;
    if (intentos > 6) return;
    const t = setTimeout(() => {
      refreshOrg().catch(() => {});
      setIntentos((i) => i + 1);
    }, 1500);
    return () => clearTimeout(t);
  }, [org, intentos, refreshOrg]);

  const cursoPagado = (org as any)?.tiene_curso_pagado === true;
  const normaDefinida = !!org?.norma_aplicable;
  const necesitaSeleccionNorma = cursoPagado && !normaDefinida;

  const guardarNorma = async () => {
    if (!org?.id) return;
    setGuardando(true);
    try {
      const metodologia =
        norma === "NOM-059" ? "ICH-Q9" : norma === "MULTI" ? "MULTI" : "AMEF";
      const { error } = await supabase
        .from("organizations")
        .update({ norma_aplicable: norma, metodologia })
        .eq("id", org.id);
      if (error) throw error;
      await refreshOrg();
      toast({ title: "Curso activado", description: "Listo para empezar." });
    } catch (err) {
      toast({
        title: "No se pudo guardar la selección",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (necesitaSeleccionNorma) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 space-y-5">
            <div className="text-center space-y-2">
              <GraduationCap className="w-12 h-12 text-primary mx-auto" />
              <h1 className="text-2xl font-bold">¿Para qué industria es tu curso?</h1>
              <p className="text-sm text-muted-foreground">
                Activaremos el curso correspondiente a tu norma. Podrás cambiarla
                más adelante desde Configuración.
              </p>
            </div>

            <RadioGroup
              value={norma}
              onValueChange={(v) => setNorma(v as NormaSel)}
              className="space-y-2"
            >
              {[
                { value: "NOM-241", label: "Dispositivos Médicos — NOM-241 y FEUM" },
                { value: "NOM-059", label: "Medicamentos — NOM-059 y FEUM" },
                { value: "MULTI", label: "Ambas industrias" },
              ].map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`norma-${opt.value}`}
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition ${
                    norma === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={opt.value} id={`norma-${opt.value}`} />
                  <span className="text-sm font-medium">{opt.label}</span>
                </Label>
              ))}
            </RadioGroup>

            <Button
              className="w-full"
              size="lg"
              onClick={guardarNorma}
              disabled={guardando}
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activar mi curso"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">¡Pago confirmado!</h1>
          <p className="text-muted-foreground">
            {cursoPagado
              ? "Tu curso y mes de prueba están activos. Ya puedes empezar."
              : "Tu suscripción se está activando. En unos segundos podrás usar todas las funciones de tu nuevo plan."}
          </p>
          {sessionId && (
            <p className="text-xs text-muted-foreground font-mono break-all">
              Sesión: {sessionId}
            </p>
          )}
          <div className="flex gap-2 justify-center pt-4">
            <Button asChild>
              <Link to={cursoPagado ? "/capacitacion" : "/"}>
                {cursoPagado ? "Ir al curso" : "Ir al panel"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/configuracion">Ver mi suscripción</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}