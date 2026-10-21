import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendientes } from "@/hooks/usePendientes";
import { MODULO_LABEL } from "@/lib/pendientes";
import { PuntoColor } from "./PuntoColor";

export function MisPendientesCard() {
  const { data, isLoading, isError } = usePendientes("mio");
  const lista = data ?? [];
  return (
    <Card aria-label="Mis pendientes">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Mis pendientes ({lista.length})</CardTitle>
        <Button asChild variant="link" size="sm"><Link to="/pendientes">Ver todos</Link></Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-24" /> : isError ? (
          <p className="text-sm text-muted-foreground">No se pudieron cargar tus pendientes.</p>
        ) : !lista.length ? (
          <p className="text-sm text-muted-foreground">No tienes pendientes.</p>
        ) : (
          <ul className="divide-y">
            {lista.slice(0, 5).map((p) => (
              <li key={`${p.tipo}-${p.registro}-${p.titulo}`}>
                <Link to={p.ruta} className="flex items-center gap-3 py-2 text-sm hover:underline">
                  <PuntoColor color={p.color} />
                  <span className="flex-1 truncate">{p.titulo}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{MODULO_LABEL[p.modulo] ?? p.modulo}</span>
                  <span className="text-xs text-muted-foreground">{p.dias} d</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
