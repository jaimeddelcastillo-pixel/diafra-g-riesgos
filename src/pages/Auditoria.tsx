import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockAudit = [
  { id: 1, usuario: "Dr. García López", accion: "Creó folio GR-2025-001", timestamp: "2025-01-15 09:23:11", ip: "192.168.1.45", valorAnterior: "—", valorNuevo: "Borrador" },
  { id: 2, usuario: "Dr. García López", accion: "Agregó riesgo R1 a GR-2025-001", timestamp: "2025-01-15 09:45:30", ip: "192.168.1.45", valorAnterior: "—", valorNuevo: "Falla mecánica / NPR: 120" },
  { id: 3, usuario: "Ing. Martínez R.", accion: "Creó folio GR-2025-002", timestamp: "2025-02-01 11:12:05", ip: "192.168.1.78", valorAnterior: "—", valorNuevo: "Borrador" },
  { id: 4, usuario: "Ing. Martínez R.", accion: "Cambió estado GR-2025-002", timestamp: "2025-02-10 14:30:22", ip: "192.168.1.78", valorAnterior: "Borrador", valorNuevo: "En Firma" },
  { id: 5, usuario: "Dra. Hernández P.", accion: "Aprobó folio GR-2025-003", timestamp: "2025-03-01 16:05:44", ip: "192.168.1.92", valorAnterior: "En Firma", valorNuevo: "Aprobado" },
  { id: 6, usuario: "Admin", accion: "Modificó severidad R3 en GR-2025-001", timestamp: "2025-03-05 10:15:00", ip: "192.168.1.10", valorAnterior: "S=8", valorNuevo: "S=10" },
];

export default function Auditoria() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">Registro inalterable de todas las acciones del sistema</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Usuario</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Acción</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">IP</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Anterior</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {mockAudit.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs text-muted-foreground">{entry.id}</td>
                    <td className="py-2 font-medium">{entry.usuario}</td>
                    <td className="py-2">{entry.accion}</td>
                    <td className="py-2 font-mono text-xs">{entry.timestamp}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{entry.ip}</td>
                    <td className="py-2 text-xs">{entry.valorAnterior}</td>
                    <td className="py-2 text-xs font-medium">{entry.valorNuevo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
