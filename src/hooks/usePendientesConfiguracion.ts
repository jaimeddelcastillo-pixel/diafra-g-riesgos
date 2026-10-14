import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PendienteConfig {
  clave: string;
  titulo: string;
  modulo: "general" | "riesgos" | "cerebro";
  obligatorio: boolean;
  hecho: boolean;
  detalle: string | null;
  ruta: string;
  quien: "admin" | "admin_rs";
}

/** Puntos del asistente de configuración, calculados en la base (pendientes_configuracion). */
export function usePendientesConfiguracion(enabled = true) {
  const { orgId, user } = useAuth();
  return useQuery({
    queryKey: ["pendientes-configuracion", orgId, user?.id],
    enabled: enabled && !!orgId && !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pendientes_configuracion");
      if (error) throw error;
      return (data ?? []) as PendienteConfig[];
    },
  });
}

/** Estado "Ocultar" de la tarjeta de Inicio (onboarding_estado, clave configuracion_empresa). */
export function useConfigOculta(enabled = true) {
  const { orgId, user } = useAuth();
  return useQuery({
    queryKey: ["config-oculta", orgId, user?.id],
    enabled: enabled && !!orgId && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_estado").select("id")
        .eq("clave", "configuracion_empresa").eq("org_id", orgId!).maybeSingle();
      return !!data;
    },
  });
}
