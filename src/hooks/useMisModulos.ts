import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ModuloCatalogo {
  clave: string;
  nombre: string;
  descripcion: string | null;
  orden: number | null;
  estado: "activo" | "proximamente" | string;
  /** Acceso comercial de la empresa activa (plan u organization_features). */
  tiene_acceso: boolean;
}

/** Catálogo de módulos con el acceso de la empresa activa (función mis_modulos). */
export function useMisModulos() {
  const { orgId, user } = useAuth();
  return useQuery({
    queryKey: ["mis-modulos", orgId, user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mis_modulos" as any);
      if (error) throw error;
      return (data ?? []) as ModuloCatalogo[];
    },
  });
}
