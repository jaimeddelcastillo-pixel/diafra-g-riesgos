import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useCerebroAcceso } from "@/hooks/useCerebroAcceso";

interface Props {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
}

/** Encabezado + gate de acceso compartido por las pantallas del Cerebro Institucional. */
export function CerebroPage({ titulo, descripcion, acciones, children }: Props) {
  const { tieneCerebro, loading } = useCerebroAcceso();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Cerebro Institucional
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
          {descripcion && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{descripcion}</p>
          )}
        </div>
        {tieneCerebro && acciones}
      </header>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent>
        </Card>
      ) : tieneCerebro ? (
        children
      ) : (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <h2 className="font-semibold">Módulo no incluido en tu plan</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              El Cerebro Institucional está disponible en los planes Professional y Enterprise.
            </p>
            <Button asChild>
              <Link to="/precios">Ver planes</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Estado vacío reutilizable dentro del módulo. */
export function CerebroVacio({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{mensaje}</p>
        {accion}
      </CardContent>
    </Card>
  );
}