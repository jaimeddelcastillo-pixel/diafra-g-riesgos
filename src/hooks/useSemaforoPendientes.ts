import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEMAFORO_DEFECTO, type Semaforo } from "@/lib/pendientes";

export function useSemaforoPendientes() {
  const { org } = useAuth();
  return useQuery({
    queryKey: ["semaforo-pendientes", org?.id],
    enabled: !!org?.id,
    queryFn: async (): Promise<Semaforo> => {
      if (!org) return SEMAFORO_DEFECTO;
      const { data, error } = await supabase.from("org_pendientes_semaforo").select("operativo_naranja,operativo_rojo,gestion_naranja,gestion_rojo").eq("org_id", org.id).maybeSingle();
      if (error) throw error;
      return data ?? SEMAFORO_DEFECTO;
    },
  });
}