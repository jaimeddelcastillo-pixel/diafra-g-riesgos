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
import { CalendarIcon, Upload, FileText, X, HelpCircle, ChevronDown, ChevronUp, ShieldCheck, Settings, FlaskConical, Plus, ArrowUp, ArrowDown, Trash2, Search, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useProfiles } from "@/hooks/useProfiles";
import type { Riesgo } from "@/hooks/useFolios";
import {
  getNormaConfig,
  calcularNPR,
  getNPRLevelByNorma,
  type CatalogoItem,
  CATALOGO_SEVERIDAD_SGC,
  type TipoEscalaSeveridad,
} from "@/config/normas";
import {
  CausaRaizSheet,
  formatCausaPotencial,
  formatJustificacion6M,
  type CausaRaizPayload,
} from "@/components/causa-raiz/CausaRaizSheet";

interface RiesgoFormProps {
  open: boolean;
  onClose: () => void;
  folioId: string;
  riesgo?: Riesgo | null;
  nextNumeroId: number;
  /** Norma del folio (NOM-241 / NOM-059 / MULTI). Si MULTI, fallback NOM-241. */
  normaFolio?: string | null;
  /** Estado del folio padre. El botón de causa raíz solo aparece en Borrador. */
  folioEstado?: string;
  /** Nombre del proceso/equipo del folio padre, para alimentar el análisis. */
  procesoEquipo?: string;
}

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

