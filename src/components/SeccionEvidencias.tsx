import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Riesgo } from "@/hooks/useFolios";

interface Anexo {
  name: string;
  path: string;
}

interface Props {
  riesgos: Riesgo[];
  folioCodigo: string;
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="bg-muted px-4 py-2 border-b">
      <h3 className="text-sm font-bold">
        {number}. {title}
      </h3>
    </div>
  );
}

export function SeccionEvidencias({ riesgos, folioCodigo }: Props) {
  const { toast } = useToast();
  const [descargando, setDescargando] = useState<string | null>(null);

  const riesgosConAnexos = riesgos.filter(
    (r) => (r as any).anexos && ((r as any).anexos as Anexo[]).length > 0
  );

  const totalAnexos = riesgosConAnexos.reduce(
    (sum, r) => sum + ((r as any).anexos as Anexo[]).length,
    0
  );

  const handleDescargar = async (path: string, nombre: string) => {
    setDescargando(path);
    try {
      const { data, error } = await supabase.storage
        .from("evidencias")
        .createSignedUrl(path, 3600);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast({
        title: "Error al descargar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDescargando(null);
    }
  };

  const handleDescargarTodas = async () => {
    if (totalAnexos === 0) return;
    toast({
      title: "Descargando evidencias",
      description: `Abriendo ${totalAnexos} archivo${totalAnexos > 1 ? "s" : ""}...`,
    });

    for (const riesgo of riesgosConAnexos) {
      const anexos = (riesgo as any).anexos as Anexo[];
      for (const anexo of anexos) {
        const { data, error } = await supabase.storage
          .from("evidencias")
          .createSignedUrl(anexo.path, 3600);
        if (!error && data) {
          await new Promise((r) => setTimeout(r, 300));
          window.open(data.signedUrl, "_blank");
        }
      }
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <SectionHeader number="5" title="Evidencias y Anexos" />

      {/* Resumen y acciones globales */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span>
            {totalAnexos === 0
              ? "Sin evidencias adjuntas"
              : `${totalAnexos} archivo${totalAnexos > 1 ? "s" : ""} en ${riesgosConAnexos.length} riesgo${riesgosConAnexos.length > 1 ? "s" : ""}`}
          </span>
        </div>

        {totalAnexos > 1 && (
          <Button variant="outline" size="sm" onClick={handleDescargarTodas}>
            <Download className="h-4 w-4" />
            Descargar todas
          </Button>
        )}
      </div>

      {totalAnexos === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">No hay evidencias adjuntas en este folio.</p>
          <p className="text-xs mt-1 max-w-xs text-center">
            Adjunta archivos PDF en la sección de riesgos para documentar las acciones implementadas.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {riesgosConAnexos.map((riesgo) => {
            const anexos = (riesgo as any).anexos as Anexo[];
            const npr = riesgo.npr ?? riesgo.severidad * riesgo.ocurrencia * riesgo.deteccion;
            const esCritico = npr > 150 || riesgo.severidad >= 9;

            return (
              <div key={riesgo.id} className="px-4 py-3">
                {/* Encabezado del riesgo */}
                <div className="flex items-start gap-3 mb-2">
                  <span className="inline-flex items-center justify-center h-6 w-8 rounded bg-primary text-primary-foreground text-xs font-bold shrink-0">
                    ID {String(riesgo.numero_id).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {riesgo.peligro_modo_falla}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{riesgo.etapa_proceso}</span>
                      {esCritico && (
                        <span className="text-xs text-destructive font-medium">
                          🔴 Crítico — NPR {npr}
                        </span>
                      )}
                    </div>
                    {riesgo.accion_implementada && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Acción: {riesgo.accion_implementada.slice(0, 100)}
                        {riesgo.accion_implementada.length > 100 ? "..." : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lista de archivos */}
                <div className="ml-11 space-y-1">
                  {anexos.map((anexo, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{anexo.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDescargar(anexo.path, anexo.name)}
                        disabled={descargando === anexo.path}
                      >
                        {descargando === anexo.path ? (
                          <span className="text-xs">Abriendo...</span>
                        ) : (
                          <>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nota regulatoria */}
      <div className="px-4 py-2 bg-muted/50 border-t">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          NOM-241-SSA1-2025 · Las evidencias son parte integral del expediente de gestión de riesgos.
          Los archivos se almacenan de forma segura y los links de descarga son válidos por 60 minutos.
        </p>
      </div>
    </div>
  );
}
