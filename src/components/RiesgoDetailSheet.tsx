import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import type { Riesgo } from "@/hooks/useFolios";
import { getNPRLevel } from "@/hooks/useFolios";
import { getDescripcionSeveridad, getNormaConfig, type TipoEscalaSeveridad } from "@/config/normas";

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className={`text-xs whitespace-pre-line ${mono ? "font-mono" : ""} ${empty ? "text-muted-foreground/60 italic" : ""}`}>
        {empty ? "Sin capturar" : value}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-primary border-b pb-1">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function ScorePill({ label, value, critical = false }: { label: string; value: number; critical?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-md border px-3 py-2 ${critical ? "border-destructive bg-destructive/5" : "bg-muted/30"}`}>
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${critical ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

export function RiesgoDetailSheet({
  riesgo,
  open,
  onClose,
  onEdit,
  canEdit,
}: {
  riesgo: Riesgo | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (r: Riesgo) => void;
  canEdit: boolean;
}) {
  if (!riesgo) return null;
  const r = riesgo;
  const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
  const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
  const level = getNPRLevel(npr, r.severidad);
  const levelRes = getNPRLevel(nprRes, r.sev_residual);
  const tipoEscala = ((r as any).tipo_escala_severidad as TipoEscalaSeveridad) ?? "estandar";
  const sevDesc = getDescripcionSeveridad(r.severidad, tipoEscala, getNormaConfig(null));
  const esSGC = tipoEscala === "sgc_regulatorio";

  const verifEstado = !r.requiere_accion
    ? null
    : r.fecha_verificacion
    ? { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Acción verificada", className: "bg-success/10 text-success border-success/30" }
    : r.accion_propuesta
    ? { icon: <Clock className="h-3.5 w-3.5" />, label: "Acción capturada — verificación pendiente", className: "bg-warning/10 text-warning border-warning/30" }
    : { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Requiere acción — sin capturar", className: "bg-destructive/10 text-destructive border-destructive/30" };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-lg font-bold">
              ID {String(r.numero_id).padStart(2, "0")}
            </span>
            <Badge variant="outline" className="text-[10px]">{r.etapa_proceso || "Sin etapa"}</Badge>
            {verifEstado && (
              <Badge variant="outline" className={`text-[10px] gap-1 ${verifEstado.className}`}>
                {verifEstado.icon} {verifEstado.label}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-sm font-semibold leading-tight">
            {r.peligro_modo_falla || "Sin modo de falla"}
          </SheetTitle>
          <SheetDescription className="text-xs">{r.peligro || ""}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Resumen NPR */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">NPR Inicial</div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${level.label === "Crítico" ? "text-destructive" : level.label === "Mayor" ? "text-warning" : "text-success"}`}>
                  {level.dot} {npr}
                </span>
                <span className="text-xs text-muted-foreground">{level.label}</span>
              </div>
              <div className="flex gap-2">
                <ScorePill label="S" value={r.severidad} critical={r.severidad >= 9} />
                <ScorePill label="O" value={r.ocurrencia} />
                <ScorePill label="D" value={r.deteccion} />
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">NPR Residual</div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${levelRes.label === "Crítico" ? "text-destructive" : levelRes.label === "Mayor" ? "text-warning" : "text-success"}`}>
                  {levelRes.dot} {nprRes}
                </span>
                <span className="text-xs text-muted-foreground">{levelRes.label}</span>
              </div>
              <div className="flex gap-2">
                <ScorePill label="S'" value={r.sev_residual} critical={r.sev_residual >= 9} />
                <ScorePill label="O'" value={r.ocu_residual} />
                <ScorePill label="D'" value={r.det_residual} />
              </div>
            </div>
          </div>

          <Group title="1. Identificación (FEUM / ISO 14971)">
            <Field label="Etapa del proceso" value={r.etapa_proceso} />
            <Field label="Peligro (fuente)" value={r.peligro} />
            <Field label="Situación peligrosa" value={r.situacion_peligrosa} />
            <Field label="Modo de falla" value={r.peligro_modo_falla} />
            <Field label="Secuencia de eventos" value={r.secuencia_eventos} />
            <Field label="Causa potencial" value={r.causa_potencial} />
            <Field label="Efecto / daño" value={r.efecto_dano} />
          </Group>

          <Separator />

          <Group title="2. Evaluación inicial — Justificaciones">
            <Field
              label="Severidad"
              value={
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{`S = ${r.severidad}`}</span>
                    <Badge
                      variant="outline"
                      className={
                        esSGC
                          ? "text-[9px] bg-orange-500/10 text-orange-700 border-orange-500/40"
                          : "text-[9px] bg-primary/10 text-primary border-primary/40"
                      }
                    >
                      {esSGC ? "Escala SGC/Regulatoria" : "Escala Estándar"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {sevDesc.etiqueta} — {sevDesc.descripcion}
                  </div>
                </div>
              }
            />
            <Field label="Ocurrencia" value={`O = ${r.ocurrencia}`} mono />
            <Field label="Detectabilidad" value={r.detectabilidad_aplicable ? `D = ${r.deteccion}` : "No aplica"} mono />
            <div className="sm:col-span-2">
              <Field label="Justificación de aceptabilidad / AFAP" value={r.justificacion_aceptabilidad} />
            </div>
          </Group>

          <Separator />

          <Group title="3. Controles y gestión">
            <Field label="Controles actuales" value={r.controles_actuales} />
            <Field label="Controles de prevención" value={r.controles_prevencion} />
            <Field label="Controles de detección" value={r.controles_deteccion} />
            <Field
              label="¿Requiere acción?"
              value={
                <span className={r.requiere_accion ? "text-destructive font-semibold" : "text-success font-semibold"}>
                  {r.requiere_accion ? "Sí — acción correctiva obligatoria" : "No — controles actuales suficientes"}
                </span>
              }
            />
            <div className="sm:col-span-2">
              <Field label="Acción propuesta" value={r.accion_propuesta} />
            </div>
            <Field label="Responsable" value={r.responsable} />
            <Field label="Fecha compromiso" value={r.fecha_compromiso} />
          </Group>

          <Separator />

          <Group title="4. Evaluación final y verificación">
            <div className="sm:col-span-2">
              <Field label="Acción implementada" value={r.accion_implementada} />
            </div>
            <Field label="Verificado por" value={r.verificado_por} />
            <Field label="Fecha verificación" value={r.fecha_verificacion} />
            <div className="sm:col-span-2">
              <Field label="Resultado de la verificación" value={r.resultado_verificacion} />
            </div>
            <Field label="Fecha evidencia" value={r.fecha_evidencia} />
            <Field
              label="Dictamen"
              value={
                <span
                  className={`font-semibold ${
                    r.dictamen === "No Aceptable" ? "text-destructive" : r.dictamen === "Aceptable" ? "text-success" : "text-warning"
                  }`}
                >
                  {r.dictamen}
                </span>
              }
            />
          </Group>

          {canEdit && onEdit && (
            <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-background border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cerrar
              </Button>
              <Button size="sm" className="gap-1" onClick={() => onEdit(r)}>
                <Pencil className="h-3.5 w-3.5" /> Editar riesgo
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}