import { useParams, useNavigate } from "react-router-dom";
import { mockFolios, getNPRLevel } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileSignature, Lock } from "lucide-react";

const estadoStyles: Record<string, string> = {
  Borrador: "bg-secondary text-secondary-foreground",
  "En Firma": "bg-primary text-primary-foreground",
  Aprobado: "bg-success text-success-foreground",
  Cerrado: "bg-muted text-muted-foreground",
};

export default function FolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const folio = mockFolios.find((f) => f.id === id);

  if (!folio) return <div className="p-8 text-center text-muted-foreground">Folio no encontrado</div>;

  const locked = folio.estado !== "Borrador";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/folios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono">{folio.codigo}</h1>
            <Badge className={`text-[10px] ${estadoStyles[folio.estado]}`}>{folio.estado}</Badge>
            {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          <p className="text-sm text-muted-foreground">{folio.producto}</p>
        </div>
        {folio.estado === "Borrador" && (
          <Button className="gap-2">
            <FileSignature className="h-4 w-4" /> Enviar a Firma
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz AMEF — Análisis de Riesgos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 pr-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left pb-2 pr-2 font-medium text-muted-foreground">Peligro</th>
                  <th className="text-left pb-2 pr-2 font-medium text-muted-foreground">Modo de Falla</th>
                  <th className="text-left pb-2 pr-2 font-medium text-muted-foreground">Efecto</th>
                  <th className="text-center pb-2 pr-1 font-medium text-muted-foreground">S</th>
                  <th className="text-center pb-2 pr-1 font-medium text-muted-foreground">O</th>
                  <th className="text-center pb-2 pr-1 font-medium text-muted-foreground">D</th>
                  <th className="text-center pb-2 pr-2 font-medium text-muted-foreground">NPR</th>
                  <th className="text-left pb-2 pr-2 font-medium text-muted-foreground">Plan de Acción</th>
                  <th className="text-left pb-2 pr-2 font-medium text-muted-foreground">Control</th>
                  <th className="text-center pb-2 pr-1 font-medium text-muted-foreground">S'</th>
                  <th className="text-center pb-2 pr-1 font-medium text-muted-foreground">O'</th>
                  <th className="text-center pb-2 pr-1 font-medium text-muted-foreground">D'</th>
                  <th className="text-center pb-2 font-medium text-muted-foreground">NPR'</th>
                </tr>
              </thead>
              <tbody>
                {folio.riesgos.map((r) => {
                  const level = getNPRLevel(r.npr);
                  const residualLevel = getNPRLevel(r.nprResidual);
                  const needsAction = r.npr > 100 || r.severidad >= 9;

                  return (
                    <tr key={r.id} className={`border-b last:border-0 ${needsAction && !r.planAccion ? "bg-destructive/5" : ""}`}>
                      <td className="py-2 pr-2 font-mono">{r.id}</td>
                      <td className="py-2 pr-2 max-w-[120px]">{r.peligro}</td>
                      <td className="py-2 pr-2 max-w-[140px]">{r.modoFalla}</td>
                      <td className="py-2 pr-2 max-w-[140px]">{r.efecto}</td>
                      <td className={`py-2 pr-1 text-center font-bold ${r.severidad >= 9 ? "text-destructive" : ""}`}>{r.severidad}</td>
                      <td className="py-2 pr-1 text-center">{r.ocurrencia}</td>
                      <td className="py-2 pr-1 text-center">{r.deteccion}</td>
                      <td className="py-2 pr-2 text-center">
                        <span className={`font-bold ${r.npr > 100 ? "text-destructive" : r.npr > 40 ? "text-warning" : "text-success"}`}>
                          {r.npr}
                        </span>
                      </td>
                      <td className="py-2 pr-2 max-w-[180px]">
                        {r.planAccion || (
                          needsAction ? <span className="text-destructive font-semibold">⚠ REQUERIDO</span> : <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 max-w-[150px]">{r.controlImplementado || "—"}</td>
                      <td className="py-2 pr-1 text-center">{r.sevResidual}</td>
                      <td className="py-2 pr-1 text-center">{r.ocuResidual}</td>
                      <td className="py-2 pr-1 text-center">{r.detResidual}</td>
                      <td className="py-2 text-center">
                        <span className={`font-bold ${r.nprResidual > 100 ? "text-destructive" : r.nprResidual > 40 ? "text-warning" : "text-success"}`}>
                          {r.nprResidual}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
