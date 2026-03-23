import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Riesgo } from "@/hooks/useFolios";
import { getNPRLevel } from "@/hooks/useFolios";

interface RiesgoFormProps {
  open: boolean;
  onClose: () => void;
  folioId: string;
  riesgo?: Riesgo | null;
  nextNumeroId: number;
}

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

const emptyRiesgo = {
  etapa_proceso: "",
  peligro_modo_falla: "",
  causa_potencial: "",
  efecto_dano: "",
  severidad: 1,
  ocurrencia: 1,
  deteccion: 1,
  controles_actuales: "",
  requiere_accion: false,
  accion_propuesta: "",
  responsable: "",
  fecha_compromiso: "",
  accion_implementada: "",
  fecha_evidencia: "",
  sev_residual: 1,
  ocu_residual: 1,
  det_residual: 1,
  dictamen: "Pendiente" as const,
};

export function RiesgoFormDialog({ open, onClose, folioId, riesgo, nextNumeroId }: RiesgoFormProps) {
  const isEdit = !!riesgo;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() =>
    riesgo
      ? {
          etapa_proceso: riesgo.etapa_proceso,
          peligro_modo_falla: riesgo.peligro_modo_falla,
          causa_potencial: riesgo.causa_potencial,
          efecto_dano: riesgo.efecto_dano,
          severidad: riesgo.severidad,
          ocurrencia: riesgo.ocurrencia,
          deteccion: riesgo.deteccion,
          controles_actuales: riesgo.controles_actuales || "",
          requiere_accion: riesgo.requiere_accion,
          accion_propuesta: riesgo.accion_propuesta || "",
          responsable: riesgo.responsable || "",
          fecha_compromiso: riesgo.fecha_compromiso || "",
          accion_implementada: riesgo.accion_implementada || "",
          fecha_evidencia: riesgo.fecha_evidencia || "",
          sev_residual: riesgo.sev_residual,
          ocu_residual: riesgo.ocu_residual,
          det_residual: riesgo.det_residual,
          dictamen: riesgo.dictamen as "Aceptable" | "No Aceptable" | "Pendiente",
        }
      : { ...emptyRiesgo }
  );

  const npr = form.severidad * form.ocurrencia * form.deteccion;
  const nprResidual = form.sev_residual * form.ocu_residual * form.det_residual;
  const needsAction = form.severidad >= 9 || npr > 150;
  const nprLevel = getNPRLevel(npr, form.severidad);
  const nprResLevel = getNPRLevel(nprResidual, form.sev_residual);

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.etapa_proceso.trim() || !form.peligro_modo_falla.trim()) {
      toast({ title: "Campos requeridos", description: "Etapa del proceso y Peligro/Modo de Falla son obligatorios.", variant: "destructive" });
      return;
    }
    if (needsAction && !form.accion_propuesta.trim()) {
      toast({ title: "Acción requerida", description: "NPR crítico o S ≥ 9: debe capturar una Acción Propuesta.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      folio_id: folioId,
      etapa_proceso: form.etapa_proceso.trim(),
      peligro_modo_falla: form.peligro_modo_falla.trim(),
      causa_potencial: form.causa_potencial.trim(),
      efecto_dano: form.efecto_dano.trim(),
      severidad: form.severidad,
      ocurrencia: form.ocurrencia,
      deteccion: form.deteccion,
      controles_actuales: form.controles_actuales.trim(),
      requiere_accion: form.requiere_accion || needsAction,
      accion_propuesta: form.accion_propuesta.trim(),
      responsable: form.responsable.trim(),
      fecha_compromiso: form.fecha_compromiso || null,
      accion_implementada: form.accion_implementada.trim(),
      fecha_evidencia: form.fecha_evidencia.trim(),
      sev_residual: form.sev_residual,
      ocu_residual: form.ocu_residual,
      det_residual: form.det_residual,
      dictamen: form.dictamen,
    };

    let error;
    if (isEdit && riesgo) {
      ({ error } = await supabase.from("riesgos").update(payload).eq("id", riesgo.id));
    } else {
      ({ error } = await supabase.from("riesgos").insert({ ...payload, numero_id: nextNumeroId }));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isEdit ? "Riesgo actualizado" : "Riesgo agregado" });
      queryClient.invalidateQueries({ queryKey: ["folio", folioId] });
      queryClient.invalidateQueries({ queryKey: ["all-riesgos"] });
      onClose();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Riesgo" : "Agregar Riesgo"} — ID {String(isEdit ? riesgo!.numero_id : nextNumeroId).padStart(2, "0")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section 1: Identification */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">1. Identificación de Peligro y Falla</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa del Proceso *</Label>
                <Input value={form.etapa_proceso} onChange={(e) => update("etapa_proceso", e.target.value)} placeholder="Ej: Calificación de áreas" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Peligro / Modo de Falla *</Label>
                <Input value={form.peligro_modo_falla} onChange={(e) => update("peligro_modo_falla", e.target.value)} placeholder="Ej: Equipos críticos no calificados" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Causa Potencial</Label>
                <Textarea value={form.causa_potencial} onChange={(e) => update("causa_potencial", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Efecto / Daño</Label>
                <Textarea value={form.efecto_dano} onChange={(e) => update("efecto_dano", e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          {/* Section 2: Initial Evaluation */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">2. Evaluación Inicial</h4>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Severidad (S)", field: "severidad" },
                { label: "Ocurrencia (O)", field: "ocurrencia" },
                { label: "Detección (D)", field: "deteccion" },
              ].map(({ label, field }) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Select value={String(form[field as keyof typeof form])} onValueChange={(v) => update(field, Number(v))}>
                    <SelectTrigger className={field === "severidad" && form.severidad >= 9 ? "border-destructive text-destructive" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCORES.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs">NPR Inicial</Label>
                <div className={`h-10 rounded-md border flex items-center justify-center font-bold text-lg ${
                  nprLevel.label === "Crítico" ? "bg-destructive/10 text-destructive border-destructive" :
                  nprLevel.label === "Mayor" ? "bg-warning/10 text-warning border-warning" :
                  "bg-success/10 text-success border-success"
                }`}>
                  {npr}
                </div>
                <p className="text-[10px] text-center">{nprLevel.dot} {nprLevel.label}</p>
              </div>
            </div>
            {needsAction && (
              <p className="text-xs text-destructive font-medium mt-2">⚠ NPR Crítico o S ≥ 9 — se requiere Acción Propuesta obligatoriamente.</p>
            )}
          </div>

          {/* Section 3: Controls */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">3. Controles y Gestión</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Controles Actuales</Label>
                <Textarea value={form.controles_actuales} onChange={(e) => update("controles_actuales", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Acción Propuesta {needsAction && <span className="text-destructive">*</span>}</Label>
                <Textarea value={form.accion_propuesta} onChange={(e) => update("accion_propuesta", e.target.value)} rows={2} className={needsAction && !form.accion_propuesta ? "border-destructive" : ""} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsable</Label>
                <Input value={form.responsable} onChange={(e) => update("responsable", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha Compromiso</Label>
                <Input type="date" value={form.fecha_compromiso} onChange={(e) => update("fecha_compromiso", e.target.value)} />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Switch checked={form.requiere_accion || needsAction} onCheckedChange={(v) => update("requiere_accion", v)} disabled={needsAction} />
                <Label className="text-xs">¿Requiere Acción?</Label>
              </div>
            </div>
          </div>

          {/* Section 4: Residual */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">4. Evaluación Final (Residual)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Acción Implementada</Label>
                <Textarea value={form.accion_implementada} onChange={(e) => update("accion_implementada", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha y Evidencia</Label>
                <Input value={form.fecha_evidencia} onChange={(e) => update("fecha_evidencia", e.target.value)} placeholder="09-Feb-26 / REG-VAL-001" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              {[
                { label: "S'", field: "sev_residual" },
                { label: "O'", field: "ocu_residual" },
                { label: "D'", field: "det_residual" },
              ].map(({ label, field }) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Select value={String(form[field as keyof typeof form])} onValueChange={(v) => update(field, Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCORES.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs">NPR Residual</Label>
                <div className={`h-10 rounded-md border flex items-center justify-center font-bold text-lg ${
                  nprResLevel.label === "Crítico" ? "bg-destructive/10 text-destructive border-destructive" :
                  nprResLevel.label === "Mayor" ? "bg-warning/10 text-warning border-warning" :
                  "bg-success/10 text-success border-success"
                }`}>
                  {nprResidual}
                </div>
                <p className="text-[10px] text-center">{nprResLevel.dot} {nprResLevel.label}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Dictamen</Label>
              <Select value={form.dictamen} onValueChange={(v) => update("dictamen", v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Aceptable">Aceptable</SelectItem>
                  <SelectItem value="No Aceptable">No Aceptable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Actualizar" : "Agregar Riesgo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
