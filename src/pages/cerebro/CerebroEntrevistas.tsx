import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { NuevaEntrevistaDialog } from "@/components/cerebro/NuevaEntrevistaDialog";
import { PanelEntrevista } from "@/components/cerebro/PanelEntrevista";
import { useBrainAssignments, useBrainSessions } from "@/hooks/useBrain";

export default function CerebroEntrevistas() {
  const { data: asignaciones = [], isLoading } = useBrainAssignments();
  const { data: sesiones = [] } = useBrainSessions();
  const [modal, setModal] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (sessionId) {
    return (
      <CerebroPage titulo="Entrevista" descripcion="Sesión de captura de conocimiento institucional.">
        <PanelEntrevista sessionId={sessionId} onSalir={() => setSessionId(null)} />
      </CerebroPage>
    );
  }

  return (
    <CerebroPage
      titulo="Entrevistas"
      descripcion="Personas asignadas para entrevista y sesiones realizadas."
      acciones={
        <Button onClick={() => setModal(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva entrevista
        </Button>
      }
    >
      <NuevaEntrevistaDialog open={modal} onOpenChange={setModal} onCreada={setSessionId} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Asignaciones</h2>
        {isLoading ? null : asignaciones.length === 0 ? (
          <CerebroVacio mensaje="Sin asignaciones de entrevista todavía." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(asignaciones as any[]).map((a) => (
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
            {(sesiones as any[]).map((s) => (
              <Card key={s.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setSessionId(s.id)}>
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
