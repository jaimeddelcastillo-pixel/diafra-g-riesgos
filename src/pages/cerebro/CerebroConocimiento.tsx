import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { useBrainKnowledge } from "@/hooks/useBrain";

export default function CerebroConocimiento() {
  const { data: items = [], isLoading } = useBrainKnowledge();

  return (
    <CerebroPage
      titulo="Conocimiento"
      descripcion="Todo el conocimiento capturado, con su tipo y estado de validación."
    >
      {isLoading ? null : items.length === 0 ? (
        <CerebroVacio mensaje="Todavía no hay conocimiento capturado." />
      ) : (
        <div className="space-y-2">
          {items.map((i: any) => (
            <Card key={i.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{i.titulo ?? i.enunciado}</p>
                  <Badge variant="outline">{i.estado}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{i.tipo}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CerebroPage>
  );
}