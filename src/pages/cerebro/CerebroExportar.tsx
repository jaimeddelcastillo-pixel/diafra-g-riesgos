import { Card, CardContent } from "@/components/ui/card";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { useBrainExports } from "@/hooks/useBrain";
import { useCerebroAcceso } from "@/hooks/useCerebroAcceso";

export default function CerebroExportar() {
  const { data: exports = [] } = useBrainExports();
  const { puedeExportar } = useCerebroAcceso();

  return (
    <CerebroPage
      titulo="Exportar"
      descripcion="Genera el archivo consolidado del conocimiento institucional."
    >
      {!puedeExportar && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            La exportación no está disponible durante el periodo de prueba.
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Historial de exportaciones</h2>
        {exports.length === 0 ? (
          <CerebroVacio mensaje="Todavía no se ha generado ninguna exportación." />
        ) : (
          <div className="space-y-2">
            {exports.map((e: any) => (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{e.nombre_archivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.items_incluidos} ítems · {e.gaps_incluidos} brechas ·{" "}
                    {e.contradicciones_incluidas} contradicciones
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </CerebroPage>
  );
}