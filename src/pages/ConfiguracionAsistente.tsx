import { Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePendientesConfiguracion, useConfigOculta, type PendienteConfig } from "@/hooks/usePendientesConfiguracion";
import { toast } from "sonner";

const GRUPOS: { clave: PendienteConfig["modulo"]; titulo: string }[] = [
  { clave: "general", titulo: "Empresa" },
  { clave: "riesgos", titulo: "Gestión de Riesgos" },
  { clave: "cerebro", titulo: "Cerebro Institucional" },
];

export default function ConfiguracionAsistente() {
  const { loading, orgRole, isSuperAdmin, isImpersonating, user, orgId } = useAuth();
  const esSuper = isSuperAdmin();
  const gestor = orgRole === "admin" || orgRole === "responsable_sanitario";
  const permitido = gestor || esSuper;
  const { data, isLoading, isError } = usePendientesConfiguracion(permitido);
  const escribe = gestor && !esSuper && !isImpersonating;
  const { data: oculta } = useConfigOculta(escribe);
  const qc = useQueryClient();

  if (!loading && !permitido) return <Navigate to="/" replace />;

  const puntos = data ?? [];
  const listos = puntos.filter((p) => p.hecho).length;
  const faltanObligatorios = puntos.some((p) => p.obligatorio && !p.hecho);
  const esRS = orgRole === "responsable_sanitario" && !esSuper;

  const mostrarEnInicio = async () => {
    const { error } = await supabase.from("onboarding_estado").delete()
      .eq("user_id", user!.id).eq("org_id", orgId!).eq("clave", "configuracion_empresa");
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["config-oculta"] });
    toast.success("La tarjeta volverá a aparecer en Inicio.");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/configuracion" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Configuración
        </Link>
        <h1 className="text-2xl font-bold mt-1">Configura tu empresa</h1>
        {!isLoading && !isError && (
          <p className="text-sm text-muted-foreground">{listos} de {puntos.length} listos</p>
        )}
      </div>

      {escribe && oculta && faltanObligatorios && (
        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <span className="text-muted-foreground">Ocultaste el aviso de Inicio, pero aún hay pendientes obligatorios.</span>
          <Button size="sm" variant="outline" onClick={mostrarEnInicio}>Mostrar en Inicio</Button>
        </div>
      )}

      {isLoading || loading ? <Skeleton className="h-64" /> : isError ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No disponible. Intenta recargar la página.</CardContent></Card>
      ) : GRUPOS.map((g) => {
        const items = puntos.filter((p) => p.modulo === g.clave);
        if (items.length === 0) return null;
        return (
          <Card key={g.clave}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{g.titulo}</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {items.map((p) => (
                <div key={p.clave} className="flex items-center gap-3 py-3">
                  {p.hecho
                    ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" aria-label="Hecho" />
                    : <Circle className="h-5 w-5 text-muted-foreground shrink-0" aria-label="Pendiente" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {p.titulo}
                      {p.obligatorio && <Badge variant="outline" className="text-[10px]">Obligatorio</Badge>}
                    </div>
                    {p.detalle && <p className="text-xs text-muted-foreground">{p.detalle}</p>}
                  </div>
                  {esRS && p.quien === "admin" ? (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Lo hace el administrador</span>
                  ) : (
                    <Button asChild size="sm" variant={p.hecho ? "ghost" : "outline"}><Link to={p.ruta}>Ir</Link></Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
