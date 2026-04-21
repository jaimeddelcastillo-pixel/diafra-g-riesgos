import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State =
  | { status: "loading" }
  | { status: "valid" }
  | { status: "already" }
  | { status: "invalid"; message: string }
  | { status: "submitting" }
  | { status: "done" }
  | { status: "error"; message: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      if (!token) {
        setState({ status: "invalid", message: "Falta el token en el enlace." });
        return;
      }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } },
        );
        const data = await res.json();
        if (cancelled) return;
        if (data?.valid === true) setState({ status: "valid" });
        else if (data?.reason === "already_unsubscribed")
          setState({ status: "already" });
        else
          setState({
            status: "invalid",
            message: data?.error ?? "Enlace no válido.",
          });
      } catch {
        if (!cancelled)
          setState({ status: "invalid", message: "No pudimos validar el enlace." });
      }
    };
    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = async () => {
    setState({ status: "submitting" });
    try {
      const { data, error } = await supabase.functions.invoke(
        "handle-email-unsubscribe",
        { body: { token } },
      );
      if (error) throw error;
      if ((data as any)?.success) setState({ status: "done" });
      else if ((data as any)?.reason === "already_unsubscribed")
        setState({ status: "already" });
      else setState({ status: "error", message: "No se pudo procesar." });
    } catch (err: any) {
      setState({ status: "error", message: err?.message ?? "Error al procesar." });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MailX className="h-5 w-5 text-primary" />
            <CardTitle>Cancelar suscripción TRACEA</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === "loading" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando enlace…
            </p>
          )}

          {state.status === "valid" && (
            <>
              <p className="text-sm">
                Confirma que deseas dejar de recibir correos transaccionales de TRACEA
                en esta dirección. Los correos de seguridad de tu cuenta seguirán
                llegando.
              </p>
              <Button onClick={handleConfirm} className="w-full">
                Confirmar cancelación
              </Button>
            </>
          )}

          {state.status === "submitting" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
            </p>
          )}

          {state.status === "done" && (
            <p className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" /> Listo, te hemos dado de baja.
            </p>
          )}

          {state.status === "already" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5" /> Esta dirección ya estaba dada de
              baja.
            </p>
          )}

          {(state.status === "invalid" || state.status === "error") && (
            <p className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> {state.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}