import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { useBrainKnowledge } from "@/hooks/useBrain";

export default function CerebroValidacion() {
  const { data: items = [], isLoading } = useBrainKnowledge();
  const pendientes = items.filter(
    (i: any) => i.estado === "por_validar" || i.estado === "contradictorio" || i.estado === "capturado",
  );

  return (
    <CerebroPage
      titulo="Validación"
      descripcion="Conocimiento que requiere revisión y decisión de gobernanza."
    >
      {isLoading ? null : pendientes.length === 0 ? (
        <CerebroVacio mensaje="No hay conocimiento pendiente de validación." />
      ) : (
        <div className="space-y-2">
          {pendientes.map((i: any) => (
            <Card key={i.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{i.titulo ?? i.enunciado}</p>
                  <p className="text-xs text-muted-foreground">{i.tipo}</p>
                </div>
                <Badge variant="outline">{i.estado}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CerebroPage>
  );
}