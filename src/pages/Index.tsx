import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NPRBarChart } from "@/components/NPRBarChart";
import { HeatMap } from "@/components/HeatMap";
import { mockFolios, getAllRisks, getNPRLevel } from "@/data/mockData";
import { AlertTriangle, FileCheck, ClipboardList, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const allRisks = getAllRisks();
  const critical = allRisks.filter((r) => r.npr > 100 || r.severidad >= 9);
  const openFolios = mockFolios.filter((f) => f.estado !== "Cerrado");

  const stats = [
    { label: "Folios Activos", value: openFolios.length, icon: ClipboardList, color: "text-primary" },
    { label: "Riesgos Totales", value: allRisks.length, icon: ShieldAlert, color: "text-accent" },
    { label: "Riesgos Críticos", value: critical.length, icon: AlertTriangle, color: "text-destructive" },
    { label: "Aprobados", value: mockFolios.filter((f) => f.estado === "Aprobado").length, icon: FileCheck, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Panorama general del sistema de gestión de riesgos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold mt-1">{s.value}</p>
                </div>
                <s.icon className={`h-10 w-10 ${s.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución de NPR</CardTitle>
          </CardHeader>
          <CardContent>
            <NPRBarChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matriz de Calor (Severidad × Ocurrencia)</CardTitle>
          </CardHeader>
          <CardContent>
            <HeatMap />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riesgos que Requieren Acción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Folio</th>
                  <th className="pb-2 font-medium text-muted-foreground">Peligro</th>
                  <th className="pb-2 font-medium text-muted-foreground">NPR</th>
                  <th className="pb-2 font-medium text-muted-foreground">Nivel</th>
                  <th className="pb-2 font-medium text-muted-foreground">Plan de Acción</th>
                </tr>
              </thead>
              <tbody>
                {mockFolios.flatMap((f) =>
                  f.riesgos
                    .filter((r) => r.npr > 100 || r.severidad >= 9)
                    .map((r) => {
                      const level = getNPRLevel(r.npr);
                      return (
                        <tr key={`${f.id}-${r.id}`} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{f.codigo}</td>
                          <td className="py-2">{r.peligro}</td>
                          <td className="py-2 font-bold">{r.npr}</td>
                          <td className="py-2">
                            <Badge variant={level.label === "Crítico" ? "destructive" : "secondary"} className="text-[10px]">
                              {level.label}
                            </Badge>
                          </td>
                          <td className="py-2 text-xs max-w-[250px] truncate">
                            {r.planAccion || <span className="text-destructive font-medium">⚠ Requerido</span>}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
