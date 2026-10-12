import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModuloTarjetaProps } from "./tipos";

/** Tarjeta de un módulo contratado en Inicio. */
export function ModuloTarjeta({ modulo, pendientes, cargando, error }: ModuloTarjetaProps) {
  const Icono = modulo.icono;
  return (
    <Card className="flex flex-col">
      <CardContent className="p-5 space-y-4 flex-1 flex flex-col">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icono className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{modulo.nombre}</h3>
            <p className="text-sm text-muted-foreground">{modulo.descripcion}</p>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Pendientes</p>
          {cargando ? (
            <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
          ) : error ? (
            <p className="text-sm text-muted-foreground">No disponible</p>
          ) : !pendientes || pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pendientes</p>
          ) : (
            <ul className="space-y-1.5">
              {pendientes.map((p) => {
                const contenido = (
                  <span className="flex items-center justify-between gap-3 text-sm">
                    <span className={p.cantidad === 0 ? "text-muted-foreground" : ""}>{p.etiqueta}</span>
                    {typeof p.cantidad === "number" && (
                      <span
                        className={
                          p.cantidad > 0
                            ? "min-w-6 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold text-center"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {p.cantidad}
                      </span>
                    )}
                  </span>
                );
                return (
                  <li key={p.etiqueta}>
                    {p.ruta ? <Link to={p.ruta} className="block hover:underline">{contenido}</Link> : contenido}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Button asChild size="sm" className="self-start">
          <Link to={modulo.rutaInicio}>Entrar <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
