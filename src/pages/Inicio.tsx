import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Boxes, LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMisModulos } from "@/hooks/useMisModulos";
import { ordenarModulos, type ModuloDef } from "@/modules";
import { TarjetaConfiguracionInicio } from "@/components/TarjetaConfiguracionInicio";
import { MisPendientesCard } from "@/components/pendientes/MisPendientesCard";

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador", responsable_sanitario: "Responsable Sanitario", comite_tecnico: "Comité Técnico",
  operador: "Operador", lectura: "Lectura", super_admin: "Soporte TRACEA",
};

function TarjetaConPendientes({ modulo }: { modulo: ModuloDef }) {
  const { org, orgId, user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pendientes-modulo", modulo.clave, orgId, user?.id],
    enabled: !!user && !!orgId,
    retry: 1,
    queryFn: () => modulo.obtenerPendientes({ org }),
  });
  const Tarjeta = modulo.Tarjeta;
  return <Tarjeta modulo={modulo} pendientes={data} cargando={isLoading} error={isError} />;
}

export default function Inicio() {
  const { loading, isSuperAdmin, isImpersonating, profile, org, orgRole } = useAuth();
  const { data: catalogo, isLoading, isError } = useMisModulos();

  // Redirección del super_admin (antes vivía en el tablero de Riesgos).
  if (!loading && isSuperAdmin() && !isImpersonating) return <Navigate to="/admin" replace />;

  const ordenDb = catalogo ? Object.fromEntries(catalogo.map((m) => [m.clave, m.orden ?? 999])) : undefined;
  const acceso = new Set((catalogo ?? []).filter((m) => m.tiene_acceso).map((m) => m.clave));
  const registrados = ordenarModulos(ordenDb);
  const contratados = registrados.filter((m) => acceso.has(m.clave));
  const disponibles = (catalogo ?? []).filter((m) => !m.tiene_acceso && m.estado !== "beta");
  const nombre = profile?.nombre?.trim() ?? "";

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Hola{nombre ? `, ${nombre}` : ""}</h1>
        <p className="text-sm text-muted-foreground">
          {org?.nombre ?? "—"}
          {orgRole && <> · {ROL_LABEL[orgRole] ?? orgRole}</>}
        </p>
      </header>

      <TarjetaConfiguracionInicio />

      <MisPendientesCard />

      {isLoading || loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56" /><Skeleton className="h-56" />
        </div>
      ) : isError ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No disponible. Intenta recargar la página.</CardContent></Card>
      ) : contratados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Boxes className="h-8 w-8 mx-auto text-muted-foreground" />
            <h2 className="font-semibold">Tu organización no tiene módulos activos</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Si crees que es un error, escríbenos y lo revisamos.
            </p>
            <Button asChild variant="outline">
              <Link to="/soporte"><LifeBuoy className="h-4 w-4 mr-1" /> Ir a Ayuda</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2" aria-label="Módulos contratados" data-onboarding="tarjetas-modulos">
          {contratados.map((m) => <TarjetaConPendientes key={m.clave} modulo={m} />)}
        </section>
      )}

      {!isLoading && disponibles.length > 0 && (
        <section className="border-t pt-4" aria-label="Disponibles">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Disponibles</p>
          <div className="flex flex-wrap gap-3">
            {disponibles.map((d) => {
              const def = registrados.find((r) => r.clave === d.clave);
              const Icono = def?.icono ?? Boxes;
              const proximamente = d.estado === "proximamente";
              return (
                <div key={d.clave} className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <Icono className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{def?.nombre ?? d.nombre}</span>
                  {proximamente ? (
                    <Badge variant="outline" className="text-xs">Próximamente</Badge>
                  ) : (
                    <Link to="/precios" className="text-xs text-primary hover:underline">Conocer más</Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
