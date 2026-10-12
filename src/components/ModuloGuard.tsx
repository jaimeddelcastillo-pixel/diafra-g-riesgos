import { Link, Outlet } from "react-router-dom";
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
  const { orgId, user } = useAuth();
  const claves = Array.isArray(clave) ? clave : [clave];
  const { data, isLoading } = useQuery({
    queryKey: ["mi-org-tiene-modulo", orgId, user?.id, claves.join(",")],
    enabled: !!user,
    queryFn: async () => {
      for (const c of claves) {
        const { data, error } = await supabase.rpc("mi_org_tiene_modulo", { _modulo: c });
        if (error) throw error;
        if (data) return true;
      }
      return false;
    },
  });

  if (isLoading) {
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
