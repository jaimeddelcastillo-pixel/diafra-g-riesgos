import { Link, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Guardia genérica de rutas de un módulo. UX: el enforcement real es RLS + edge functions. */
export function ModuloGuard({ clave, mensaje }: { clave: string; mensaje: string }) {
  const { orgId, user, isSuperAdmin } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["mi-org-tiene-modulo", orgId, user?.id, clave],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mi_org_tiene_modulo", { _modulo: clave });
      if (error) throw error;
      return !!data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent>
      </Card>
    );
  }
  if (!isSuperAdmin() && !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="font-semibold">Módulo no contratado</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{mensaje}</p>
          <Button asChild>
            <Link to="/precios">Ver planes</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <Outlet />;
}
