import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendientes } from "@/hooks/usePendientes";
import { contarPendientes } from "@/lib/pendientes";
import { PuntoColor } from "./PuntoColor";
import { PendienteEnlace } from "./PendienteEnlace";
import { useSemaforoPendientes } from "@/hooks/useSemaforoPendientes";
import { cn } from "@/lib/utils";

export function MisPendientesCard() {
  const { data, isLoading, isError } = usePendientes("mio");
  const lista = data ?? [];
  const conteo = contarPendientes(lista);
  const semaforo = useSemaforoPendientes();
  return (
    <Card aria-label="Mis pendientes" className={cn(conteo.rojo > 0 && "border-destructive")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Mis pendientes ({lista.length})</CardTitle>
        <Button asChild variant="link" size="sm"><Link to="/pendientes">Ver todos</Link></Button>
      </CardHeader>
      <CardContent>
        {!isLoading && !isError && <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5"><PuntoColor color="rojo" />{conteo.rojo} vencidos</span><span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5"><PuntoColor color="naranja" />{conteo.naranja} por vencer</span><span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5"><PuntoColor color="verde" />{conteo.verde} a tiempo</span>
          </div>
          {conteo.rojo > 0 && <p role="alert" className="text-sm font-semibold text-destructive">Tienes {conteo.rojo} pendientes vencidos</p>}
        </div>}
        {isLoading ? <Skeleton className="h-24" /> : isError ? (
          <p className="text-sm text-muted-foreground">No se pudieron cargar tus pendientes.</p>
        ) : !lista.length ? (
          <p className="text-sm text-muted-foreground">No tienes pendientes.</p>
        ) : (
          <ul className="divide-y">
            {lista.slice(0, 5).map((p) => (
              <li key={`${p.tipo}-${p.registro}-${p.titulo}`}>
                <PendienteEnlace pendiente={p} semaforo={semaforo.data} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
