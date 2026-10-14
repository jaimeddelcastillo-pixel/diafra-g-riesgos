import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePendientesConfiguracion, useConfigOculta } from "@/hooks/usePendientesConfiguracion";
import { toast } from "sonner";

/** Aviso en Inicio: solo admin/RS, solo con pendientes obligatorios; nunca para super_admin ni en soporte. */
export function TarjetaConfiguracionInicio() {
  const { orgRole, isSuperAdmin, isImpersonating, user, orgId } = useAuth();
  const visible = (orgRole === "admin" || orgRole === "responsable_sanitario") && !isSuperAdmin() && !isImpersonating;
  const { data } = usePendientesConfiguracion(visible);
  const { data: oculta, isLoading } = useConfigOculta(visible);
  const qc = useQueryClient();
  if (!visible || isLoading || oculta || !data) return null;
  const faltan = data.filter((p) => p.obligatorio && !p.hecho).length;
  if (faltan === 0) return null;

  const ocultar = async () => {
    const { error } = await supabase.from("onboarding_estado").upsert(
      { user_id: user!.id, org_id: orgId!, clave: "configuracion_empresa", saltado: true, completado_en: new Date().toISOString() },
      { onConflict: "user_id,org_id,clave" },
    );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["config-oculta"] });
  };

  return (
    <Card className="border-primary/40">
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        <Settings2 className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm font-medium">Configura tu empresa</p>
          <p className="text-xs text-muted-foreground">
            {faltan === 1 ? "Falta 1 punto obligatorio." : `Faltan ${faltan} puntos obligatorios.`}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={ocultar}>Ocultar</Button>
        <Button size="sm" asChild><Link to="/configuracion/asistente">Ir al asistente</Link></Button>
      </CardContent>
    </Card>
  );
}
