import { Link, Outlet } from "react-router-dom";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCerebroAcceso } from "@/hooks/useCerebroAcceso";

/** Guardia de todas las rutas /cerebro*. UX: el enforcement real es RLS + edge functions. */
export function CerebroGuard() {
  const { tieneCerebro, loading } = useCerebroAcceso();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent>
      </Card>
    );
  }
  if (!tieneCerebro) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="font-semibold">Módulo no contratado</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            El Cerebro Institucional no está activo para tu organización.
          </p>
          <Button asChild>
            <Link to="/precios">Ver planes</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <Outlet />;
}
