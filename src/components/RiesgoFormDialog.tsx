import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, FileText, X, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useProfiles } from "@/hooks/useProfiles";
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

interface Anexo {
  name: string;
  path: string;
}

// ─── Datos de catálogos (mismos que en Catalogos.tsx) ────────────────────────

const severidadData = [
  {
    valor: "10",
    nivel: "Muy Alta / Inevitable",
    descripcion: "Muerte: Falla que puede resultar en muerte o lesión irreversible crítica.",
    complemento: "Clausura total de planta o retiro de mercado (Recall) Clase I.",
  },
  {
    valor: "9",
    nivel: "Muy Alta",
    descripcion: "Lesión Permanente: Daño irreversible o deterioro grave de la salud.",
    complemento: "Suspensión de líneas críticas o Recall Clase II.",
  },
  {
    valor: "8",
    nivel: "Alta",
    descripcion: "Lesión Grave: Requiere intervención médica profesional o quirúrgica.",
    complemento: "Multas regulatorias mayores o pérdida de cliente clave.",
  },
  {
    valor: "7",
    nivel: "Moderadamente Alta",
    descripcion: "Lesión Temporal: Requiere atención médica menor no quirúrgica.",
    complemento: "Retención de lotes completa, desviación crítica.",
  },
  {
    valor: "6",
    nivel: "Moderada",
    descripcion: "Molestia Menor: Incomodidad sin lesión (ej. irritación leve).",
    complemento: "Desperdicio de material alto, reproceso costoso.",
  },
  {
    valor: "5",
    nivel: "Moderada Baja",
    descripcion: "Impacto leve en el proceso sin afectar al paciente.",
    complemento: "Reproceso menor programado.",
  },
  {
    valor: "4",
    nivel: "Baja",
    descripcion: "Insignificante: El paciente lo nota, sin afectar seguridad.",
    complemento: "Reproceso menor en línea, desviación menor.",
  },
  {
    valor: "3",
    nivel: "Baja",
    descripcion: "Sin efecto clínico, solo operativo.",
    complemento: "Ajuste de proceso sin paro.",
  },
  {
    valor: "2",
    nivel: "Remota",
    descripcion: "Ninguno: Sin efecto perceptible.",
    complemento: "Sin impacto operativo.",
  },
  { valor: "1", nivel: "Remota", descripcion: "Sin efecto en paciente ni en proceso.", complemento: "Sin impacto." },
];

const ocurrenciaData = [
  { valor: "10", nivel: "Inevitable", descripcion: "La falla ocurre en casi todos los lotes (> 50%)." },
  { valor: "9", nivel: "Muy Alta", descripcion: "1 de cada 3 lotes o eventos." },
  { valor: "8", nivel: "Alta", descripcion: "Recurrente (1 vez a la semana)." },
  { valor: "7", nivel: "Moderadamente Alta", descripcion: "Frecuente (1 vez al mes)." },
  { valor: "6", nivel: "Moderada Alta", descripcion: "Ocasional (1 vez cada 3 meses)." },
  { valor: "5", nivel: "Moderada", descripcion: "Ocasional (1 vez cada 6 meses)." },
  { valor: "4", nivel: "Baja", descripcion: "Aislada (1 vez al año)." },
  { valor: "3", nivel: "Baja", descripcion: "Muy aislada (cada 2-3 años)." },
  { valor: "2", nivel: "Remota", descripcion: "Históricamente solo 1 vez." },
  { valor: "1", nivel: "Improbable", descripcion: "Históricamente no se ha presentado." },
];

const deteccionData = [
  {
    valor: "10",
    nivel: "Imposible detectar",
    descripcion: "No hay control conocido o la falla no es detectable hasta el uso.",
  },
  { valor: "9", nivel: "Muy difícil", descripcion: "Controles erráticos o inspección visual aleatoria difícil." },
  { valor: "8", nivel: "Difícil", descripcion: "Inspección visual 100% manual (sujeta a error humano)." },
  { valor: "7", nivel: "Difícil", descripcion: "Inspección visual con criterio subjetivo parcialmente documentado." },
  { valor: "6", nivel: "Moderada", descripcion: "Control Estadístico de Proceso (SPC) o muestreo robusto." },
  { valor: "5", nivel: "Moderada", descripcion: "Muestreo establecido con criterios de aceptación documentados." },
  {
    valor: "4",
    nivel: "Moderadamente Alta",
    descripcion: "Detección automatizada que segrega producto defectuoso (Poka-yoke falible).",
  },
  { valor: "3", nivel: "Alta", descripcion: "Sistema automatizado con alarma y segregación confirmada." },
  { valor: "2", nivel: "Muy Alta", descripcion: "Prevención automática por diseño (Poka-yoke infalible)." },
  {
    valor: "1",
    nivel: "Casi cierta",
    descripcion: "Imposible fabricar la pieza mal — detección automatizada infalible.",
  },
];

