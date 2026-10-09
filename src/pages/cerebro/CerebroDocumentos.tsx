import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Undo2, Paperclip, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { ImportarListadoDialog } from "@/components/cerebro/ImportarListadoDialog";
import { useBrainDocuments, useBrainImportBatches, useBrainImportPropuestas } from "@/hooks/useBrain";
import { useAuth } from "@/hooks/useAuth";

export default function CerebroDocumentos() {
  const qc = useQueryClient();
  const { hasRole, orgId, orgRole } = useAuth();
  const { data: docs = [], isLoading } = useBrainDocuments();
  const { data: batches = [] } = useBrainImportBatches();
  const { data: propuestas = [] } = useBrainImportPropuestas();
  const [importar, setImportar] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const puedeImportar = hasRole("admin") || hasRole("responsable_sanitario");
  const puedeEnlazar = orgRole === "admin" || orgRole === "responsable_sanitario" || orgRole === "super_admin";
  const pendientes = (propuestas as any[]).filter((p) => p.estado === "propuesta");

  // Archivos vigentes de Recursos (para mostrar enlace y la sección "Sin registro oficial").
  const { data: archivos = [] } = useQuery({
    queryKey: ["brain", "archivos-recursos", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("org_documentos")
        .select("id, nombre, tipo, version, nombre_archivo_original")
        .eq("org_id", orgId).is("deleted_at", null).is("retirado_en", null).eq("es_version_actual", true);
      return data ?? [];
    },
  });
  const { data: tipos = [] } = useQuery({
    queryKey: ["documento-tipos", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("documento_tipos").select("clave, nombre").eq("org_id", orgId);
      return data ?? [];
    },
  });
  const { data: sugerencias = [] } = useQuery({
    queryKey: ["brain", "sugerencias-enlace", orgId],
    enabled: !!orgId && puedeEnlazar,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("brain_sugerencias_enlace");
      if (error) throw error;
      return data ?? [];
    },
  });
  const nombreTipo: Record<string, string> = Object.fromEntries((tipos as any[]).map((t) => [t.clave, t.nombre]));
  const archivoPorId: Record<string, any> = Object.fromEntries((archivos as any[]).map((a) => [a.id, a]));
  const enlazados = new Set((docs as any[]).map((d) => d.archivo_id).filter(Boolean));
  const sinRegistro = (archivos as any[]).filter((a) => !enlazados.has(a.id));

  const resolverEnlace = async (s: any, confirmar: boolean) => {
    if (confirmar && !window.confirm(`¿Enlazar "${s.archivo_nombre}" al registro ${s.codigo}?`)) return;
    setTrabajando(s.archivo_id);
    const { error } = await (supabase as any).rpc("brain_resolver_enlace", {
      p_documento_id: s.documento_id, p_archivo_id: s.archivo_id, p_confirmar: confirmar,
    });
    setTrabajando(null);
    if (error) return toast.error(error.message);
    toast.success(confirmar ? "Enlace confirmado." : "Sugerencia descartada.");
    qc.invalidateQueries({ queryKey: ["brain"] });
  };

  // C6a.3: extraer conocimiento del archivo enlazado. Todo entra como "por_validar".
  const extraer = async (documentoId: string) => {
    setTrabajando(documentoId);
    const { data, error } = await supabase.functions.invoke("brain-extract-document", {
      body: { documento_id: documentoId },
    });
    setTrabajando(null);
    let mensaje = data?.mensaje as string | undefined;
    if (!mensaje && error) {
      try { mensaje = (await (error as any).context?.json())?.mensaje; } catch { /* sin cuerpo */ }
    }
    if (error || !data?.ok) {
      toast.error(mensaje ?? "No se pudo extraer el conocimiento del documento.");
      return;
    }
    if (data.truncado) {
      toast.warning(`Se leyeron solo las primeras páginas permitidas por tu plan. ${data.mensaje}`);
    } else {
      toast.success(data.mensaje);
    }
    if (data.sugerencia_enlace) {
      toast.info(`El contenido sugiere el registro ${data.sugerencia_enlace.codigo}. Revísalo en los enlaces sugeridos.`);
    }
    qc.invalidateQueries({ queryKey: ["brain"] });
  };

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

      {puedeEnlazar && (sugerencias as any[]).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Enlaces sugeridos por nombre de archivo</h2>
          <p className="text-xs text-muted-foreground">
            El código del registro aparece en el nombre del archivo de Recursos. Nada se enlaza hasta que lo confirmes.
          </p>
          {(sugerencias as any[]).map((s) => (
            <Card key={`${s.documento_id}-${s.archivo_id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{s.codigo} · {s.documento_nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    Archivo: {s.archivo_nombre}{s.nombre_archivo ? ` (${s.nombre_archivo})` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={trabajando === s.archivo_id} onClick={() => resolverEnlace(s, true)}>Confirmar</Button>
                  <Button size="sm" variant="ghost" disabled={trabajando === s.archivo_id} onClick={() => resolverEnlace(s, false)}>Descartar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
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
                    {[nombreTipo[d.tipo_clave] ?? d.tipo, d.codigo, d.revision].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {d.archivo_id
                      ? `Archivo enlazado: ${archivoPorId[d.archivo_id]?.nombre ?? "en Recursos"}`
                      : "Sin archivo enlazado"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.origen === "listado_maestro" && <Badge variant="secondary">Listado Maestro</Badge>}
                  <Badge variant="outline">{d.estado}</Badge>
                  {d.archivo_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={trabajando === d.id}
                      onClick={() => extraer(d.id)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {trabajando === d.id ? "Leyendo…" : "Extraer conocimiento"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sinRegistro.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Sin registro oficial</h2>
          <p className="text-xs text-muted-foreground">
            Archivos de Recursos que no están enlazados a ningún registro del Listado Maestro.
          </p>
          {sinRegistro.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{a.nombre}</p>
                  <p className="text-xs text-muted-foreground">{[a.tipo, `v${a.version}`, a.nombre_archivo_original].filter(Boolean).join(" · ")}</p>
                </div>
                <Badge variant="outline">Sin registro oficial</Badge>
              </CardContent>
            </Card>
          ))}
        </section>
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
