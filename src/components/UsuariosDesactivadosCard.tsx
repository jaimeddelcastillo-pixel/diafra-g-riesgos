import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserX, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { nombresPersonas } from "@/lib/nombresPersonas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Fila { id: string; userId: string; nombre: string; fecha: string; quien: string; motivo: string }

/** C2b-F: usuarios desactivados de la empresa activa, armados desde la bitácora. */
export function UsuariosDesactivadosCard({ puedeReactivar }: { puedeReactivar: boolean }) {
  const { orgId } = useAuth();
  const qc = useQueryClient();

  const { data: filas = [], isLoading } = useQuery<Fila[]>({
    queryKey: ["usuarios-desactivados", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: eventos, error } = await supabase.from("audit_trail")
        .select("id, created_at, user_id, registro_id, accion, valor_nuevo")
        .eq("org_id", orgId!).in("accion", ["USUARIO_DESACTIVADO", "USUARIO_REACTIVADO"])
        .order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      const { data: miembros } = await supabase.from("org_members").select("user_id").eq("org_id", orgId!);
      const actuales = new Set((miembros ?? []).map((m: any) => m.user_id));

      // Último evento por persona: si es desactivación y ya no es miembro, se lista.
      const vistos = new Set<string>();
      const ultimos: any[] = [];
      for (const e of eventos ?? []) {
        const uid = e.registro_id as string | null;
        if (!uid || vistos.has(uid)) continue;
        vistos.add(uid);
        if (e.accion === "USUARIO_DESACTIVADO" && !actuales.has(uid)) ultimos.push(e);
      }
      const nombres = await nombresPersonas(ultimos.flatMap((e) => [e.registro_id, e.user_id]));
      return ultimos.map((e) => ({
        id: e.id, userId: e.registro_id,
        nombre: nombres[e.registro_id] ?? e.registro_id,
        fecha: new Date(e.created_at).toLocaleDateString("es-MX"),
        quien: e.user_id ? nombres[e.user_id] ?? e.user_id : "Sistema",
        motivo: (e.valor_nuevo as any)?.motivo ?? "—",
      }));
    },
  });

  const reactivar = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("create-user", { body: { accion: "reactivar", user_id: userId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Usuario reactivado");
      qc.invalidateQueries({ queryKey: ["usuarios-desactivados", orgId] });
      qc.invalidateQueries({ queryKey: ["org-users", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserX className="h-4 w-4" /> Usuarios desactivados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay usuarios desactivados en esta empresa.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Desactivado por</th>
                <th className="pb-2 font-medium">Motivo</th>
                {puedeReactivar && <th className="pb-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b last:border-0 align-top">
                  <td className="py-2 font-medium">{f.nombre}</td>
                  <td className="py-2 text-muted-foreground">{f.fecha}</td>
                  <td className="py-2 text-muted-foreground">{f.quien}</td>
                  <td className="py-2 text-muted-foreground">{f.motivo}</td>
                  {puedeReactivar && (
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" className="gap-1" disabled={reactivar.isPending}
                        onClick={() => reactivar.mutate(f.userId)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