// ─── Componente de referencia inline ─────────────────────────────────────────
function CatalogoInline({
  tipo,
  valorActual,
}: {
  tipo: "severidad" | "ocurrencia" | "deteccion";
  valorActual: number;
}) {
  const [abierto, setAbierto] = useState(false);

  const datos = tipo === "severidad" ? severidadData : tipo === "ocurrencia" ? ocurrenciaData : deteccionData;

  const titulo =
    tipo === "severidad"
      ? "Criterios de Severidad (S)"
      : tipo === "ocurrencia"
        ? "Criterios de Ocurrencia (O)"
        : "Criterios de Detectabilidad (D)";

  // Fila que coincide con el valor actual
  const filaActual = datos.find((d) => {
    const vals = d.valor.split("-").map(Number);
    return vals.length === 1 ? vals[0] === valorActual : valorActual >= vals[1] && valorActual <= vals[0];
  });

  return (
    <div className="mt-1">
      {/* Indicador del valor actual */}
      {filaActual && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-1">
          <span className="font-mono font-bold text-primary">{valorActual}</span>
          <span className="font-medium">{filaActual.nivel}</span>
          <span className="truncate">— {filaActual.descripcion.split(":")[0]}</span>
        </div>
      )}

      {/* Botón para expandir tabla completa */}
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
        onClick={() => setAbierto(!abierto)}
      >
        <HelpCircle className="h-3 w-3" />
        {abierto ? "Ocultar" : "Ver"} tabla de criterios
        {abierto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Tabla expandible */}
      {abierto && (
        <div className="mt-2 border rounded-md overflow-hidden">
          <div className="bg-muted px-3 py-1.5 border-b">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {titulo} — ISO 14971 / NOM-241
            </p>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-center p-1.5 font-semibold w-10">Valor</th>
                <th className="text-left p-1.5 font-semibold w-32">Nivel</th>
                <th className="text-left p-1.5 font-semibold">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((item) => {
                const vals = item.valor.split("-").map(Number);
                const esActual =
                  vals.length === 1 ? vals[0] === valorActual : valorActual >= vals[1] && valorActual <= vals[0];
                return (
                  <tr
                    key={item.valor}
                    className={`border-b last:border-0 ${esActual ? "bg-primary/8 font-semibold" : "hover:bg-muted/30"}`}
                  >
                    <td className={`p-1.5 text-center font-mono font-bold ${esActual ? "text-primary" : ""}`}>
                      {esActual ? "► " : ""}
                      {item.valor}
                    </td>
                    <td className="p-1.5">{item.nivel}</td>
                    <td className="p-1.5">
                      <span className="whitespace-pre-line">{item.descripcion}</span>
                      {"complemento" in item && item.complemento && (
                        <span className="block text-muted-foreground italic mt-0.5">{item.complemento}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Formulario principal ─────────────────────────────────────────────────────
export function RiesgoFormDialog({ open, onClose, folioId, riesgo, nextNumeroId }: RiesgoFormProps) {
  const isEdit = !!riesgo;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profiles } = useProfiles();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => {
    if (riesgo) {
      return {
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
        anexos: ((riesgo as any).anexos as Anexo[] | null) || [],
      };
    }
    return {
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
      anexos: [] as Anexo[],
    };
  });

  const npr = form.severidad * form.ocurrencia * form.deteccion;
  const nprResidual = form.sev_residual * form.ocu_residual * form.det_residual;
  const needsAction = form.severidad >= 9 || npr > 150;
  const nprLevel = getNPRLevel(npr, form.severidad);
  const nprResLevel = getNPRLevel(nprResidual, form.sev_residual);

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const newAnexos = [...form.anexos];
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast({ title: "Solo archivos PDF", description: `"${file.name}" no es PDF.`, variant: "destructive" });
        continue;
      }
      const path = `${folioId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("evidencias").upload(path, file);
      if (error) {
        toast({ title: "Error al subir", description: error.message, variant: "destructive" });
      } else {
        newAnexos.push({ name: file.name, path });
      }
    }
    update("anexos", newAnexos);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAnexo = (idx: number) => {
    update(
      "anexos",
      form.anexos.filter((_, i) => i !== idx),
    );
  };

  const handleSave = async () => {
    if (!form.etapa_proceso.trim() || !form.peligro_modo_falla.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Etapa del proceso y Peligro/Modo de Falla son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    if (needsAction && !form.accion_propuesta.trim()) {
      toast({
        title: "Acción requerida",
        description: "NPR crítico o S ≥ 9: debe capturar una Acción Propuesta.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload: any = {
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
      anexos: form.anexos,
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

  const fechaCompromisoDate = form.fecha_compromiso ? new Date(form.fecha_compromiso + "T12:00:00") : undefined;
  const fechaEvidenciaDate = form.fecha_evidencia ? new Date(form.fecha_evidencia + "T12:00:00") : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Riesgo" : "Agregar Riesgo"} — ID{" "}
            {String(isEdit ? riesgo!.numero_id : nextNumeroId).padStart(2, "0")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ── Sección 1: Identificación ── */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
              1. Identificación de Peligro y Falla
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa del Proceso *</Label>
                <Input
                  value={form.etapa_proceso}
                  onChange={(e) => update("etapa_proceso", e.target.value)}
                  placeholder="Ej: Calificación de áreas"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Peligro / Modo de Falla *</Label>
                <Input
                  value={form.peligro_modo_falla}
                  onChange={(e) => update("peligro_modo_falla", e.target.value)}
                  placeholder="Ej: Equipos críticos no calificados"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Causa Potencial</Label>
                <Textarea
                  value={form.causa_potencial}
                  onChange={(e) => update("causa_potencial", e.target.value)}
                  rows={3}
                  placeholder="Escriba cada causa en una línea separada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Efecto / Daño</Label>
                <Textarea
                  value={form.efecto_dano}
                  onChange={(e) => update("efecto_dano", e.target.value)}
                  rows={3}
                  placeholder="Escriba cada efecto en una línea separada"
                />
              </div>
            </div>
          </div>

          {/* ── Sección 2: Evaluación Inicial con catálogos inline ── */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
              2. Evaluación Inicial
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {/* Severidad */}
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">Severidad (S)</Label>
                <Select value={String(form.severidad)} onValueChange={(v) => update("severidad", Number(v))}>
                  <SelectTrigger className={form.severidad >= 9 ? "border-destructive text-destructive" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogoInline tipo="severidad" valorActual={form.severidad} />
              </div>

              {/* Ocurrencia */}
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">Ocurrencia (O)</Label>
                <Select value={String(form.ocurrencia)} onValueChange={(v) => update("ocurrencia", Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogoInline tipo="ocurrencia" valorActual={form.ocurrencia} />
              </div>

              {/* Detección */}
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">Detección (D)</Label>
                <Select value={String(form.deteccion)} onValueChange={(v) => update("deteccion", Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogoInline tipo="deteccion" valorActual={form.deteccion} />
              </div>

              {/* NPR Inicial */}
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">NPR Inicial</Label>
                <div
                  className={`h-10 rounded-md border flex items-center justify-center font-bold text-lg ${
                    nprLevel.label === "Crítico"
                      ? "bg-destructive/10 text-destructive border-destructive"
                      : nprLevel.label === "Mayor"
                        ? "bg-warning/10 text-warning border-warning"
                        : "bg-success/10 text-success border-success"
                  }`}
                >
                  {npr}
                </div>
                <p className="text-[10px] text-center">
                  {nprLevel.dot} {nprLevel.label}
                </p>
              </div>
            </div>

            {needsAction && (
              <p className="text-xs text-destructive font-medium mt-2">
                ⚠ NPR Crítico o S ≥ 9 — se requiere Acción Propuesta obligatoriamente.
              </p>
            )}
          </div>

          {/* ── Sección 3: Controles ── */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
              3. Controles y Gestión
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Controles Actuales</Label>
                <Textarea
                  value={form.controles_actuales}
                  onChange={(e) => update("controles_actuales", e.target.value)}
                  rows={3}
                  placeholder="Escriba cada control en una línea separada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Acción Propuesta {needsAction && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  value={form.accion_propuesta}
                  onChange={(e) => update("accion_propuesta", e.target.value)}
                  rows={3}
                  className={needsAction && !form.accion_propuesta ? "border-destructive" : ""}
                  placeholder="Escriba cada acción en una línea separada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsable</Label>
                <Select value={form.responsable} onValueChange={(v) => update("responsable", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map((p) => (
                      <SelectItem key={p.id} value={p.nombre}>
                        {p.nombre} {p.cargo ? `— ${p.cargo}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha Compromiso</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.fecha_compromiso && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.fecha_compromiso ? format(fechaCompromisoDate!, "PPP") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaCompromisoDate}
                      onSelect={(d) => update("fecha_compromiso", d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Switch
                  checked={form.requiere_accion || needsAction}
                  onCheckedChange={(v) => update("requiere_accion", v)}
                  disabled={needsAction}
                />
                <Label className="text-xs">¿Requiere Acción?</Label>
              </div>
            </div>
          </div>

          {/* ── Sección 4: Residual con catálogos inline ── */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
              4. Evaluación Final (Residual)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Acción Implementada</Label>
                <Textarea
                  value={form.accion_implementada}
                  onChange={(e) => update("accion_implementada", e.target.value)}
                  rows={3}
                  placeholder="Escriba cada acción implementada en una línea separada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de Evidencia</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.fecha_evidencia && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.fecha_evidencia ? format(fechaEvidenciaDate!, "PPP") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaEvidenciaDate}
                      onSelect={(d) => update("fecha_evidencia", d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Anexos */}
            <div className="mt-3 space-y-2">
              <Label className="text-xs">ANEXOS — Evidencia (PDF)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3 w-3" />
                  {uploading ? "Subiendo..." : "Adjuntar PDF"}
                </Button>
              </div>
              {form.anexos.length > 0 && (
                <div className="space-y-1">
                  {form.anexos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate flex-1">{a.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => removeAnexo(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* S' O' D' Residual con catálogos */}
            <div className="grid grid-cols-4 gap-3 mt-3">
              {/* S' residual */}
              <div className="space-y-1.5">
                <Label className="text-xs">S' Residual</Label>
                <Select value={String(form.sev_residual)} onValueChange={(v) => update("sev_residual", Number(v))}>
                  <SelectTrigger className={form.sev_residual >= 9 ? "border-destructive text-destructive" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogoInline tipo="severidad" valorActual={form.sev_residual} />
              </div>

              {/* O' residual */}
              <div className="space-y-1.5">
                <Label className="text-xs">O' Residual</Label>
                <Select value={String(form.ocu_residual)} onValueChange={(v) => update("ocu_residual", Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogoInline tipo="ocurrencia" valorActual={form.ocu_residual} />
              </div>

              {/* D' residual */}
              <div className="space-y-1.5">
                <Label className="text-xs">D' Residual</Label>
                <Select value={String(form.det_residual)} onValueChange={(v) => update("det_residual", Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogoInline tipo="deteccion" valorActual={form.det_residual} />
              </div>

              {/* NPR Residual */}
              <div className="space-y-1.5">
                <Label className="text-xs">NPR Residual</Label>
                <div
                  className={`h-10 rounded-md border flex items-center justify-center font-bold text-lg ${
                    nprResLevel.label === "Crítico"
                      ? "bg-destructive/10 text-destructive border-destructive"
                      : nprResLevel.label === "Mayor"
                        ? "bg-warning/10 text-warning border-warning"
                        : "bg-success/10 text-success border-success"
                  }`}
                >
                  {nprResidual}
                </div>
                <p className="text-[10px] text-center">
                  {nprResLevel.dot} {nprResLevel.label}
                </p>
              </div>
            </div>

            {/* Dictamen */}
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Dictamen</Label>
              <Select value={form.dictamen} onValueChange={(v) => update("dictamen", v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Aceptable">Aceptable</SelectItem>
                  <SelectItem value="No Aceptable">No Aceptable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Actualizar" : "Agregar Riesgo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
