import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X, CheckCircle, XCircle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Folio, Riesgo } from "@/hooks/useFolios";
import { getNormaConfig } from "@/config/normas";

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="bg-muted px-4 py-2 border-b">
      <h3 className="text-sm font-bold">
        {number}. {title}
      </h3>
    </div>
  );
}

interface Props {
  folio: Folio;
  riesgos: Riesgo[];
  locked: boolean;
  onSaved: () => void;
}

export function SeccionDictamen({ folio, riesgos, locked, onSaved }: Props) {
  const [editingJustificacion, setEditingJustificacion] = useState(false);
  const [savingJustificacion, setSavingJustificacion] = useState(false);
  const [savingDictamen, setSavingDictamen] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [showRechazoForm, setShowRechazoForm] = useState(false);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  // Terminología dependiente de la norma del folio (no de la org).
  const normaConfig = getNormaConfig((folio as any).norma_folio);
  const t = normaConfig.terminologia;

  const esRS = hasRole("responsable_sanitario");
  const esAdmin = hasRole("admin");
  // Admin y RS pueden editar la conclusión siempre, salvo cuando el folio
  // ya está cerrado (estado "Cerrado") — durante "Aprobado" siguen pudiendo
  // corregirla porque el sistema permite reabrir/rectificar.
  const puedeEditarConclusion = (esAdmin || esRS) && folio.estado !== "Cerrado";
  const hasNoAceptables = riesgos.some((r) => r.dictamen === "No Aceptable");

  const [justificacion, setJustificacion] = useState((folio as any).justificacion_tecnica || "");

  // ── Guardar justificación técnica (cualquier rol autorizado) ──
  const handleSaveJustificacion = async () => {
    setSavingJustificacion(true);
    const { error } = await supabase
      .from("folios")
      .update({ justificacion_tecnica: justificacion } as any)
      .eq("id", folio.id);
    setSavingJustificacion(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Justificación guardada" });
      setEditingJustificacion(false);
      onSaved();
    }
  };

  // ── Dictamen del Responsable Sanitario via Edge Function ──
  const handleDictamen = async (conclusion: "Aprobado" | "Rechazado") => {
    if (conclusion === "Rechazado" && !showRechazoForm) {
      setShowRechazoForm(true);
      return;
    }

    setSavingDictamen(true);
    try {
      const { data, error } = await supabase.functions.invoke("folio-workflow", {
        body: {
          accion: "dictamen",
          folio_id: folio.id,
          conclusion,
          motivo: conclusion === "Rechazado" ? motivoRechazo : "",
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error);
      }

      toast({
        title: conclusion === "Aprobado" ? "✅ Folio aprobado" : "⚠ Folio rechazado — capturista notificado",
        description: data?.mensaje,
      });
      setShowRechazoForm(false);
      setMotivoRechazo("");
      onSaved();
    } catch (err: any) {
      toast({
        title: "Error al emitir dictamen",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingDictamen(false);
    }
  };

  const conclusion = (folio as any).conclusion;
  const puedeEmitirDictamen = esRS && folio.estado === "En Firma";

  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="VI" title={`DICTAMEN DE ${t.beneficio.toUpperCase()} vs RIESGO`} />

      <div className="p-4 space-y-4">
        {/* Pregunta riesgos no aceptables — calculada automáticamente */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-semibold">
            ¿Existen riesgos residuales clasificados como NO ACEPTABLES o ACEPTABLES CON JUSTIFICACIÓN?
          </span>
          <span className="flex items-center gap-1">
            SÍ <span className={`inline-block w-4 h-4 border rounded ${hasNoAceptables ? "bg-foreground" : ""}`} />
          </span>
          <span className="flex items-center gap-1">
            NO <span className={`inline-block w-4 h-4 border rounded ${!hasNoAceptables ? "bg-foreground" : ""}`} />
          </span>
          <span className="text-[10px] text-muted-foreground italic">
            (calculado automáticamente a partir del dictamen de cada riesgo)
          </span>
        </div>

        {/* Justificación técnica */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
              Justificación Técnica — {normaConfig.nombre} ({normaConfig.metodologia})
            </p>
            {!locked && !editingJustificacion && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => setEditingJustificacion(true)}
              >
                <Pencil className="h-3 w-3" /> Editar
              </Button>
            )}
          </div>

          {editingJustificacion ? (
            <div className="space-y-2">
              <Textarea
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                rows={6}
                placeholder={`Explicar por qué el ${t.beneficio.toLowerCase()} supera el riesgo residual identificado, citando estudios, historial, estabilidad, experiencia, bibliografía, evaluación técnica o evidencia objetiva disponible...`}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingJustificacion(false)} className="gap-1">
                  <X className="h-3 w-3" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveJustificacion} disabled={savingJustificacion} className="gap-1">
                  <Save className="h-3 w-3" />
                  {savingJustificacion ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-line border rounded p-3 bg-muted/20 min-h-[80px]">
              {justificacion || <span className="text-muted-foreground/50 italic">Sin justificación registrada</span>}
            </div>
          )}
        </div>

        {/* Conclusión actual */}
        <div className="flex items-center gap-8 border-t pt-3">
          <span className="font-semibold text-sm">CONCLUSIÓN:</span>
          {puedeEditarConclusion ? (
            // Admin y Responsable Sanitario pueden cambiar la conclusión
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`w-4 h-4 border rounded cursor-pointer flex items-center justify-center ${
                    conclusion === "Aprobado" ? "bg-foreground border-foreground" : "border-muted-foreground"
                  }`}
                  onClick={() => {
                    supabase
                      .from("folios")
                      .update({ conclusion: "Aprobado" } as any)
                      .eq("id", folio.id)
                      .then(() => onSaved());
                  }}
                />
                <span className="text-sm">APROBADO</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`w-4 h-4 border rounded cursor-pointer flex items-center justify-center ${
                    conclusion === "Rechazado" ? "bg-foreground border-foreground" : "border-muted-foreground"
                  }`}
                  onClick={() => {
                    supabase
                      .from("folios")
                      .update({ conclusion: "Rechazado" } as any)
                      .eq("id", folio.id)
                      .then(() => onSaved());
                  }}
                />
                <span className="text-sm">RECHAZADO</span>
              </label>
              <span className="text-[10px] text-muted-foreground italic ml-2">
                (editable por Admin y Responsable Sanitario)
              </span>
            </>
          ) : (
            // Vista de solo lectura para otros roles
            <>
              <span className="flex items-center gap-2 text-sm">
                APROBADO{" "}
                <span
                  className={`inline-block w-4 h-4 border rounded ${conclusion === "Aprobado" ? "bg-foreground" : ""}`}
                />
              </span>
              <span className="flex items-center gap-2 text-sm">
                RECHAZADO{" "}
                <span
                  className={`inline-block w-4 h-4 border rounded ${conclusion === "Rechazado" ? "bg-foreground" : ""}`}
                />
              </span>
            </>
          )}
        </div>

        {/* ── ZONA EXCLUSIVA RESPONSABLE SANITARIO ── */}
        {folio.estado === "En Firma" && (
          <div
            className={`border-2 rounded-lg p-4 space-y-3 ${
              esRS ? "border-primary bg-primary/5" : "border-muted bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2">
              {esRS ? (
                <>
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary">Zona de dictamen — {t.aprobadorFinal}</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Dictamen pendiente del {t.aprobadorFinal}
                  </span>
                </>
              )}
            </div>

            {esRS ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Todos los miembros del comité han firmado. Como {t.aprobadorFinal}, emite el dictamen final del
                  folio <strong>{folio.codigo}</strong>.
                </p>

                {/* Formulario de rechazo */}
                {showRechazoForm && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">
                      Motivo de rechazo (se enviará al capturista)
                    </label>
                    <Textarea
                      value={motivoRechazo}
                      onChange={(e) => setMotivoRechazo(e.target.value)}
                      rows={3}
                      placeholder="Describa las correcciones requeridas..."
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    className="gap-2 bg-green-700 hover:bg-green-800"
                    onClick={() => handleDictamen("Aprobado")}
                    disabled={savingDictamen}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {savingDictamen ? "Procesando..." : "Aprobar folio"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => handleDictamen("Rechazado")}
                    disabled={savingDictamen}
                  >
                    <XCircle className="h-4 w-4" />
                    {showRechazoForm ? (savingDictamen ? "Enviando..." : "Confirmar rechazo") : "Rechazar folio"}
                  </Button>
                  {showRechazoForm && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRechazoForm(false);
                        setMotivoRechazo("");
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                El folio está en revisión. El Responsable Sanitario recibirá una notificación cuando todos los miembros
                del comité hayan firmado.
              </p>
            )}
          </div>
        )}

        {/* Resultado final si ya fue dictaminado */}
        {conclusion && folio.estado === "Aprobado" && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle className="h-5 w-5 text-green-700" />
            <span className="text-sm font-medium text-green-800">Folio aprobado por {t.aprobadorFinal}</span>
          </div>
        )}
        {conclusion === "Rechazado" && folio.estado === "Borrador" && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <XCircle className="h-5 w-5 text-red-700" />
            <span className="text-sm font-medium text-red-800">
              Folio rechazado — regresado a Borrador para corrección
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
