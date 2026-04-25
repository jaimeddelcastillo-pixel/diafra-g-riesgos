import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  useEffect(() => {
    // El webhook activa la suscripción del lado servidor.
    // Damos un momento para que se procese antes de que el usuario navegue.
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">¡Pago confirmado!</h1>
          <p className="text-muted-foreground">
            Tu suscripción se está activando. En unos segundos podrás usar todas las funciones de tu nuevo plan.
          </p>
          {sessionId && (
            <p className="text-xs text-muted-foreground font-mono break-all">
              Sesión: {sessionId}
            </p>
          )}
          <div className="flex gap-2 justify-center pt-4">
            <Button asChild>
              <Link to="/">Ir al panel</Link>
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