// ─── Secuencia de Eventos: helpers ────────────────────────────────────────────
/** Normaliza espacios unicode (NBSP, etc.) a espacio simple. */
function normalizarPaso(s: string): string {
  return s
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parsea un texto guardado a array de pasos. Soporta "1. x", "1) x" o un paso por línea. */
function parseSteps(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [""];
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
    .filter((l) => l.length > 0);
  return lines.length > 0 ? lines : [""];
}

/** Serializa los pasos a "1. ...\n2. ...\n3. ..." descartando vacíos. */
function serializeSteps(steps: string[]): string {
  const limpios = steps.map(normalizarPaso).filter((s) => s.length > 0);
  return limpios.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

interface Anexo {
  name: string;
  path: string;
}

// ─── Componente de referencia inline (alimentado por NORMAS_CONFIG) ──────────
function CatalogoInline({
  tipo,
  valorActual,
  datos,
  normaNombre,
}: {
  tipo: "severidad" | "ocurrencia" | "deteccion";
  valorActual: number;
  datos: CatalogoItem[];
  normaNombre: string;
}) {
  const [abierto, setAbierto] = useState(false);

  const tituloBase =
    tipo === "severidad"
      ? "Criterios de Severidad (S)"
      : tipo === "ocurrencia"
        ? "Criterios de Ocurrencia (O)"
        : "Criterios de Detectabilidad (D)";
  const titulo = `${tituloBase} — ${normaNombre}`;

  const filaActual = datos.find((d) => d.valor === valorActual);

  return (
    <div className="mt-1">
      {/* Indicador del valor actual */}
      {filaActual && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1 mb-1">
          <span className="font-mono font-bold text-primary">{valorActual}</span>
          <span className="font-medium">{filaActual.etiqueta}</span>
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
              {titulo}
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
                const esActual = item.valor === valorActual;
                return (
                  <tr
                    key={item.valor}
                    className={`border-b last:border-0 ${esActual ? "bg-primary/8 font-semibold" : "hover:bg-muted/30"}`}
                  >
                    <td className={`p-1.5 text-center font-mono font-bold ${esActual ? "text-primary" : ""}`}>
                      {esActual ? "► " : ""}
                      {item.valor}
                    </td>
                    <td className="p-1.5">{item.etiqueta}</td>
                    <td className="p-1.5">
                      <span className="whitespace-pre-line">{item.descripcion}</span>
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
export function RiesgoFormDialog({ open, onClose, folioId, riesgo, nextNumeroId, normaFolio, folioEstado, procesoEquipo }: RiesgoFormProps) {
  const isEdit = !!riesgo;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profiles } = useProfiles();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("identificacion");
  const [causaRaizOpen, setCausaRaizOpen] = useState(false);
  const [causaRaizAplicado, setCausaRaizAplicado] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolver configuración de norma (MULTI → NOM-241 por default)
  const normaConfig = getNormaConfig(
    normaFolio === "MULTI" || !normaFolio ? "NOM-241" : normaFolio,
  );
  const usaDeteccion = normaConfig.usarDetectabilidad;
  const t = normaConfig.terminologia;

  const [form, setForm] = useState(() => {
    if (riesgo) {
      return {
        // Tab 1 — Identificación
        etapa_proceso: riesgo.etapa_proceso,
        peligro: riesgo.peligro || "",
        situacion_peligrosa: riesgo.situacion_peligrosa || "",
        secuencia_eventos: riesgo.secuencia_eventos || "",
        peligro_modo_falla: riesgo.peligro_modo_falla,
        causa_potencial: riesgo.causa_potencial,
        efecto_dano: riesgo.efecto_dano,
        // Tab 2 — Evaluación inicial
        severidad: riesgo.severidad,
        ocurrencia: riesgo.ocurrencia,
        deteccion: riesgo.deteccion,
        tipo_escala_severidad: (riesgo.tipo_escala_severidad as TipoEscalaSeveridad) ?? "estandar",
        // Tab 3 — Controles
        controles_prevencion: riesgo.controles_prevencion || "",
        controles_deteccion: riesgo.controles_deteccion || "",
        controles_actuales: riesgo.controles_actuales || "",
        requiere_accion: riesgo.requiere_accion,
        accion_propuesta: riesgo.accion_propuesta || "",
        responsable: riesgo.responsable || "",
        fecha_compromiso: riesgo.fecha_compromiso || "",
        justificacion_aceptabilidad: riesgo.justificacion_aceptabilidad || "",
        // Tab 4 — Residual + Verificación
        accion_implementada: riesgo.accion_implementada || "",
        fecha_evidencia: riesgo.fecha_evidencia || "",
        verificado_por: riesgo.verificado_por || "",
        fecha_verificacion: riesgo.fecha_verificacion || "",
        resultado_verificacion: riesgo.resultado_verificacion || "",
        sev_residual: riesgo.sev_residual,
        ocu_residual: riesgo.ocu_residual,
        det_residual: riesgo.det_residual,
        dictamen: riesgo.dictamen as "Aceptable" | "No Aceptable" | "Pendiente",
        anexos: (riesgo.anexos as unknown as Anexo[]) || [],
      };
    }
    return {
      // Tab 1 — Identificación
      etapa_proceso: "",
      peligro: "",
      situacion_peligrosa: "",
      secuencia_eventos: "",
      peligro_modo_falla: "",
      causa_potencial: "",
      efecto_dano: "",
      // Tab 2 — Evaluación inicial
      severidad: 1,
      ocurrencia: 1,
      deteccion: 1,
      tipo_escala_severidad: "estandar" as TipoEscalaSeveridad,
      // Tab 3 — Controles
      controles_prevencion: "",
      controles_deteccion: "",
      controles_actuales: "",
      requiere_accion: false,
      accion_propuesta: "",
      responsable: "",
      fecha_compromiso: "",
      justificacion_aceptabilidad: "",
      // Tab 4 — Residual + Verificación
      accion_implementada: "",
      fecha_evidencia: "",
      verificado_por: "",
      fecha_verificacion: "",
      resultado_verificacion: "",
      sev_residual: 1,
      ocu_residual: 1,
      det_residual: 1,
      dictamen: "Pendiente" as const,
      anexos: [] as Anexo[],
    };
  });

  // ─── Estado local de pasos de la secuencia (sincronizado con form.secuencia_eventos) ──
  const [pasos, setPasos] = useState<string[]>(() => parseSteps(riesgo?.secuencia_eventos));

  const setPasosSync = (next: string[]) => {
    const arr = next.length === 0 ? [""] : next;
    setPasos(arr);
    update("secuencia_eventos", serializeSteps(arr));
  };

  const agregarPaso = () => setPasosSync([...pasos, ""]);
  const eliminarPaso = (idx: number) => setPasosSync(pasos.filter((_, i) => i !== idx));
  const actualizarPaso = (idx: number, value: string) =>
    setPasosSync(pasos.map((p, i) => (i === idx ? value : p)));
  const moverPaso = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= pasos.length) return;
    const next = [...pasos];
    [next[idx], next[target]] = [next[target], next[idx]];
    setPasosSync(next);
  };

  const npr = calcularNPR(form.severidad, form.ocurrencia, form.deteccion, normaConfig.key);
  const nprResidual = calcularNPR(form.sev_residual, form.ocu_residual, form.det_residual, normaConfig.key);
  const needsAction =
    form.severidad >= normaConfig.umbralSeveridadCritica || npr > normaConfig.umbralNPRAlto;
  const nprLevel = getNPRLevelByNorma(npr, form.severidad, normaConfig.key);
  const nprResLevel = getNPRLevelByNorma(nprResidual, form.sev_residual, normaConfig.key);

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
      // Sanitizar nombre: reemplazar espacios y caracteres especiales
      const nombreLimpio = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quitar tildes
        .replace(/[^a-zA-Z0-9._-]/g, "_"); // reemplazar espacios y especiales por _
      const path = `${folioId}/${Date.now()}_${nombreLimpio}`;
      const { error } = await supabase.storage.from("evidencias").upload(path, file);
      if (error) {
        toast({ title: "Error al subir", description: error.message, variant: "destructive" });
      } else {
        newAnexos.push({ name: file.name, path }); // guarda nombre original para mostrar
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
      // Tab 1 — Identificación
      etapa_proceso: form.etapa_proceso.trim(),
      peligro: form.peligro.trim(),
      situacion_peligrosa: form.situacion_peligrosa.trim(),
      secuencia_eventos: form.secuencia_eventos.trim(),
      peligro_modo_falla: form.peligro_modo_falla.trim(),
      causa_potencial: form.causa_potencial.trim(),
      efecto_dano: form.efecto_dano.trim(),
      // Tab 2 — Evaluación inicial
      severidad: form.severidad,
      ocurrencia: form.ocurrencia,
      deteccion: form.deteccion,
      tipo_escala_severidad: form.tipo_escala_severidad,
      // Tab 3 — Controles
      controles_prevencion: form.controles_prevencion.trim(),
      controles_deteccion: form.controles_deteccion.trim(),
      controles_actuales: form.controles_actuales.trim(),
      requiere_accion: form.requiere_accion || needsAction,
      accion_propuesta: form.accion_propuesta.trim(),
      responsable: form.responsable.trim(),
      fecha_compromiso: form.fecha_compromiso || null,
      justificacion_aceptabilidad: form.justificacion_aceptabilidad.trim(),
      // Tab 4 — Residual + Verificación
      accion_implementada: form.accion_implementada.trim(),
      fecha_evidencia: form.fecha_evidencia.trim(),
      verificado_por: form.verificado_por.trim(),
      fecha_verificacion: form.fecha_verificacion || null,
      resultado_verificacion: form.resultado_verificacion.trim(),
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

  // Validación defensiva de fechas — algunos riesgos tienen texto libre en fecha_evidencia
  const parseFecha = (val: string | null | undefined): Date | undefined => {
    if (!val) return undefined;
    // Solo parsear si tiene formato yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const d = new Date(val + "T12:00:00");
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  };

  const fechaCompromisoDate = parseFecha(form.fecha_compromiso);
  const fechaEvidenciaDate = parseFecha(form.fecha_evidencia);

  const puedeAnalizarCausaRaiz = !folioEstado || folioEstado === "Borrador";

  const handleAplicarCausaRaiz = (p: CausaRaizPayload) => {
    setForm((f) => ({
      ...f,
      causa_potencial: formatCausaPotencial(f.causa_potencial, p),
      justificacion_aceptabilidad: formatJustificacion6M(
        f.justificacion_aceptabilidad,
        p,
      ),
    }));
    setCausaRaizAplicado(true);
    toast({
      title: "Análisis aplicado",
      description: `Causa raíz: ${p.causaRaiz}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle>
            {isEdit ? "Editar Riesgo" : "Agregar Riesgo"} — ID{" "}
            {String(isEdit ? riesgo!.numero_id : nextNumeroId).padStart(2, "0")}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 w-full shrink-0">
            <TabsTrigger value="identificacion" className="gap-1.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">1. Identificación</span>
              <span className="sm:hidden">1</span>
            </TabsTrigger>
            <TabsTrigger value="evaluacion" className="gap-1.5 text-xs">
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">2. Evaluación</span>
              <span className="sm:hidden">2</span>
            </TabsTrigger>
            <TabsTrigger value="controles" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">3. Controles</span>
              <span className="sm:hidden">3</span>
            </TabsTrigger>
            <TabsTrigger value="residual" className="gap-1.5 text-xs">
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">4. Residual</span>
              <span className="sm:hidden">4</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Identificación (FEUM / ISO 14971 §5.4) ── */}
          <TabsContent value="identificacion" className="flex-1 overflow-y-auto space-y-3 pt-3">
            <p className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              Requerido por NOM-241 y FEUM (o NOM-059 y FEUM) — Identifique el peligro fuente, la secuencia de eventos y el modo de falla.
            </p>
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
                <Label className="text-xs">
                  Peligro (fuente) *{" "}
                  <span className="text-muted-foreground font-normal normal-case">(energía, condición, agente)</span>
                </Label>
                <Input
                  value={form.peligro}
                  onChange={(e) => update("peligro", e.target.value)}
                  placeholder="Ej: Energía eléctrica descontrolada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Situación Peligrosa *</Label>
                <Textarea
                  value={form.situacion_peligrosa}
                  onChange={(e) => update("situacion_peligrosa", e.target.value)}
                  rows={2}
                  placeholder="Circunstancia en que el peligro puede causar daño"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Secuencia de Eventos</Label>
                <div className="space-y-1.5 rounded-md border border-input bg-background p-2">
                  {pasos.map((paso, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-6 text-xs font-semibold text-muted-foreground tabular-nums text-right">
                        {idx + 1}.
                      </span>
                      <Input
                        value={paso}
                        onChange={(e) => actualizarPaso(idx, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const next = [...pasos];
                            next.splice(idx + 1, 0, "");
                            setPasosSync(next);
                            // Foco al nuevo input en el siguiente tick
                            setTimeout(() => {
                              const inputs = (e.currentTarget.closest("div.space-y-1\\.5")
                                ?.parentElement?.querySelectorAll("input") || []) as NodeListOf<HTMLInputElement>;
                              inputs[idx + 1]?.focus();
                            }, 0);
                          }
                        }}
                        placeholder={`Paso ${idx + 1}`}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => moverPaso(idx, -1)}
                        disabled={idx === 0}
                        title="Subir"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => moverPaso(idx, 1)}
                        disabled={idx === pasos.length - 1}
                        title="Bajar"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => eliminarPaso(idx)}
                        disabled={pasos.length === 1 && !paso.trim()}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={agregarPaso}
                    className="h-7 w-full text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar paso
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  La numeración 1, 2, 3… se genera automáticamente al guardar.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modo de Falla *</Label>
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
                  rows={2}
                  placeholder="Escriba cada causa en una línea separada"
                />
                <div className="flex items-center gap-2">
                  {puedeAnalizarCausaRaiz && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCausaRaizOpen(true)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Analizar causa raíz
                    </Button>
                  )}
                  {causaRaizAplicado && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Análisis aplicado
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{t.efectoDano}</Label>
                <Textarea
                  value={form.efecto_dano}
                  onChange={(e) => update("efecto_dano", e.target.value)}
                  rows={2}
                  placeholder="Describa el daño que puede sufrir el paciente u operador"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setActiveTab("evaluacion")}>
                Siguiente: Evaluación →
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab 2: Evaluación Inicial ── */}
          <TabsContent value="evaluacion" className="flex-1 overflow-y-auto space-y-3 pt-3">
            <p className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              Requerido por NOM-241 y FEUM (o NOM-059 y FEUM) — Evalúe la probabilidad de daño (S × O × D = NPR).
            </p>
            {/* Selector de escala de Severidad */}
            <div className="rounded-md border bg-card p-3 space-y-2">
              <Label className="text-xs font-semibold">Tipo de riesgo (escala de Severidad)</Label>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo-escala"
                    value="estandar"
                    checked={form.tipo_escala_severidad === "estandar"}
                    onChange={() => update("tipo_escala_severidad", "estandar")}
                  />
                  <span className="text-xs">Producto/proceso (Estándar)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo-escala"
                    value="sgc_regulatorio"
                    checked={form.tipo_escala_severidad === "sgc_regulatorio"}
                    onChange={() => update("tipo_escala_severidad", "sgc_regulatorio")}
                  />
                  <span className="text-xs">Documental/regulatorio (SGC)</span>
                </label>
              </div>
              <p className={cn(
                "text-[10px] font-medium rounded px-2 py-0.5 inline-block",
                form.tipo_escala_severidad === "sgc_regulatorio"
                  ? "bg-orange-500/10 text-orange-700 border border-orange-500/30"
                  : "bg-primary/10 text-primary border border-primary/30",
              )}>
                {form.tipo_escala_severidad === "sgc_regulatorio" ? "Escala SGC/Regulatoria" : "Escala Estándar"}
              </p>
            </div>
            <div className={`grid gap-3 ${usaDeteccion ? "grid-cols-4" : "grid-cols-3"}`}>
              <div className="space-y-1.5">
                <Label className="text-xs">Severidad (S)</Label>
                <Select value={String(form.severidad)} onValueChange={(v) => update("severidad", Number(v))}>
                  <SelectTrigger className={form.severidad >= normaConfig.umbralSeveridadCritica ? "border-destructive text-destructive" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <CatalogoInline
                  tipo="severidad"
                  valorActual={form.severidad}
                  datos={form.tipo_escala_severidad === "sgc_regulatorio" ? CATALOGO_SEVERIDAD_SGC : normaConfig.catalogoSeveridad}
                  normaNombre={form.tipo_escala_severidad === "sgc_regulatorio" ? "Escala SGC/Regulatoria" : normaConfig.nombre}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ocurrencia (O)</Label>
                <Select value={String(form.ocurrencia)} onValueChange={(v) => update("ocurrencia", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCORES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <CatalogoInline tipo="ocurrencia" valorActual={form.ocurrencia} datos={normaConfig.catalogoOcurrencia} normaNombre={normaConfig.nombre} />
              </div>
              {usaDeteccion && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Detección (D)</Label>
                  <Select value={String(form.deteccion)} onValueChange={(v) => update("deteccion", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCORES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <CatalogoInline tipo="deteccion" valorActual={form.deteccion} datos={normaConfig.catalogoDetectabilidad} normaNombre={normaConfig.nombre} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">NPR Inicial {usaDeteccion ? "(S×O×D)" : "(S×O)"}</Label>
                <div className={`h-10 rounded-md border flex items-center justify-center font-bold text-lg ${
                  nprLevel.label === "Crítico" ? "bg-destructive/10 text-destructive border-destructive"
                    : nprLevel.label === "Mayor" ? "bg-warning/10 text-warning border-warning"
                    : "bg-success/10 text-success border-success"
                }`}>
                  {npr}
                </div>
                <p className="text-[10px] text-center">{nprLevel.dot} {nprLevel.label}</p>
              </div>
            </div>
            {needsAction && (
              <p className="text-xs text-destructive font-medium">
                ⚠ NPR Crítico o S ≥ {normaConfig.umbralSeveridadCritica} — se requiere Acción Propuesta en la pestaña Controles.
              </p>
            )}
            <div className="flex justify-between pt-2">
              <Button size="sm" variant="outline" onClick={() => setActiveTab("identificacion")}>
                ← Anterior
              </Button>
              <Button size="sm" onClick={() => setActiveTab("controles")}>
                Siguiente: Controles →
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab 3: Controles (FEUM / ISO 14971 §6.2) ── */}
          <TabsContent value="controles" className="flex-1 overflow-y-auto space-y-3 pt-3">
            <p className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              Requerido por NOM-241 y FEUM (o NOM-059 y FEUM) — Documente los controles de prevención y detección existentes, y las acciones propuestas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Controles de Prevención</Label>
                <Textarea
                  value={form.controles_prevencion}
                  onChange={(e) => update("controles_prevencion", e.target.value)}
                  rows={3}
                  placeholder="Controles que reducen la probabilidad de ocurrencia"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Controles de Detección</Label>
                <Textarea
                  value={form.controles_deteccion}
                  onChange={(e) => update("controles_deteccion", e.target.value)}
                  rows={3}
                  placeholder="Controles que permiten detectar el fallo antes de que cause daño"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Controles Actuales (resumen)</Label>
                <Textarea
                  value={form.controles_actuales}
                  onChange={(e) => update("controles_actuales", e.target.value)}
                  rows={2}
                  placeholder="Resumen de todos los controles existentes"
                />
              </div>
              <div className="space-y-1.5 col-span-2 flex items-center gap-2 border rounded-md p-2">
                <Switch
                  checked={form.requiere_accion || needsAction}
                  onCheckedChange={(v) => update("requiere_accion", v)}
                  disabled={needsAction}
                />
                <Label className="text-xs cursor-pointer">
                  ¿Requiere acción de mejora?
                  {needsAction && <span className="text-destructive ml-1">(obligatorio por NPR/S)</span>}
                </Label>
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
                  placeholder="Describa la acción de mejora propuesta"
                />
              </div>
              <div className="space-y-3">
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
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !form.fecha_compromiso && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaCompromisoDate ? format(fechaCompromisoDate, "PPP") : form.fecha_compromiso || "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={fechaCompromisoDate} onSelect={(d) => update("fecha_compromiso", d ? format(d, "yyyy-MM-dd") : "")} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">
                  Justificación de Aceptabilidad{" "}
                  <span className="text-muted-foreground font-normal normal-case">(Reducción al mínimo posible — Requerido por NOM-241 y FEUM o NOM-059 y FEUM)</span>
                </Label>
                <Textarea
                  value={form.justificacion_aceptabilidad}
                  onChange={(e) => update("justificacion_aceptabilidad", e.target.value)}
                  rows={2}
                  placeholder="Si el riesgo es tolerable sin acción adicional, justifique por qué el beneficio supera el riesgo residual"
                />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button size="sm" variant="outline" onClick={() => setActiveTab("evaluacion")}>
                ← Anterior
              </Button>
              <Button size="sm" onClick={() => setActiveTab("residual")}>
                Siguiente: Residual →
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab 4: Evaluación Residual + Verificación (FEUM / ISO 14971 §6.5 / §8) ── */}
          <TabsContent value="residual" className="flex-1 overflow-y-auto space-y-3 pt-3">
            <p className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              Requerido por NOM-241 y FEUM (o NOM-059 y FEUM) — Registre la acción implementada, su verificación y la evaluación residual.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Acción Implementada</Label>
                <Textarea
                  value={form.accion_implementada}
                  onChange={(e) => update("accion_implementada", e.target.value)}
                  rows={3}
                  placeholder="Describa la acción que se implementó"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Resultado de Verificación</Label>
                <Textarea
                  value={form.resultado_verificacion}
                  onChange={(e) => update("resultado_verificacion", e.target.value)}
                  rows={3}
                  placeholder="Evidencia de que la acción fue efectiva"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Verificado por</Label>
                <Select value={form.verificado_por} onValueChange={(v) => update("verificado_por", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar verificador" />
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
                <Label className="text-xs">Fecha de Verificación</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !form.fecha_verificacion && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {parseFecha(form.fecha_verificacion) ? format(parseFecha(form.fecha_verificacion)!, "PPP") : form.fecha_verificacion || "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={parseFecha(form.fecha_verificacion)} onSelect={(d) => update("fecha_verificacion", d ? format(d, "yyyy-MM-dd") : "")} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de Evidencia</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !form.fecha_evidencia && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaEvidenciaDate ? format(fechaEvidenciaDate, "PPP") : form.fecha_evidencia || "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fechaEvidenciaDate} onSelect={(d) => update("fecha_evidencia", d ? format(d, "yyyy-MM-dd") : "")} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ANEXOS — Evidencia (PDF)</Label>
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileUpload} />
                  <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
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
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeAnexo(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* S' O' D' Residual */}
            <div className={`grid gap-3 ${usaDeteccion ? "grid-cols-4" : "grid-cols-3"}`}>
              <div className="space-y-1.5">
                <Label className="text-xs">S' Residual</Label>
                <Select value={String(form.sev_residual)} onValueChange={(v) => update("sev_residual", Number(v))}>
                  <SelectTrigger className={form.sev_residual >= normaConfig.umbralSeveridadCritica ? "border-destructive text-destructive" : ""}><SelectValue /></SelectTrigger>
                  <SelectContent>{SCORES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <CatalogoInline tipo="severidad" valorActual={form.sev_residual} datos={normaConfig.catalogoSeveridad} normaNombre={normaConfig.nombre} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">O' Residual</Label>
                <Select value={String(form.ocu_residual)} onValueChange={(v) => update("ocu_residual", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCORES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <CatalogoInline tipo="ocurrencia" valorActual={form.ocu_residual} datos={normaConfig.catalogoOcurrencia} normaNombre={normaConfig.nombre} />
              </div>
              {usaDeteccion && (
                <div className="space-y-1.5">
                  <Label className="text-xs">D' Residual</Label>
                  <Select value={String(form.det_residual)} onValueChange={(v) => update("det_residual", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SCORES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <CatalogoInline tipo="deteccion" valorActual={form.det_residual} datos={normaConfig.catalogoDetectabilidad} normaNombre={normaConfig.nombre} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">NPR Residual {usaDeteccion ? "(S'×O'×D')" : "(S'×O')"}</Label>
                <div className={`h-10 rounded-md border flex items-center justify-center font-bold text-lg ${
                  nprResLevel.label === "Crítico" ? "bg-destructive/10 text-destructive border-destructive"
                    : nprResLevel.label === "Mayor" ? "bg-warning/10 text-warning border-warning"
                    : "bg-success/10 text-success border-success"
                }`}>
                  {nprResidual}
                </div>
                <p className="text-[10px] text-center">{nprResLevel.dot} {nprResLevel.label}</p>
              </div>
            </div>

            <div className="space-y-1.5">
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

            <div className="flex justify-between pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => setActiveTab("controles")}>
                ← Anterior
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : isEdit ? "Actualizar" : "Agregar Riesgo"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      <CausaRaizSheet
        open={causaRaizOpen}
        onClose={() => setCausaRaizOpen(false)}
        peligro={form.peligro || form.peligro_modo_falla}
        proceso={procesoEquipo || form.etapa_proceso || ""}
        norma={normaFolio || "NOM-241"}
        causaActual={form.causa_potencial}
        onApply={handleAplicarCausaRaiz}
      />
    </Dialog>
  );
}
