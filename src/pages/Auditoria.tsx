import { Card, CardContent } from "@/components/ui/card";
import { useAuditTrail } from "@/hooks/useFolios";
import { Skeleton } from "@/components/ui/skeleton";

export default function Auditoria() {
  const { data: entries, isLoading } = useAuditTrail();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">Registro inalterable de todas las acciones del sistema</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 font-medium text-muted-foreground">Tabla</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Acción</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">IP</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Registro ID</th>
                  </tr>
                </thead>
                <tbody>
                  {entries?.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{entry.tabla}</td>
                      <td className="py-2">{entry.accion}</td>
                      <td className="py-2 font-mono text-xs">{new Date(entry.created_at).toLocaleString()}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{entry.ip || "—"}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground truncate max-w-[120px]">{entry.registro_id}</td>
                    </tr>
                  ))}
                  {entries?.length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sin registros de auditoría</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
