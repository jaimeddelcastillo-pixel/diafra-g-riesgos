import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { useBrainContradictions } from "@/hooks/useBrain";

export default function CerebroContradicciones() {
  const { data: items = [], isLoading } = useBrainContradictions();

  return (
    <CerebroPage
      titulo="Contradicciones"
      descripcion="Conflictos detectados entre versiones del conocimiento institucional."
    >
      {isLoading ? null : items.length === 0 ? (
        <CerebroVacio mensaje="No se han detectado contradicciones." />
      ) : (
        <div className="space-y-2">
          {items.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{c.descripcion ?? c.titulo}</p>
                  <p className="text-xs text-muted-foreground">{c.tipo}</p>
                </div>
                <Badge variant="outline">{c.estado}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CerebroPage>
  );
}