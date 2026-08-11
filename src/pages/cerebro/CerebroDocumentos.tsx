import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { useBrainDocuments } from "@/hooks/useBrain";

export default function CerebroDocumentos() {
  const { data: docs = [], isLoading } = useBrainDocuments();

  return (
    <CerebroPage
      titulo="Documentos"
      descripcion="Documentos institucionales que respaldan el conocimiento capturado."
    >
      {isLoading ? null : docs.length === 0 ? (
        <CerebroVacio mensaje="Aún no hay documentos registrados." />
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{d.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {[d.tipo, d.codigo, d.revision].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge variant="outline">{d.estado}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CerebroPage>
  );
}