import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Download, ExternalLink, FolderOpen, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Riesgo } from "@/hooks/useFolios";
import { getNormaConfig } from "@/config/normas";

interface Anexo {
  name: string;
  path: string;
}

interface Props {
  riesgos: Riesgo[];
  folioCodigo: string;
  folioId: string;
  normaFolio?: string | null;
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

// ─── Upload directo por riesgo ────────────────────────────────────────────────
function UploadEvidencia({
  riesgoId,
  folioId,
  onUploaded,
}: {
  riesgoId: string;
  folioId: string;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const esPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!esPDF) {
      toast({ title: "Solo archivos PDF", variant: "destructive" });
      return;
    }


    setUploading(true);
    try {
      // Sanitizar nombre: eliminar tildes, espacios y caracteres especiales
      const nombreLimpio = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${folioId}/${Date.now()}_${nombreLimpio}`;
      const { error: upErr } = await supabase.storage.from("evidencias").upload(path, file);
      if (upErr) throw upErr;

      // Obtener anexos actuales del riesgo
      const { data: riesgo, error: rErr } = await supabase.from("riesgos").select("anexos").eq("id", riesgoId).single();
      if (rErr) throw rErr;

      const anexosActuales = ((riesgo as any).anexos as Anexo[] | null) || [];
      const nuevosAnexos = [...anexosActuales, { name: file.name, path }];

      const { error: uErr } = await supabase
        .from("riesgos")
        .update({ anexos: nuevosAnexos } as any)
        .eq("id", riesgoId);
      if (uErr) throw uErr;

      toast({ title: "✅ Evidencia adjuntada correctamente" });
      onUploaded();
    } catch (err: any) {
      toast({ title: "Error al subir evidencia", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
      <Button
        variant="outline"
        size="sm"
        className="gap-1 text-xs h-7"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="h-3 w-3" />
        {uploading ? "Subiendo..." : "Adjuntar PDF"}
      </Button>
    </>
  );
}

export function SeccionEvidencias({ riesgos, folioCodigo, folioId, normaFolio }: Props) {
  const nc = getNormaConfig(normaFolio);
  const refs = nc.normasReferencia.join(" / ");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [descargando, setDescargando] = useState<string | null>(null);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["folio"] });
    queryClient.invalidateQueries({ queryKey: ["all-riesgos"] });
  };

  // Recopilar todos los riesgos que tienen anexos
  const riesgosConAnexos = riesgos.filter((r) => (r as any).anexos && ((r as any).anexos as Anexo[]).length > 0);

  const totalAnexos = riesgosConAnexos.reduce((sum, r) => sum + ((r as any).anexos as Anexo[]).length, 0);

  // Generar URL firmada para descarga segura (válida 60 minutos)
  const handleDescargar = async (path: string, nombre: string) => {
    setDescargando(path);
    try {
      const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 3600); // 1 hora

      if (error) throw error;

      // Abrir en nueva pestaña
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

  // Descargar todas las evidencias del folio como ZIP (via URLs individuales)
  const handleDescargarTodas = async () => {
    if (totalAnexos === 0) return;
    toast({
      title: "Descargando evidencias",
      description: `Abriendo ${totalAnexos} archivo${totalAnexos > 1 ? "s" : ""}...`,
    });

    for (const riesgo of riesgosConAnexos) {
      const anexos = (riesgo as any).anexos as Anexo[];
      for (const anexo of anexos) {
        const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(anexo.path, 3600);
        if (!error && data) {
          // Pequeño delay entre descargas para no saturar el navegador
          await new Promise((r) => setTimeout(r, 300));
          window.open(data.signedUrl, "_blank");
        }
      }
    }
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="IV" title="EVIDENCIAS DE ACCIONES IMPLEMENTADAS" />

      {/* Resumen y acciones globales */}
      <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {totalAnexos === 0
              ? "Sin evidencias adjuntas"
              : `${totalAnexos} archivo${totalAnexos > 1 ? "s" : ""} en ${riesgosConAnexos.length} riesgo${riesgosConAnexos.length > 1 ? "s" : ""}`}
          </span>
        </div>
        {totalAnexos > 1 && (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleDescargarTodas}>
            <Download className="h-3 w-3" />
            Descargar todas
          </Button>
        )}
      </div>

      {totalAnexos === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay evidencias adjuntas en este folio.</p>
          <p className="text-xs mt-1">
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
              <div key={riesgo.id} className="p-4">
                {/* Encabezado del riesgo con botón upload */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">
                      ID {String(riesgo.numero_id).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{riesgo.peligro_modo_falla}</p>
                      <p className="text-xs text-muted-foreground">
                        {riesgo.etapa_proceso}
                        {esCritico && <span className="ml-2 text-destructive font-medium">Crítico — NPR {npr}</span>}
                      </p>
                      {riesgo.accion_implementada && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Acción: {riesgo.accion_implementada.slice(0, 100)}
                          {riesgo.accion_implementada.length > 100 ? "..." : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Botón upload directo */}
                  <UploadEvidencia riesgoId={riesgo.id} folioId={folioId} onUploaded={handleRefresh} />
                </div>

                {/* Lista de archivos */}
                <div className="space-y-1.5 ml-8">
                  {anexos.map((anexo, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="text-xs truncate font-medium">{anexo.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs h-7 opacity-60 group-hover:opacity-100 shrink-0"
                        onClick={() => handleDescargar(anexo.path, anexo.name)}
                        disabled={descargando === anexo.path}
                      >
                        {descargando === anexo.path ? (
                          <span className="text-xs">Abriendo...</span>
                        ) : (
                          <>
                            <ExternalLink className="h-3 w-3" />
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
      <div className="px-4 py-2 bg-muted/20 border-t">
        <p className="text-[10px] text-muted-foreground">
          {refs} · Las evidencias son parte integral del expediente de gestión de riesgos. Los archivos se
          almacenan de forma segura y los links de descarga son válidos por 60 minutos.
        </p>
      </div>
    </div>
  );
}
