import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useProfiles() {
  const { orgId, isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["profiles", orgId ?? "all"],
    queryFn: async () => {
      if (orgId) {
        // Filtrar por miembros de la org actual (real o impersonada).
        // NOTA: org_members.user_id apunta a auth.users, no a profiles, por lo que
        // no podemos hacer el join con `profiles!inner(...)`. Hacemos dos consultas.
        const { data: members, error: memErr } = await supabase
          .from("org_members")
          .select("user_id")
          .eq("org_id", orgId);
        if (memErr) throw memErr;
        const ids = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
        if (ids.length === 0) return [];
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nombre, cargo")
          .in("id", ids);
        if (error) throw error;
        return (data ?? []).sort((a: any, b: any) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
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
