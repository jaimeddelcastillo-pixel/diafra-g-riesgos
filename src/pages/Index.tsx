import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NPRBarChart } from "@/components/NPRBarChart";
import { HeatMap } from "@/components/HeatMap";
import { useFolios, useAllRiesgos, getNPRLevel } from "@/hooks/useFolios";
import { AlertTriangle, FileCheck, ClipboardList, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: folios, isLoading: loadingFolios } = useFolios();
  const { data: allRisks, isLoading: loadingRisks } = useAllRiesgos();

  const risks = allRisks || [];
  const fols = folios || [];
  const critical = risks.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9);
  const openFolios = fols.filter((f) => f.estado !== "Cerrado");

  const stats = [
    { label: "Folios Activos", value: openFolios.length, icon: ClipboardList, color: "text-primary" },
    { label: "Riesgos Totales", value: risks.length, icon: ShieldAlert, color: "text-accent" },
    { label: "Riesgos Críticos", value: critical.length, icon: AlertTriangle, color: "text-destructive" },
    { label: "Aprobados", value: fols.filter((f) => f.estado === "Aprobado").length, icon: FileCheck, color: "text-success" },
  ];

  const isLoading = loadingFolios || loadingRisks;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Panorama general — Sistema de Gestión de Riesgos FOR-SGC-11-01</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  {isLoading ? <Skeleton className="h-9 w-16 mt-1" /> : <p className="text-3xl font-bold mt-1">{s.value}</p>}
                </div>
                <s.icon className={`h-10 w-10 ${s.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribución de NPR</CardTitle></CardHeader>
          <CardContent><NPRBarChart risks={risks} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Matriz de Calor (Severidad × Ocurrencia)</CardTitle></CardHeader>
          <CardContent><HeatMap risks={risks} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Riesgos que Requieren Acción</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Folio</th>
                  <th className="pb-2 font-medium text-muted-foreground">Peligro</th>
                  <th className="pb-2 font-medium text-muted-foreground">NPR</th>
                  <th className="pb-2 font-medium text-muted-foreground">Nivel</th>
                  <th className="pb-2 font-medium text-muted-foreground">Acción Propuesta</th>
                </tr>
              </thead>
              <tbody>
                {risks
                  .filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9)
                  .map((r) => {
                    const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
                    const level = getNPRLevel(npr, r.severidad);
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{r.folios?.codigo || "—"}</td>
                        <td className="py-2">{r.peligro_modo_falla}</td>
                        <td className="py-2 font-bold">{npr}</td>
                        <td className="py-2">
                          <Badge variant={level.label === "Crítico" ? "destructive" : "secondary"} className="text-[10px]">{level.label}</Badge>
                        </td>
                        <td className="py-2 text-xs max-w-[250px] truncate">
                          {r.accion_propuesta || <span className="text-destructive font-medium">⚠ Requerido</span>}
                        </td>
                      </tr>
                    );
                  })}
                {!isLoading && critical.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sin riesgos críticos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
