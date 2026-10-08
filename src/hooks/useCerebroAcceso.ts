import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Visibilidad del módulo Cerebro Institucional.
 * La decisión vive en la base de datos (catálogo de módulos + organization_features)
 * vía mi_org_tiene_modulo; RLS y las edge functions la hacen cumplir.
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

  const tieneCerebro = isSuperAdmin() || !!tieneModulo;
  const esTrial = (org?.plan ?? "").startsWith("trial");

  return {
    loading: isLoading,
    tieneCerebro,
    esTrial,
    /** En trial: solo una sesión de entrevista y sin exportación. */
    puedeExportar: !esTrial && tieneCerebro,
  };
}
