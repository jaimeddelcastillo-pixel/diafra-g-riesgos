import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { useBrainGaps } from "@/hooks/useBrain";

export default function CerebroBrechas() {
  const { data: gaps = [], isLoading } = useBrainGaps();

  return (
    <CerebroPage
      titulo="Brechas"
      descripcion="Conocimiento que falta y quién podría aportarlo."
    >
      {isLoading ? null : gaps.length === 0 ? (
        <CerebroVacio mensaje="No hay brechas registradas." />
      ) : (
        <div className="space-y-2">
          {gaps.map((g: any) => (
            <Card key={g.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{g.descripcion ?? g.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {[g.tipo_brecha, g.prioridad, g.rol_sugerido].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge variant="outline">{g.estado}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CerebroPage>
  );
}