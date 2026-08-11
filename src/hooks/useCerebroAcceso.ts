import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PLANES_CON_CEREBRO = ["professional", "enterprise"];

/**
 * Visibilidad del módulo Cerebro Institucional (UX, no seguridad).
 * El enforcement real es server-side en la edge function `brain-interview`.
 */
export function useCerebroAcceso() {
  const { orgId, org, isSuperAdmin } = useAuth();

  const { data: feature, isLoading } = useQuery({
    queryKey: ["org-feature", orgId, "institutional_brain"],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_features")
        .select("activo, expira_en")
        .eq("org_id", orgId!)
        .eq("feature_key", "institutional_brain")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const featureActiva =
    !!feature?.activo &&
    (!feature.expira_en || new Date(feature.expira_en) > new Date());

  const planIncluye = PLANES_CON_CEREBRO.includes(org?.plan ?? "");
  const esTrial = (org?.plan ?? "").startsWith("trial");

  return {
    loading: isLoading,
    tieneCerebro: isSuperAdmin() || planIncluye || featureActiva,
    esTrial,
    /** En trial: solo una sesión de entrevista y sin exportación. */
    puedeExportar: !esTrial && (isSuperAdmin() || planIncluye || featureActiva),
  };
}