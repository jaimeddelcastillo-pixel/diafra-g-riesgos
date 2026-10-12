import { Link, Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Guardia genérica de rutas. Deja pasar si la empresa activa tiene AL MENOS UNO
 * de los módulos indicados (un módulo = su clave; páginas de plataforma = varias).
 * UX: el enforcement real es RLS + edge functions.
 */
export function ModuloGuard({ clave, mensaje }: { clave: string | string[]; mensaje: string }) {
  const { orgId, user, isSuperAdmin, isImpersonating, loading } = useAuth();
  const panelTracea = !loading && isSuperAdmin() && !isImpersonating;
  const claves = Array.isArray(clave) ? clave : [clave];
  const { data, isLoading } = useQuery({
    queryKey: ["mi-org-tiene-modulo", orgId, user?.id, claves.join(",")],
    enabled: !!user && !panelTracea,
    queryFn: async () => {
      for (const c of claves) {
        const { data, error } = await supabase.rpc("mi_org_tiene_modulo", { _modulo: c });
        if (error) throw error;
        if (data) return true;
      }
      return false;
    },
  });

  if (panelTracea) return <Navigate to="/admin" replace />;
  if (loading || isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent>
      </Card>
    );
  }
  if (!data) {
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
