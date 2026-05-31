import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useProfiles() {
  const { orgId, isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["profiles", orgId ?? "all"],
    queryFn: async () => {
      if (orgId) {
        // Filtrar por miembros de la org actual (real o impersonada)
        const { data, error } = await supabase
          .from("org_members")
          .select("profiles!inner(id, nombre, cargo)")
          .eq("org_id", orgId);
        if (error) throw error;
        return ((data ?? []).map((r: any) => r.profiles) as { id: string; nombre: string; cargo: string | null }[])
          .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nombre, cargo")
        .order("nombre");
      if (error) throw error;
      return data;
    },
    enabled: orgId != null || isSuperAdmin(),
  });
}
