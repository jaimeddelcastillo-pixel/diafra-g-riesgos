import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { useBrainAssignments, useBrainSessions } from "@/hooks/useBrain";

export default function CerebroEntrevistas() {
  const { data: asignaciones = [], isLoading } = useBrainAssignments();
  const { data: sesiones = [] } = useBrainSessions();

  return (
    <CerebroPage
      titulo="Entrevistas"
      descripcion="Personas asignadas para entrevista y sesiones realizadas."
    >
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Asignaciones</h2>
        {isLoading ? null : asignaciones.length === 0 ? (
          <CerebroVacio mensaje="Sin asignaciones de entrevista todavía." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {asignaciones.map((a: any) => (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{a.nombre_externo ?? "Miembro interno"}</p>
                    <Badge variant="outline">{a.estado}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[a.puesto, a.capa, a.nivel_autoridad].filter(Boolean).join(" · ")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Sesiones</h2>
        {sesiones.length === 0 ? (
          <CerebroVacio mensaje="Aún no se ha realizado ninguna sesión de entrevista." />
        ) : (
          <div className="space-y-2">
            {sesiones.map((s: any) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{s.entrevistado_nombre ?? "Entrevistado"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.preguntas_realizadas} preguntas · {s.items_capturados} ítems capturados
                    </p>
                  </div>
                  <Badge variant="outline">{s.estado}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </CerebroPage>
  );
}