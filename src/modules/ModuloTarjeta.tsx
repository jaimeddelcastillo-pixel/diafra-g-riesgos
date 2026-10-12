import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ModuloTarjetaProps } from "./tipos";

/** Tarjeta base para Inicio (se usa a partir de P1b). */
export function ModuloTarjeta({ modulo }: ModuloTarjetaProps) {
  const Icono = modulo.icono;
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icono className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{modulo.nombre}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{modulo.descripcion}</p>
        <Button asChild size="sm">
          <Link to={modulo.rutaInicio}>Entrar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
