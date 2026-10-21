import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listarPendientes } from "@/lib/pendientes";

export function usePendientes(alcance: "mio" | "empresa" = "mio", enabled = true) {
  const { user, org } = useAuth();
  return useQuery({
    queryKey: ["pendientes", alcance, user?.id, org?.id],
    queryFn: () => listarPendientes(alcance),
    enabled: enabled && !!user && !!org,
    staleTime: 60_000,
  });
}
