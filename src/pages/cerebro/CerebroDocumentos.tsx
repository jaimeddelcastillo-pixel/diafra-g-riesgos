import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { ImportarListadoDialog } from "@/components/cerebro/ImportarListadoDialog";
import { useBrainDocuments, useBrainImportBatches, useBrainImportPropuestas } from "@/hooks/useBrain";
import { useAuth } from "@/hooks/useAuth";

export default function CerebroDocumentos() {
  const qc = useQueryClient();
  const { hasRole, orgId } = useAuth();
  const { data: docs = [], isLoading } = useBrainDocuments();
  const { data: batches = [] } = useBrainImportBatches();
  const { data: propuestas = [] } = useBrainImportPropuestas();
  const [importar, setImportar] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const puedeImportar = hasRole("admin") || hasRole("responsable_sanitario");
  const pendientes = (propuestas as any[]).filter((p) => p.estado === "propuesta");

  const revertir = async (batchId: string) => {
    setTrabajando(batchId);
    const { data: diag, error: diagErr } = await supabase.functions.invoke("brain-import-listado", {
      body: { accion: "revertir", batch_id: batchId, solo_diagnostico: true },
    });
    if (diagErr || !diag) {
      setTrabajando(null);
      toast.error("No se pudo verificar qué documentos están en uso. No se borró nada.");
      return;
    }
    if (diag.eliminables === 0 && !diag.vacio) {
      setTrabajando(null);
      toast.error("Toda esta importación ya está siendo utilizada por el Cerebro y se conservará.");
      return;
    }
    const ok = window.confirm(
      diag.vacio
        ? "Esta importación no tiene documentos. Se marcará como deshecha. ¿Continuar?"
        : `Se eliminarán ${diag.eliminables} documentos y se conservarán ${diag.referenciados} (tienen conocimiento asociado). ¿Deshacer la importación?`,
    );
    if (!ok) { setTrabajando(null); return; }
    const { data, error } = await supabase.functions.invoke("brain-import-listado", {
      body: { accion: "revertir", batch_id: batchId },
    });
    setTrabajando(null);
    if (error) { toast.error("No se pudo deshacer la importación."); return; }
    qc.invalidateQueries({ queryKey: ["brain"] });
    const partes = [
      `Se eliminaron ${data?.eliminados ?? 0} documentos. Conservados: ${data?.conservados ?? 0}.`,
    ];
    if ((data?.procesos_eliminados ?? 0) > 0) {
      partes.push(`${data.procesos_eliminados} procesos sin uso se eliminaron.`);
    }
    if ((data?.procesos_conservados ?? 0) > 0) {
      partes.push(
        `${data.procesos_conservados} procesos se conservaron porque ya tienen conocimiento o entrevistas asociadas.`,
      );
    }
    toast.success(partes.join(" "));
  };

  return (
    <CerebroPage
      titulo="Documentos"
      descripcion="Documentos institucionales que respaldan el conocimiento capturado."
      acciones={
        puedeImportar ? (
          <Button onClick={() => setImportar(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Importar Listado Maestro de Documentos
          </Button>
        ) : undefined
      }
    >
      <ImportarListadoDialog open={importar} onOpenChange={setImportar} />

      {pendientes.length > 0 && (
        <Card className="border-sidebar-primary/40">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <p className="text-sm">
              Hay {pendientes.length} propuestas de áreas o procesos pendientes de revisar.
            </p>
            <Badge variant="secondary">Requiere revisión humana</Badge>
          </CardContent>
        </Card>
      )}

      {isLoading ? null : docs.length === 0 ? (
        <CerebroVacio mensaje="Aún no hay documentos registrados." />
      ) : (
        <div className="space-y-2">
          {(docs as any[]).map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{d.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {[d.tipo, d.codigo, d.revision].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.origen === "listado_maestro" && <Badge variant="secondary">Listado Maestro</Badge>}
                  <Badge variant="outline">{d.estado}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(batches as any[]).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Historial de importaciones</h2>
          <div className="space-y-2">
            {(batches as any[]).map((b) => (
              <Card key={b.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{b.nombre_archivo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString("es-MX")} · {b.formato.toUpperCase()} ·{" "}
                      {b.filas_importadas}/{b.total_filas} filas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{b.estado}</Badge>
                    {puedeImportar && b.estado !== "revertido" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        disabled={trabajando === b.id}
                        onClick={() => revertir(b.id)}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Deshacer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </CerebroPage>
  );
}
