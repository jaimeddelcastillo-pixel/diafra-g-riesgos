import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Visibilidad del módulo Cerebro Institucional.
 * La decisión vive en la base de datos (catálogo de módulos + organization_features)
 * vía mi_org_tiene_modulo; RLS y las edge functions la hacen cumplir.
 * Los topes por plan se leen de plan_limites (mi_plan_limite).
 */
export function useCerebroAcceso() {
  const { orgId, org, isSuperAdmin, user } = useAuth();

  const { data: tieneModulo, isLoading } = useQuery({
    queryKey: ["mi-org-tiene-modulo", orgId, user?.id, "institutional_brain"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mi_org_tiene_modulo", {
        _modulo: "institutional_brain",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: exportarLim, isLoading: loadingLim } = useQuery({
    queryKey: ["mi-plan-limite", orgId, user?.id, "exportar"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mi_plan_limite", { p_clave: "exportar" });
      if (error) throw error;
      return data as unknown;
    },
  });

  const tieneCerebro = isSuperAdmin() || !!tieneModulo;
  const esTrial = (org?.plan ?? "").startsWith("trial");
  // NULL = sin límite; solo un false explícito bloquea.
  const exportarPermitido = isSuperAdmin() || exportarLim !== false;

  return {
    loading: isLoading || loadingLim,
    tieneCerebro,
    esTrial,
    puedeExportar: exportarPermitido && tieneCerebro,
  };
}
