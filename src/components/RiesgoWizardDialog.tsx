import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
  Check,
  Bot,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  getNormaConfig,
  calcularNPR,
  getNPRLevelByNorma,
  getDescripcionSeveridad,
  type TipoEscalaSeveridad,
} from "@/config/normas";
import type { NormaKey } from "@/config/normas";
import {
  getEjemplosPeligros,
  getPasosSugeridos,
  getAyudasPaso2,
  getAyudasControles,
  getSeveridadTxt,
  getOcurrenciaTxt,
  getDetectabilidadTxt,
  getFundamentoNormativo,
  POBLACIONES_VULNERABLES,
  getChipsControles,
  getEtiquetasControles,
} from "@/config/wizard-content";
import { WizardAsistente, type WizardApplyField } from "@/components/wizard/WizardAsistente";
import {
  CausaRaizSheet,
  formatJustificacion6M,
  type CausaRaizPayload,
} from "@/components/causa-raiz/CausaRaizSheet";
import { Search } from "lucide-react";
import type { Riesgo } from "@/hooks/useFolios";

interface Props {
  open: boolean;
  onClose: () => void;
  folioId: string;
  folioCodigo: string;
  procesoEquipo: string;
  nextNumeroId: number;
  normaFolio?: string | null;
  /** Tipo de folio actual (SGC, FAB, …). Si está vacío y el usuario elige
   *  "documental/regulatorio", el wizard auto-asigna tipo_folio = "SGC". */
  tipoFolio?: string | null;
  /** Si se recibe, el wizard entra en modo EDICIÓN del riesgo dado. */
  riesgo?: Riesgo | null;
}

type WizardState = {
  // Paso 1
  peligro: string;
  etapa_proceso: string;
  etapa_otra: string;
  peligro_modo_falla: string;
  causas: string[];
  // Paso 2
  pasos: string[];
  situacion_peligrosa: string;
  efecto_dano: string;
  // Paso 3
  severidad: number;
  ocurrencia: number;
  deteccion: number;
  poblacion: string;
  tipo_escala_severidad: TipoEscalaSeveridad;
  // Paso 4
  controles_prev_a: string[];
  controles_prev_b: string[];
  controles_prev_c: string[];
  controles_deteccion: string[];
  sev_residual: number;
  ocu_residual: number;
  det_residual: number;
  accion_propuesta: string;
  responsable: string;
  fecha_compromiso: string;
  justificacion_aceptabilidad: string;
};

function initialState(): WizardState {
  return {
    peligro: "",
    etapa_proceso: "",
    etapa_otra: "",
    peligro_modo_falla: "",
    causas: [""],
    pasos: ["", ""],
    situacion_peligrosa: "",
    efecto_dano: "",
    severidad: 1,
    ocurrencia: 1,
    deteccion: 1,
    poblacion: "",
    tipo_escala_severidad: "estandar",
    controles_prev_a: [""],
    controles_prev_b: [""],
    controles_prev_c: [""],
    controles_deteccion: [""],
    sev_residual: 1,
    ocu_residual: 1,
    det_residual: 1,
    accion_propuesta: "",
    responsable: "",
    fecha_compromiso: "",
    justificacion_aceptabilidad: "",
  };
}

// Parsea texto numerado tipo "1. foo\n2. bar" → ["foo","bar"]
function parseListaNumerada(txt: string | null | undefined): string[] {
  if (!txt) return [];
  return txt
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);
}

// Parsea controles de prevención con prefijo [A]/[B]/[C].
// Líneas sin prefijo van a Nivel A por defecto.
function parseControlesPrev(txt: string | null | undefined): {
  a: string[]; b: string[]; c: string[];
} {
  const lineas = parseListaNumerada(txt);
  const a: string[] = []; const b: string[] = []; const c: string[] = [];
  for (const l of lineas) {
    const m = l.match(/^\[(A|B|C)\]\s*(.*)$/i);
    if (!m) { a.push(l); continue; }
    const v = m[2].trim();
    if (!v) continue;
    if (m[1].toUpperCase() === "A") a.push(v);
    else if (m[1].toUpperCase() === "B") b.push(v);
    else c.push(v);
  }
  return { a, b, c };
}

function parseRiesgoToState(
  r: Riesgo,
  etapasFolio: string[],
): WizardState {
  const causas = parseListaNumerada(r.causa_potencial);
  const pasos = parseListaNumerada(r.secuencia_eventos);
  const prev = parseControlesPrev(r.controles_prevencion);
  const det = parseListaNumerada(r.controles_deteccion);
  const etapaMatch = etapasFolio.includes((r.etapa_proceso || "").trim());
  const pasosFinal = pasos.length >= 2 ? pasos : [...pasos, "", ""].slice(0, 2);
  return {
    peligro: r.peligro || "",
    etapa_proceso: etapaMatch ? r.etapa_proceso! : (r.etapa_proceso ? "__otra__" : ""),
    etapa_otra: etapaMatch ? "" : (r.etapa_proceso || ""),
    peligro_modo_falla: r.peligro_modo_falla || "",
    causas: causas.length ? causas : [""],
    pasos: pasosFinal,
    situacion_peligrosa: r.situacion_peligrosa || "",
    efecto_dano: r.efecto_dano || "",
    severidad: r.severidad ?? 1,
    ocurrencia: r.ocurrencia ?? 1,
    deteccion: r.deteccion ?? 1,
    poblacion: "",
    tipo_escala_severidad: (r.tipo_escala_severidad as TipoEscalaSeveridad) || "estandar",
    controles_prev_a: prev.a.length ? prev.a : [""],
    controles_prev_b: prev.b.length ? prev.b : [""],
    controles_prev_c: prev.c.length ? prev.c : [""],
    controles_deteccion: det.length ? det : [""],
    sev_residual: r.sev_residual ?? r.severidad ?? 1,
    ocu_residual: r.ocu_residual ?? r.ocurrencia ?? 1,
    det_residual: r.det_residual ?? r.deteccion ?? 1,
    accion_propuesta: r.accion_propuesta || "",
    responsable: r.responsable || "",
    fecha_compromiso: r.fecha_compromiso || "",
    justificacion_aceptabilidad: r.justificacion_aceptabilidad || "",
  };
}

const STEPS = [
  { n: 1, t: "Peligro", short: "E1", full: "E1 Peligro" },
  { n: 2, t: "Modo + Causa", short: "E2·5", full: "E2 Modo + E5 Causa" },
  { n: 3, t: "Secuencia", short: "E3", full: "E3 Secuencia" },
  { n: 4, t: "Situación", short: "E4", full: "E4 Situación" },
  { n: 5, t: "Efecto", short: "E6", full: "E6 Efecto" },
  { n: 6, t: "NPR", short: "NPR", full: "NPR" },
  { n: 7, t: "Controles", short: "Ctrl", full: "Controles" },
  { n: 8, t: "Revisión", short: "Rev.", full: "Revisión" },
];

const TOTAL_STEPS = 8;

function ElemBadge({
  num,
  label,
  norma,
  tone,
}: {
  num: string;
  label: string;
  norma?: string;
  tone?: "blue" | "orange" | "neutral";
}) {
  // Tono fijo cuando se especifica (paso 2 con dos badges contrastantes),
  // o derivado de la norma (Cobalt = DM, Naranja = Medicamentos).
  const cls =
    tone === "blue"
      ? "bg-blue-600 text-white border-blue-700"
      : tone === "orange"
        ? "bg-orange-500 text-white border-orange-600"
        : tone === "neutral"
          ? "bg-muted text-muted-foreground border-border"
          : norma === "NOM-059"
            ? "bg-orange-500 text-white border-orange-600"
            : "bg-primary text-primary-foreground border-primary";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
        cls,
      )}
    >
      <span className="font-mono">{num}</span>
      <span>{label}</span>
    </span>
  );
}

function ListaMulti({
  items,
  setItems,
  placeholder,
  min = 1,
  max = 20,
}: {
  items: string[];
  setItems: (i: string[]) => void;
  placeholder: string;
  min?: number;
  max?: number;
}) {
  const add = () => items.length < max && setItems([...items, ""]);
  const remove = (i: number) =>
    items.length > min && setItems(items.filter((_, idx) => idx !== i));
  const upd = (i: number, v: string) =>
    setItems(items.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex h-10 w-8 items-center justify-center rounded-md bg-muted text-xs font-mono text-muted-foreground">
            {i + 1}
          </div>
          <Input
            value={v}
            onChange={(e) => upd(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          {items.length > min && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ))}
      {items.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      )}
    </div>
  );
}

function NPRPanel({
  npr,
  s,
  norma,
  compact = false,
}: {
  npr: number;
  s: number;
  norma: string;
  compact?: boolean;
}) {
  const lvl = getNPRLevelByNorma(npr, s, norma);
  const bg =
    lvl.label === "Crítico"
      ? "bg-npr-critical"
      : lvl.label === "Mayor"
        ? "bg-npr-high"
        : "bg-npr-low";
  return (
    <div
      className={cn(
        "rounded-lg text-white text-center transition-colors duration-300 shadow-md",
        bg,
        compact ? "p-3" : "p-5",
      )}
    >
      <div className={cn("font-mono font-bold", compact ? "text-2xl" : "text-4xl")}>
        NPR = {npr}
      </div>
      <div className={cn("font-semibold mt-1", compact ? "text-xs" : "text-sm")}>
        {lvl.dot} {lvl.label.toUpperCase()}
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  description,
  thumbBig = true,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description: string;
  thumbBig?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <span className="font-mono text-2xl font-bold text-primary">{value}</span>
      </div>
      <Slider
        min={1}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        className={cn(
          thumbBig &&
            "[&_[role=slider]]:h-7 [&_[role=slider]]:w-7 [&_[role=slider]]:border-[3px]",
        )}
      />
      <p className="text-xs text-muted-foreground min-h-[1rem]">{description}</p>
    </div>
  );
}

export function RiesgoWizardDialog({
  open,
  onClose,
  folioId,
  folioCodigo,
  procesoEquipo,
  nextNumeroId,
  normaFolio,
  tipoFolio,
  riesgo,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [s, setS] = useState<WizardState>(initialState);
  const [saving, setSaving] = useState(false);
  const [asistenteAbierto, setAsistenteAbierto] = useState(false);
  const [vistaMovil, setVistaMovil] = useState<"wizard" | "chat">("wizard");
  const [causaRaizOpen, setCausaRaizOpen] = useState(false);
  const [causaRaizAplicado, setCausaRaizAplicado] = useState(false);
  const [extraJustificacion, setExtraJustificacion] = useState("");
  const [residualesEditados, setResidualesEditados] = useState(false);

  const modoEdicion = !!riesgo;
  const numeroIdMostrar = riesgo?.numero_id ?? nextNumeroId;

  const normaConfig = getNormaConfig(normaFolio);
  const usaDet = normaConfig.usarDetectabilidad;
  const normaKey = normaConfig.key;

  const etapasFolio = useMemo(
    () =>
      (procesoEquipo || "")
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean),
    [procesoEquipo],
  );

  // Hidratar estado al abrir en modo edición
  useEffect(() => {
    if (!open) return;
    if (riesgo) {
      setS(parseRiesgoToState(riesgo, etapasFolio));
      setResidualesEditados(true);
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, riesgo?.id]);

  // === Borrador / cierre seguro ============================================
  const draftKey = useMemo(() => {
    if (!folioId) return null;
    return modoEdicion && riesgo
      ? `tracea:wizard:draft:edit:${riesgo.id}`
      : `tracea:wizard:draft:new:${folioId}`;
  }, [modoEdicion, riesgo?.id, folioId]);

  // Snapshot inicial para detectar cambios (en edición, contra el riesgo cargado).
  const snapshotInicialRef = useRef<string>("");
  useEffect(() => {
    if (!open) return;
    const base = riesgo ? parseRiesgoToState(riesgo, etapasFolio) : initialState();
    snapshotInicialRef.current = JSON.stringify(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, riesgo?.id]);

  const isDirty = useMemo(() => {
    if (!open) return false;
    return JSON.stringify(s) !== snapshotInicialRef.current;
  }, [s, open]);

  const clearDraft = () => {
    if (draftKey) {
      try { localStorage.removeItem(draftKey); } catch { /* noop */ }
    }
  };

  // Auto-guardado de borrador con debounce
  useEffect(() => {
    if (!open || !draftKey || !isDirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            s,
            step,
            extraJustificacion,
            residualesEditados,
            causaRaizAplicado,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch { /* quota / privado */ }
    }, 600);
    return () => clearTimeout(t);
  }, [open, draftKey, isDirty, s, step, extraJustificacion, residualesEditados, causaRaizAplicado]);

  // Banner de recuperación al abrir (solo creación)
  const [borradorRecuperable, setBorradorRecuperable] = useState<{
    savedAt: string;
    payload: any;
  } | null>(null);
  useEffect(() => {
    if (!open) { setBorradorRecuperable(null); return; }
    if (modoEdicion) return;
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.s) {
        setBorradorRecuperable({ savedAt: parsed.savedAt, payload: parsed });
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey, modoEdicion]);

  const recuperarBorrador = () => {
    if (!borradorRecuperable) return;
    const p = borradorRecuperable.payload;
    setS(p.s as WizardState);
    setStep(p.step ?? 1);
    if (typeof p.extraJustificacion === "string") setExtraJustificacion(p.extraJustificacion);
    if (typeof p.residualesEditados === "boolean") setResidualesEditados(p.residualesEditados);
    if (typeof p.causaRaizAplicado === "boolean") setCausaRaizAplicado(p.causaRaizAplicado);
    setBorradorRecuperable(null);
    toast({ title: "Borrador recuperado", description: "Continúa donde te quedaste." });
  };
  const descartarBorrador = () => {
    clearDraft();
    setBorradorRecuperable(null);
  };

  // Aviso del navegador al recargar/cerrar pestaña si hay cambios sin guardar
  useEffect(() => {
    if (!open || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, isDirty]);

  // Confirmación al cerrar
  const [confirmCerrarOpen, setConfirmCerrarOpen] = useState(false);
  const intentarCerrar = () => {
    if (isDirty) {
      setConfirmCerrarOpen(true);
      return;
    }
    reset();
    onClose();
  };
  const salirGuardandoBorrador = () => {
    // El borrador ya fue persistido por el efecto; solo cerramos.
    setConfirmCerrarOpen(false);
    reset();
    onClose();
  };
  const salirDescartando = () => {
    clearDraft();
    setConfirmCerrarOpen(false);
    reset();
    onClose();
  };

  const npr = calcularNPR(s.severidad, s.ocurrencia, usaDet ? s.deteccion : 1, normaKey);
  const nprRes = calcularNPR(
    s.sev_residual,
    s.ocu_residual,
    usaDet ? s.det_residual : 1,
    normaKey,
  );
  // La obligación de acción correctiva se evalúa contra el NPR/severidad INICIAL
  // (antes de aplicar acciones). El residual sólo dispara una advertencia AFAP.
  const requiereAccion =
    npr >= normaConfig.umbralNPRMedio || s.severidad >= normaConfig.umbralSeveridadCritica;

  // Mientras el usuario no toque los sliders residuales, se sincronizan con los
  // iniciales para que el NPR residual quede documentado aunque sea igual.
  useEffect(() => {
    if (residualesEditados) return;
    setS((prev) => {
      if (
        prev.sev_residual === prev.severidad &&
        prev.ocu_residual === prev.ocurrencia &&
        prev.det_residual === prev.deteccion
      ) {
        return prev;
      }
      return {
        ...prev,
        sev_residual: prev.severidad,
        ocu_residual: prev.ocurrencia,
        det_residual: prev.deteccion,
      };
    });
  }, [s.severidad, s.ocurrencia, s.deteccion, residualesEditados]);

  // Validaciones por paso
  const canAdvance = (st: number): boolean => {
    if (st === 1) {
      const etapa = s.etapa_proceso === "__otra__" ? s.etapa_otra.trim() : s.etapa_proceso.trim();
      return s.peligro.trim().length > 0 && etapa.length > 0;
    }
    if (st === 2) {
      return (
        s.peligro_modo_falla.trim().length > 0 &&
        s.causas.filter((c) => c.trim()).length >= 1
      );
    }
    if (st === 3) return s.pasos.filter((p) => p.trim()).length >= 2;
    if (st === 4) return s.situacion_peligrosa.trim().length > 0;
    if (st === 5) return s.efecto_dano.trim().length > 0;
    if (st === 6) {
      if (requiereAccion) {
        return (
          s.accion_propuesta.trim().length > 0 &&
          s.responsable.trim().length > 0 &&
          s.fecha_compromiso.length > 0
        );
      }
      return true;
    }
    if (st === 7) return true;
    return true;
  };

  const reset = () => {
    setS(initialState());
    setStep(1);
  };

  const persist = async (): Promise<boolean> => {
    setSaving(true);
    const etapaFinal =
      s.etapa_proceso === "__otra__" ? s.etapa_otra.trim() : s.etapa_proceso.trim();
    const causasTxt = s.causas
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c, i) => `${i + 1}. ${c}`)
      .join("\n");
    const pasosTxt = s.pasos
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p, i) => `${i + 1}. ${p}`)
      .join("\n");
    const prefijar = (arr: string[], nivel: "A" | "B" | "C") =>
      arr
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => `[${nivel}] ${c}`);
    const prevLineas = [
      ...prefijar(s.controles_prev_a, "A"),
      ...prefijar(s.controles_prev_b, "B"),
      ...prefijar(s.controles_prev_c, "C"),
    ];
    const prevTxt = prevLineas.map((c, i) => `${i + 1}. ${c}`).join("\n");
    const detTxt = s.controles_deteccion
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c, i) => `${i + 1}. ${c}`)
      .join("\n");

    const payload: Record<string, unknown> = {
      etapa_proceso: etapaFinal,
      peligro: s.peligro.trim(),
      situacion_peligrosa: s.situacion_peligrosa.trim(),
      secuencia_eventos: pasosTxt,
      peligro_modo_falla: s.peligro_modo_falla.trim(),
      causa_potencial: causasTxt,
      efecto_dano: s.efecto_dano.trim(),
      severidad: s.severidad,
      ocurrencia: s.ocurrencia,
      deteccion: usaDet ? s.deteccion : 1,
      tipo_escala_severidad: s.tipo_escala_severidad,
      detectabilidad_aplicable: usaDet,
      controles_prevencion: prevTxt,
      controles_deteccion: detTxt,
      controles_actuales: [prevTxt, detTxt].filter(Boolean).join("\n\n"),
      requiere_accion: requiereAccion,
      accion_propuesta: s.accion_propuesta.trim(),
      responsable: s.responsable.trim(),
      fecha_compromiso: s.fecha_compromiso || null,
      justificacion_aceptabilidad: s.justificacion_aceptabilidad.trim(),
      sev_residual: s.sev_residual,
      ocu_residual: s.ocu_residual,
      det_residual: usaDet ? s.det_residual : 1,
    };

    if (extraJustificacion.trim()) {
      payload.justificacion_aceptabilidad = [
        payload.justificacion_aceptabilidad,
        extraJustificacion.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    if (modoEdicion && riesgo) {
      const { error } = await supabase
        .from("riesgos")
        .update(payload as any)
        .eq("id", riesgo.id);
      setSaving(false);
      if (error) {
        toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
        return false;
      }
      qc.invalidateQueries({ queryKey: ["folio", folioId] });
      qc.invalidateQueries({ queryKey: ["all-riesgos"] });
      toast({
        title: `ID #${numeroIdMostrar} actualizado correctamente`,
        description: `Wizard ${normaKey}`,
      });
      return true;
    }

    const insertPayload = {
      ...payload,
      folio_id: folioId,
      numero_id: nextNumeroId,
      dictamen: "Pendiente" as const,
    };
    const { error } = await supabase.from("riesgos").insert(insertPayload as any);
    setSaving(false);
    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["folio", folioId] });
    qc.invalidateQueries({ queryKey: ["all-riesgos"] });
    toast({ title: `ID #${nextNumeroId} agregado`, description: `Wizard ${normaKey}` });
    return true;
  };

  const handleGuardar = async () => {
    if (modoEdicion) {
      // Validación mínima antes de UPDATE
      const etapaFinal =
        s.etapa_proceso === "__otra__" ? s.etapa_otra.trim() : s.etapa_proceso.trim();
      const faltas: { paso: number; msg: string }[] = [];
      if (!s.peligro.trim() || !etapaFinal) faltas.push({ paso: 1, msg: "Peligro y etapa son obligatorios" });
      if (!s.situacion_peligrosa.trim()) faltas.push({ paso: 4, msg: "Situación peligrosa es obligatoria" });
      if (!s.efecto_dano.trim()) faltas.push({ paso: 5, msg: "Efecto / daño es obligatorio" });
      if (faltas.length) {
        toast({
          title: "Faltan campos obligatorios",
          description: faltas.map((f) => `Paso ${f.paso}: ${f.msg}`).join(" · "),
          variant: "destructive",
        });
        setStep(faltas[0].paso);
        return;
      }
    }
    const ok = await persist();
    if (ok) {
      reset();
      clearDraft();
      onClose();
    }
  };
  const handleGuardarYOtro = async () => {
    const ok = await persist();
    if (ok) { reset(); clearDraft(); }
  };
  const handleGuardarYAsistente = async () => {
    const ok = await persist();
    if (ok) {
      reset();
      clearDraft();
      onClose();
      window.dispatchEvent(
        new CustomEvent("tracea:open-assistant", { detail: { folioId, folioCodigo } }),
      );
    }
  };

  const lvl = getNPRLevelByNorma(npr, s.severidad, normaKey);
  const lvlRes = getNPRLevelByNorma(nprRes, s.sev_residual, normaKey);
  const sevCritica = s.severidad >= normaConfig.umbralSeveridadCritica;
  const sugerirSPlus =
    normaKey === "NOM-059" &&
    s.severidad >= 8 &&
    s.severidad < 10 &&
    POBLACIONES_VULNERABLES.find((p) => p.valor === s.poblacion)?.vulnerable;

  const ayudas2 = getAyudasPaso2(normaKey);
  const ayudasC = getAyudasControles(normaKey);

  const construirContextoIA = () => {
    const etapa = s.etapa_proceso === "__otra__" ? s.etapa_otra : s.etapa_proceso;
    const causas = s.causas.filter((c) => c.trim()).join("; ");
    const pasos = s.pasos.filter((p) => p.trim()).join(" → ");
    const lineas: string[] = [];

    if (modoEdicion && riesgo) {
      lineas.push(
        `*[EDITANDO ID: ${riesgo.numero_id}]* *[FOLIO: ${folioCodigo}]* *[PELIGRO ACTUAL: ${riesgo.peligro}]* *[MODO_FALLA ACTUAL: ${riesgo.peligro_modo_falla}]* *[SITUACION ACTUAL: ${riesgo.situacion_peligrosa}]* *[SECUENCIA ACTUAL: ${riesgo.secuencia_eventos}]* *[CAUSA ACTUAL: ${riesgo.causa_potencial}]* *[EFECTO ACTUAL: ${riesgo.efecto_dano}]* *[S=${riesgo.severidad} O=${riesgo.ocurrencia} D=${riesgo.deteccion} NPR=${riesgo.npr ?? "N/D"}]* *[ESCALA: ${riesgo.tipo_escala_severidad}]* *[CONTROLES ACTUALES: ${riesgo.controles_actuales ?? "—"}]*`,
        `Estás editando el ID #${numeroIdMostrar} (${folioCodigo}) — el usuario puede modificar cualquier campo. Sugiere mejoras específicas sobre los valores actuales.`
      );
    } else {
      lineas.push(`ID en creación: #${nextNumeroId} — Paso actual del wizard: ${step} de ${TOTAL_STEPS}`);
    }

    lineas.push(
      `Folio: ${folioCodigo} — Proceso: ${procesoEquipo || "N/D"}`,
      `Norma: ${normaConfig.nombre} (${normaKey}) — Detectabilidad: ${usaDet ? "sí" : "no"}`,
      `Datos capturados hasta ahora:`,
      `• Peligro: ${s.peligro || "—"}`,
      `• Etapa: ${etapa || "—"}`,
      `• Modo de falla: ${s.peligro_modo_falla || "—"}`,
      `• Causas: ${causas || "—"}`,
      `• Secuencia: ${pasos || "—"}`,
      `• Situación peligrosa: ${s.situacion_peligrosa || "—"}`,
      `• Efecto/daño: ${s.efecto_dano || "—"}`,
      `• S=${s.severidad}, O=${s.ocurrencia}${usaDet ? `, D=${s.deteccion}` : ""} → NPR=${npr}`,
      `• Controles prevención: ${[
        ...s.controles_prev_a.filter((x) => x.trim()).map((x) => `[A] ${x}`),
        ...s.controles_prev_b.filter((x) => x.trim()).map((x) => `[B] ${x}`),
        ...s.controles_prev_c.filter((x) => x.trim()).map((x) => `[C] ${x}`),
      ].join("; ") || "—"}`,
      `• Controles detección: ${s.controles_deteccion.filter((x) => x.trim()).join("; ") || "—"}`,
      `• NPR residual: ${nprRes}`,
    );

    return lineas.join("\n");
  };

  const aplicarSugerencia = (field: WizardApplyField, value: string | number) => {
    setS((prev) => {
      const next = { ...prev };
      switch (field) {
        case "severidad":
          next.severidad = Math.max(1, Math.min(10, Number(value) || 1));
          break;
        case "ocurrencia":
          next.ocurrencia = Math.max(1, Math.min(10, Number(value) || 1));
          break;
        case "deteccion":
          next.deteccion = Math.max(1, Math.min(10, Number(value) || 1));
          break;
        case "peligro":
          next.peligro = String(value);
          break;
        case "peligro_modo_falla":
          next.peligro_modo_falla = String(value);
          break;
        case "situacion_peligrosa":
          next.situacion_peligrosa = String(value);
          break;
        case "efecto_dano":
          next.efecto_dano = String(value);
          break;
        case "causa": {
          const causas = prev.causas.filter((c) => c.trim());
          next.causas = [...causas, String(value)];
          break;
        }
        case "control_prevencion": {
          const arr = prev.controles_prev_b.filter((c) => c.trim());
          next.controles_prev_b = [...arr, String(value)];
          break;
        }
        case "control_deteccion": {
          const arr = prev.controles_deteccion.filter((c) => c.trim());
          next.controles_deteccion = [...arr, String(value)];
          break;
        }
        case "accion_propuesta":
          next.accion_propuesta = String(value);
          break;
      }
      return next;
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) intentarCerrar(); }}>
      <DialogContent
        onEscapeKeyDown={(e) => { if (isDirty) { e.preventDefault(); setConfirmCerrarOpen(true); } }}
        onPointerDownOutside={(e) => { if (isDirty) { e.preventDefault(); setConfirmCerrarOpen(true); } }}
        onInteractOutside={(e) => { if (isDirty) { e.preventDefault(); setConfirmCerrarOpen(true); } }}
        className={cn(
          "p-0 flex flex-col gap-0 overflow-hidden w-[96vw] h-[95vh] sm:h-auto sm:max-h-[92vh]",
          asistenteAbierto ? "max-w-6xl" : "max-w-4xl",
        )}
      >
        {borradorRecuperable && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-xs">
            <div className="text-amber-900">
              <strong>Borrador encontrado</strong>
              {borradorRecuperable.savedAt && (
                <> · guardado el {new Date(borradorRecuperable.savedAt).toLocaleString()}</>
              )}
              . ¿Continuar donde te quedaste?
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={descartarBorrador}>
                Descartar
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={recuperarBorrador}>
                Recuperar
              </Button>
            </div>
          </div>
        )}
        {/* Header con barra de progreso */}
        <div className="border-b bg-primary text-primary-foreground p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold truncate pr-2">
              {modoEdicion ? (
                <>
                  Editando ID #{String(numeroIdMostrar).padStart(2, "0")}
                  {s.peligro ? ` — ${s.peligro.slice(0, 48)}` : ""}
                </>
              ) : (
                <>Nuevo ID #{String(nextNumeroId).padStart(2, "0")} — Paso {step} de {TOTAL_STEPS}</>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={asistenteAbierto ? "default" : "secondary"}
                onClick={() => {
                  const next = !asistenteAbierto;
                  setAsistenteAbierto(next);
                  if (next) setVistaMovil("chat");
                  else setVistaMovil("wizard");
                }}
                className="h-7 gap-1.5 text-xs"
                title="Consultar Asistente IA en paralelo"
              >
                {asistenteAbierto ? <X className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                {asistenteAbierto ? "Cerrar" : "Consultar"} Asistente
              </Button>
              <Badge variant="secondary" className="text-[10px]">
                {normaConfig.nombre}
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {STEPS.map((st) => (
                <button
                  key={st.n}
                  type="button"
                  onClick={() => {
                    if (modoEdicion || st.n < step) setStep(st.n);
                  }}
                  disabled={!modoEdicion && st.n > step}
                  className={cn(
                    "flex-1 h-2 rounded-full transition-colors",
                    st.n === step
                      ? "bg-accent"
                      : modoEdicion || st.n < step
                        ? "bg-accent/70 cursor-pointer hover:bg-accent"
                        : "bg-primary-foreground/20",
                  )}
                  aria-label={`Paso ${st.n}: ${st.full}`}
                />
              ))}
            </div>
            <div className="hidden sm:flex gap-1 text-[10px] font-medium">
              {STEPS.map((st) => (
                <div
                  key={st.n}
                  className={cn(
                    "flex-1 text-center truncate",
                    st.n === step
                      ? "text-accent font-bold"
                      : "text-primary-foreground/60",
                  )}
                >
                  {st.full}
                </div>
              ))}
            </div>
            <div className="flex sm:hidden gap-1 text-[9px] font-medium">
              {STEPS.map((st) => (
                <div
                  key={st.n}
                  className={cn(
                    "flex-1 text-center truncate",
                    st.n === step
                      ? "text-accent font-bold"
                      : "text-primary-foreground/60",
                  )}
                >
                  {st.short}
                </div>
              ))}
            </div>
          </div>
          {/* Tabs móviles cuando el asistente está abierto */}
          {asistenteAbierto && (
            <div className="md:hidden mt-3 flex gap-1.5 bg-primary-foreground/10 rounded-md p-1">
              <button
                type="button"
                onClick={() => setVistaMovil("wizard")}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-sm font-medium transition-colors",
                  vistaMovil === "wizard"
                    ? "bg-primary-foreground text-primary"
                    : "text-primary-foreground/70",
                )}
              >
                Wizard
              </button>
              <button
                type="button"
                onClick={() => setVistaMovil("chat")}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-sm font-medium transition-colors inline-flex items-center justify-center gap-1",
                  vistaMovil === "chat"
                    ? "bg-primary-foreground text-primary"
                    : "text-primary-foreground/70",
                )}
              >
                <Bot className="h-3 w-3" /> Asistente
              </button>
            </div>
          )}
        </div>

        {/* Split layout: wizard | asistente */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          <div
            className={cn(
              "flex-1 min-h-0 flex flex-col",
              asistenteAbierto && "md:flex-[3]",
              asistenteAbierto && vistaMovil === "chat" && "hidden md:flex",
            )}
          >

        {/* Contenido del paso */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Elemento 1 de 6
                  </div>
                  <h3 className="text-xl font-bold">PELIGRO</h3>
                  <p className="text-sm text-muted-foreground">
                    La fuente del daño. Siempre un sustantivo — nunca una acción.
                  </p>
                </div>
                <ElemBadge num="E1" label="Peligro" norma={normaKey} />
              </div>

              <div className="space-y-2">
                <Label>¿Cuál es el peligro? *</Label>
                <Input
                  value={s.peligro}
                  onChange={(e) => setS({ ...s, peligro: e.target.value })}
                  placeholder="Ej: Residuo químico, Bacteria, Falla eléctrica, Error humano..."
                />
                <p className="text-xs text-muted-foreground">
                  ✅ Residuo de API &nbsp;&nbsp; ❌ No limpiar el equipo
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {getEjemplosPeligros(normaKey).map((ej) => (
                    <button
                      key={ej}
                      type="button"
                      onClick={() => setS({ ...s, peligro: ej })}
                      className="text-[11px] rounded-full border border-input bg-muted/40 hover:bg-accent hover:text-accent-foreground px-2.5 py-1 transition-colors"
                    >
                      {ej}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>¿En qué etapa del proceso ocurre? *</Label>
                <Select
                  value={s.etapa_proceso}
                  onValueChange={(v) => setS({ ...s, etapa_proceso: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {etapasFolio.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                    <SelectItem value="__otra__">Otra etapa…</SelectItem>
                  </SelectContent>
                </Select>
                {s.etapa_proceso === "__otra__" && (
                  <Input
                    value={s.etapa_otra}
                    onChange={(e) => setS({ ...s, etapa_otra: e.target.value })}
                    placeholder="Describe la etapa"
                  />
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 max-w-2xl mx-auto">
              {/* Bloque 1 — Modo de falla */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <ElemBadge num="E2" label="Modo de falla" tone="blue" />
                    <h3 className="text-base font-bold mt-2">
                      ¿Cómo falla específicamente el proceso o componente?
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      El mecanismo exacto — no el peligro ni la causa.
                    </p>
                  </div>
                </div>
                <Input
                  value={s.peligro_modo_falla}
                  onChange={(e) => setS({ ...s, peligro_modo_falla: e.target.value })}
                  placeholder="Ej: Ciclo de enjuague incompleto por falla del temporizador"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Origen raíz
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Bloque 2 — Causa potencial */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <ElemBadge num="E5" label="Causa potencial" tone="orange" />
                    <h3 className="text-base font-bold mt-2">
                      ¿Por qué ocurre ese fallo? (origen raíz)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Una causa por línea. Si la respuesta es "error humano" — pregunta por qué
                      ocurre ese error.
                    </p>
                  </div>
                </div>
                <ListaMulti
                  items={s.causas}
                  setItems={(i) => setS({ ...s, causas: i })}
                  placeholder="Ej: Falta de mantenimiento preventivo"
                />
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCausaRaizOpen(true)}
                    disabled={!s.peligro.trim()}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Analizar causa raíz
                  </Button>
                  {causaRaizAplicado && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-medium">
                      <Check className="h-3 w-3" /> Análisis aplicado
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Elemento 3 de 6
                  </div>
                  <h3 className="text-xl font-bold">SECUENCIA DE EVENTOS</h3>
                  <p className="text-sm text-muted-foreground">
                    La cadena causal paso a paso — cómo evoluciona el peligro hasta llegar al
                    paciente.
                  </p>
                </div>
                <ElemBadge num="E3" label="Secuencia" norma={normaKey} />
              </div>

              <div className="space-y-2">
                <Label>Pasos de la secuencia (mínimo 3) *</Label>
                <p className="text-xs text-muted-foreground">
                  {ayudas2.secuencia} Incluye en qué momento fallan los controles existentes.
                </p>
                <ListaMulti
                  items={s.pasos}
                  setItems={(i) => setS({ ...s, pasos: i })}
                  placeholder={
                    s.peligro
                      ? `Ej: El peligro "${s.peligro}" se activa cuando...`
                      : "Ej: El peligro [PELIGRO] se activa cuando..."
                  }
                  min={2}
                  max={8}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {getPasosSugeridos(normaKey).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        const idx = s.pasos.findIndex((x) => !x.trim());
                        const next = [...s.pasos];
                        if (idx >= 0) next[idx] = p;
                        else if (next.length < 8) next.push(p);
                        setS({ ...s, pasos: next });
                      }}
                      className="text-[11px] rounded-full border border-input bg-muted/40 hover:bg-accent hover:text-accent-foreground px-2.5 py-1 transition-colors"
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Elemento 4 de 6
                  </div>
                  <h3 className="text-xl font-bold">SITUACIÓN PELIGROSA</h3>
                  <p className="text-sm text-muted-foreground">
                    El momento EXACTO en que el peligro toca el producto o el paciente.
                  </p>
                </div>
                <ElemBadge num="E4" label="Situación" norma={normaKey} />
              </div>

              <div className="space-y-2">
                <Label>{ayudas2.situacionAyuda} *</Label>
                <p className="text-xs text-muted-foreground">
                  No es el daño — es el instante de contacto. ¿Cuándo? ¿Dónde? ¿Bajo qué
                  circunstancia?
                </p>
                <Textarea
                  rows={3}
                  value={s.situacion_peligrosa}
                  onChange={(e) => setS({ ...s, situacion_peligrosa: e.target.value })}
                  placeholder="Ej: Durante la implantación del dispositivo, el paciente es expuesto a..."
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Elemento 6 de 6
                  </div>
                  <h3 className="text-xl font-bold">EFECTO Y DAÑO POTENCIAL</h3>
                  <p className="text-sm text-muted-foreground">
                    La consecuencia en el PACIENTE o usuario final — no en el proceso.
                  </p>
                </div>
                <ElemBadge num="E6" label="Efecto" norma={normaKey} />
              </div>

              <div className="space-y-2">
                <Label>¿Qué le pasaría al paciente o usuario final? *</Label>
                <p className="text-xs text-muted-foreground">
                  Describe: tipo de lesión, reversibilidad, necesidad de intervención médica.
                </p>
                <Textarea
                  rows={4}
                  value={s.efecto_dano}
                  onChange={(e) => setS({ ...s, efecto_dano: e.target.value })}
                  placeholder="Ej: Reacción alérgica grave, Infección nosocomial, Sobredosis"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "Lesión permanente",
                    "Requiere cirugía",
                    "Hospitalización",
                    "Lesión reversible",
                    "Molestia menor",
                    "Sin efecto clínico",
                  ].map((ej) => (
                    <button
                      key={ej}
                      type="button"
                      onClick={() => {
                        const sep = s.efecto_dano.trim() ? ". " : "";
                        setS({ ...s, efecto_dano: s.efecto_dano + sep + ej });
                      }}
                      className="text-[11px] rounded-full border border-input bg-muted/40 hover:bg-accent hover:text-accent-foreground px-2.5 py-1 transition-colors"
                    >
                      + {ej}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Evalúa el riesgo</h3>
                  <p className="text-sm text-muted-foreground">
                    Mueve los controles para evaluar cada dimensión — el NPR se calcula
                    automáticamente.
                  </p>
                </div>
                <ElemBadge num="NPR" label="Evaluación" tone="neutral" />
              </div>

              {/* Selector de escala de Severidad — define qué catálogo aplica */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div>
                  <Label className="text-sm font-semibold">¿Qué tipo de riesgo es este?</Label>
                  <p className="text-xs text-muted-foreground">
                    Determina qué escala de Severidad aplica.
                  </p>
                </div>
                <RadioGroup
                  value={s.tipo_escala_severidad}
                  onValueChange={async (v) => {
                    const nuevo = v as TipoEscalaSeveridad;
                    setS({ ...s, tipo_escala_severidad: nuevo });
                    // Pre-seleccionar tipo_folio = SGC cuando el folio aún no tiene tipo
                    if (nuevo === "sgc_regulatorio" && !tipoFolio) {
                      try {
                        await supabase.from("folios").update({ tipo_folio: "SGC" }).eq("id", folioId);
                        qc.invalidateQueries({ queryKey: ["folio", folioId] });
                      } catch (e) {
                        console.warn("No se pudo pre-asignar tipo_folio=SGC", e);
                      }
                    }
                  }}
                  className="grid sm:grid-cols-2 gap-2"
                >
                  <label
                    htmlFor="esc-estandar"
                    className={cn(
                      "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors",
                      s.tipo_escala_severidad === "estandar"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value="estandar" id="esc-estandar" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold">Riesgo de producto o proceso</div>
                      <div className="text-[11px] text-muted-foreground">
                        Escala Estándar — impacto en paciente / usuario.
                      </div>
                    </div>
                  </label>
                  <label
                    htmlFor="esc-sgc"
                    className={cn(
                      "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors",
                      s.tipo_escala_severidad === "sgc_regulatorio"
                        ? "border-orange-500 bg-orange-500/5"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value="sgc_regulatorio" id="esc-sgc" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold">Riesgo documental o regulatorio</div>
                      <div className="text-[11px] text-muted-foreground">
                        Escala SGC — impacto ante COFEPRIS (observación, NC, recall).
                      </div>
                    </div>
                  </label>
                </RadioGroup>
                <div
                  className={cn(
                    "text-[11px] rounded px-2 py-1 font-medium",
                    s.tipo_escala_severidad === "sgc_regulatorio"
                      ? "bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/30"
                      : "bg-primary/10 text-primary border border-primary/30",
                  )}
                >
                  Usando: {s.tipo_escala_severidad === "sgc_regulatorio" ? "Escala SGC/Regulatoria" : "Escala Estándar"}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <SliderField
                    label="Severidad (S)"
                    value={s.severidad}
                    onChange={(v) => setS({ ...s, severidad: v, sev_residual: Math.max(s.sev_residual, 1) })}
                    description={
                      s.tipo_escala_severidad === "sgc_regulatorio"
                        ? `${getDescripcionSeveridad(s.severidad, "sgc_regulatorio", normaConfig).etiqueta} — ${getDescripcionSeveridad(s.severidad, "sgc_regulatorio", normaConfig).descripcion}`
                        : getSeveridadTxt(normaKey, s.severidad)
                    }
                  />
                  {sevCritica && (
                    <div className="flex items-start gap-2 rounded-md border border-npr-high bg-npr-high/10 p-3 text-sm">
                      <AlertTriangle className="h-4 w-4 text-npr-high shrink-0 mt-0.5" />
                      <span>
                        Severidad Crítica — este ID requerirá <strong>Dictamen de Beneficio-Riesgo</strong>.
                      </span>
                    </div>
                  )}
                  {normaKey === "NOM-059" && s.severidad >= 8 && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <Label className="text-xs font-semibold">
                        ¿La población objetivo incluye pacientes vulnerables?
                      </Label>
                      <RadioGroup
                        value={s.poblacion}
                        onValueChange={(v) => setS({ ...s, poblacion: v })}
                        className="flex flex-wrap gap-3"
                      >
                        {POBLACIONES_VULNERABLES.map((p) => (
                          <div key={p.valor} className="flex items-center gap-1.5">
                            <RadioGroupItem value={p.valor} id={`pob-${p.valor}`} />
                            <Label htmlFor={`pob-${p.valor}`} className="text-xs font-normal">
                              {p.etiqueta}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {sugerirSPlus && (
                        <div className="flex items-center justify-between gap-3 rounded bg-amber-50 dark:bg-amber-950/30 p-2 text-xs">
                          <span>
                            Para esta población se recomienda <strong>S = {s.severidad + 1}</strong>{" "}
                            por mayor susceptibilidad — Requerido por NOM-059 y FEUM.
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setS({
                                ...s,
                                severidad: s.severidad + 1,
                                justificacion_aceptabilidad:
                                  (s.justificacion_aceptabilidad
                                    ? s.justificacion_aceptabilidad + " "
                                    : "") +
                                  `S incrementado +1 por población vulnerable (${s.poblacion}) — Requerido por NOM-059 y FEUM.`,
                              })
                            }
                          >
                            Aplicar S+1
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <SliderField
                    label="Ocurrencia (O)"
                    value={s.ocurrencia}
                    onChange={(v) => setS({ ...s, ocurrencia: v })}
                    description={getOcurrenciaTxt(s.ocurrencia, normaKey)}
                  />
                  {usaDet && (
                    <SliderField
                      label="Detectabilidad (D)"
                      value={s.deteccion}
                      onChange={(v) => setS({ ...s, deteccion: v })}
                      description={getDetectabilidadTxt(s.deteccion)}
                    />
                  )}
                </div>
                <div className="md:sticky md:top-0 self-start">
                  <NPRPanel npr={npr} s={s.severidad} norma={normaKey} />
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    NPR = S × O {usaDet ? "× D" : ""}
                  </p>
                </div>
              </div>

              {/* Decisión: ¿requiere acción correctiva? */}
              {!requiereAccion ? (
                <div className="rounded-lg border border-npr-low bg-npr-low/10 p-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-npr-low">
                    <Check className="h-4 w-4" />
                    ✅ NPR BAJO — No requiere acción inmediata
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El riesgo es aceptable con los controles actuales (umbral medio:{" "}
                    {normaConfig.umbralNPRMedio}).
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-npr-high bg-npr-high/10 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-npr-high">
                    <AlertTriangle className="h-4 w-4" />
                    ⚠️ Este riesgo REQUIERE acción correctiva
                  </div>
                  <div className="space-y-2">
                    <Label>¿Qué acción correctiva o preventiva se implementará? *</Label>
                    <p className="text-xs text-muted-foreground">
                      Indica el nivel: Nivel A (ingeniería), Nivel B (validación/barrera),
                      Nivel C (documental/capacitación).
                    </p>
                    <Textarea
                      rows={2}
                      value={s.accion_propuesta}
                      onChange={(e) => setS({ ...s, accion_propuesta: e.target.value })}
                      placeholder="Ej: Nivel B — Instalar alarma automática con umbral al 90% del límite validado"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>¿Quién es responsable de implementarla? *</Label>
                      <p className="text-xs text-muted-foreground">
                        Rol o cargo — no nombre propio. Ej: Responsable Sanitario, Jefe de
                        Producción.
                      </p>
                      <Input
                        value={s.responsable}
                        onChange={(e) => setS({ ...s, responsable: e.target.value })}
                        placeholder="Ej: Responsable Sanitario"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha compromiso *</Label>
                      <p className="text-xs text-muted-foreground">
                        Fecha realista de implementación.
                      </p>
                      <Input
                        type="date"
                        value={s.fecha_compromiso}
                        onChange={(e) => setS({ ...s, fecha_compromiso: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* NPR residual — siempre visible, queda documentado en expediente */}
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">
                      {requiereAccion
                        ? "¿Cuál será el NPR después de implementar la acción?"
                        : "NPR residual (sin acción correctiva)"}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {requiereAccion
                        ? "Estima cómo cambian S/O/D una vez aplicada la acción propuesta."
                        : "Documentado para el expediente — ajusta si los controles actuales ya reducen el NPR."}
                    </p>
                  </div>
                  <NPRPanel npr={nprRes} s={s.sev_residual} norma={normaKey} compact />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <SliderField
                    label="S residual"
                    value={s.sev_residual}
                    onChange={(v) => {
                      setResidualesEditados(true);
                      setS({ ...s, sev_residual: v });
                    }}
                    description={getSeveridadTxt(normaKey, s.sev_residual)}
                  />
                  <SliderField
                    label="O residual"
                    value={s.ocu_residual}
                    onChange={(v) => {
                      setResidualesEditados(true);
                      setS({ ...s, ocu_residual: v });
                    }}
                    description={getOcurrenciaTxt(s.ocu_residual, normaKey)}
                  />
                  {usaDet && (
                    <SliderField
                      label="D residual"
                      value={s.det_residual}
                      onChange={(v) => {
                        setResidualesEditados(true);
                        setS({ ...s, det_residual: v });
                      }}
                      description={getDetectabilidadTxt(s.det_residual)}
                    />
                  )}
                </div>

                {nprRes >= normaConfig.umbralNPRMedio && (
                  <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      {getEtiquetasControles(normaKey).afapAviso}
                    </div>
                    <Label className="text-xs">
                      {getEtiquetasControles(normaKey).afapLabel}
                    </Label>
                    <Textarea
                      rows={2}
                      value={s.justificacion_aceptabilidad}
                      onChange={(e) =>
                        setS({ ...s, justificacion_aceptabilidad: e.target.value })
                      }
                      placeholder="Ej: Beneficio terapéutico supera el riesgo residual; controles adicionales no son técnicamente factibles."
                    />
                  </div>
                )}
              </div>

              {sevCritica && (
                <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>
                    ⚠️ Severidad S≥{normaConfig.umbralSeveridadCritica} — Este riesgo requiere{" "}
                    <strong>Dictamen de Beneficio-Riesgo</strong> firmado por el{" "}
                    {normaConfig.terminologia.aprobadorFinal}.
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 7 && (
            <ControlesPaso7
              s={s}
              setS={setS}
              normaKey={normaKey}
            />
          )}

          {step === 8 && (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Revisa el ID de riesgo</h3>
                  <p className="text-sm text-muted-foreground">
                    Verifica que todo esté correcto antes de guardar.
                  </p>
                </div>
                <ElemBadge num="Rev" label="Revisión" tone="neutral" />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <NPRPanel npr={npr} s={s.severidad} norma={normaKey} compact />
                <div className="flex items-center justify-center text-center rounded-lg border p-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Reducción</div>
                    <div className="text-2xl font-bold text-primary">
                      {npr > 0 ? Math.round(((npr - nprRes) / npr) * 100) : 0}%
                    </div>
                  </div>
                </div>
                <NPRPanel npr={nprRes} s={s.sev_residual} norma={normaKey} compact />
              </div>

              {sevCritica && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Severidad Crítica
                </Badge>
              )}

              <div className="rounded-lg border overflow-hidden text-sm">
                <table className="w-full">
                  <tbody className="[&_tr]:border-b [&_tr:last-child]:border-0 [&_th]:bg-muted/40 [&_th]:text-left [&_th]:font-semibold [&_th]:text-xs [&_th]:p-2 [&_th]:w-1/3 [&_td]:p-2 [&_td]:align-top">
                    <tr>
                      <th>Peligro</th>
                      <td>{s.peligro}</td>
                    </tr>
                    <tr>
                      <th>Etapa</th>
                      <td>{s.etapa_proceso === "__otra__" ? s.etapa_otra : s.etapa_proceso}</td>
                    </tr>
                    <tr>
                      <th>Modo de falla</th>
                      <td>{s.peligro_modo_falla}</td>
                    </tr>
                    <tr>
                      <th>Causas</th>
                      <td className="whitespace-pre-line">
                        {s.causas.filter((c) => c.trim()).map((c, i) => `${i + 1}. ${c}`).join("\n")}
                      </td>
                    </tr>
                    <tr>
                      <th>Secuencia</th>
                      <td className="whitespace-pre-line">
                        {s.pasos.filter((p) => p.trim()).map((p, i) => `${i + 1}. ${p}`).join("\n")}
                      </td>
                    </tr>
                    <tr>
                      <th>Situación peligrosa</th>
                      <td>{s.situacion_peligrosa}</td>
                    </tr>
                    <tr>
                      <th>Efecto / Daño</th>
                      <td>{s.efecto_dano}</td>
                    </tr>
                    <tr>
                      <th>S / O {usaDet ? "/ D" : ""} inicial</th>
                      <td className="font-mono">
                        {s.severidad} / {s.ocurrencia}
                        {usaDet ? ` / ${s.deteccion}` : ""} → NPR {npr} ({lvl.label})
                      </td>
                    </tr>
                    <tr>
                      <th>Controles de prevención</th>
                      <td className="whitespace-pre-line">
                        {[
                          ...s.controles_prev_a.filter((c) => c.trim()).map((c) => `[A] ${c}`),
                          ...s.controles_prev_b.filter((c) => c.trim()).map((c) => `[B] ${c}`),
                          ...s.controles_prev_c.filter((c) => c.trim()).map((c) => `[C] ${c}`),
                        ].join("\n") || "—"}
                      </td>
                    </tr>
                    <tr>
                      <th>Controles de detección</th>
                      <td className="whitespace-pre-line">
                        {s.controles_deteccion.filter((c) => c.trim()).join("\n") || "—"}
                      </td>
                    </tr>
                    <tr>
                      <th>S / O {usaDet ? "/ D" : ""} residual</th>
                      <td className="font-mono">
                        {s.sev_residual} / {s.ocu_residual}
                        {usaDet ? ` / ${s.det_residual}` : ""} → NPR {nprRes} ({lvlRes.label})
                      </td>
                    </tr>
                    {requiereAccion && (
                      <tr>
                        <th>Acción propuesta</th>
                        <td>
                          <div>{s.accion_propuesta}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {s.responsable} · {s.fecha_compromiso}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground italic">
                {getFundamentoNormativo(normaKey)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-background p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 1 ? intentarCerrar() : setStep(step - 1))}
            disabled={saving}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Anterior"}
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance(step)}
              className="gap-1"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {!modoEdicion && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGuardarYOtro}
                    disabled={saving}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" /> Guardar y agregar otro
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGuardarYAsistente}
                    disabled={saving}
                    className="gap-1"
                  >
                    <Sparkles className="h-4 w-4" /> Guardar y continuar con IA
                  </Button>
                </>
              )}
              <Button
                type="button"
                onClick={handleGuardar}
                disabled={saving}
                className={cn(
                  "gap-1",
                  modoEdicion && "bg-orange-500 hover:bg-orange-600 text-white",
                )}
              >
                <Check className="h-4 w-4" />
                {saving
                  ? modoEdicion ? "Actualizando..." : "Guardando..."
                  : modoEdicion ? "Actualizar ID" : "Insertar ID"}
              </Button>
            </div>
          )}
        </div>
        {/* fin columna wizard */}
        </div>
        {asistenteAbierto && (
          <div
            className={cn(
              "md:flex-[2] md:max-w-md min-h-0 flex flex-col",
              vistaMovil === "wizard" && "hidden md:flex",
            )}
          >
            <WizardAsistente
              folioId={folioId}
              contextoSistema={construirContextoIA()}
              paso={step}
              onApply={aplicarSugerencia}
              onClose={() => {
                setAsistenteAbierto(false);
                setVistaMovil("wizard");
              }}
            />
          </div>
        )}
        </div>
      </DialogContent>
      <CausaRaizSheet
        open={causaRaizOpen}
        onClose={() => setCausaRaizOpen(false)}
        peligro={s.peligro || s.peligro_modo_falla}
        proceso={
          (s.etapa_proceso === "__otra__" ? s.etapa_otra : s.etapa_proceso) ||
          procesoEquipo ||
          ""
        }
        norma={normaKey}
        causaActual={s.causas.filter((c) => c.trim()).join("; ")}
        onApply={(p: CausaRaizPayload) => {
          const nuevasCausas = [p.causaRaiz, ...p.causasSecundarias].filter(Boolean);
          const previas = s.causas.filter((c) => c.trim());
          const dedup = Array.from(new Set([...previas, ...nuevasCausas]));
          setS({ ...s, causas: dedup.length ? dedup : [""] });
          setExtraJustificacion((prev) => formatJustificacion6M(prev, p));
          setCausaRaizAplicado(true);
          toast({
            title: "Análisis aplicado",
            description: `Causa raíz: ${p.causaRaiz}`,
          });
        }}
      />
    </Dialog>
    <AlertDialog open={confirmCerrarOpen} onOpenChange={setConfirmCerrarOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Salir del wizard?</AlertDialogTitle>
          <AlertDialogDescription>
            Tienes cambios sin guardar. Si sales ahora, tu avance quedará guardado
            como <strong>borrador</strong> en este navegador y podrás continuar la
            próxima vez que abras el wizard de este folio.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <Button variant="ghost" onClick={salirDescartando}>
            Salir y descartar
          </Button>
          <AlertDialogAction onClick={salirGuardandoBorrador}>
            Salir y guardar borrador
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 7 — Controles con jerarquía A/B/C + Detección
// ─────────────────────────────────────────────────────────────────────────────
function ControlesPaso7({
  s,
  setS,
  normaKey,
}: {
  s: WizardState;
  setS: React.Dispatch<React.SetStateAction<WizardState>>;
  normaKey: NormaKey;
}) {
  const chips = getChipsControles(normaKey);
  const etq = getEtiquetasControles(normaKey);
  const chipBtn =
    "text-[11px] rounded-full border border-input bg-muted/40 hover:bg-accent hover:text-accent-foreground px-2.5 py-1 transition-colors";

  const addChip = (field: "controles_prev_a" | "controles_prev_b" | "controles_prev_c" | "controles_deteccion", v: string) => {
    setS((prev) => {
      const arr = prev[field];
      const idx = arr.findIndex((x) => !x.trim());
      const next = [...arr];
      if (idx >= 0) next[idx] = v;
      else if (next.length < 20) next.push(v);
      return { ...prev, [field]: next };
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Paso 7 de 8
          </div>
          <h3 className="text-xl font-bold">CONTROLES</h3>
          <p className="text-sm text-muted-foreground">
            Los controles reducen el NPR atacando la Ocurrencia (prevención) o la
            Detectabilidad (detección).
          </p>
        </div>
        <ElemBadge num="Ctrl" label="Controles" tone="neutral" />
      </div>

      {/* SECCIÓN A — Prevención */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ElemBadge num="O↓" label={etq.tituloAzul} tone="blue" />
        </div>
        <div>
          <Label>¿Qué controles reducen la probabilidad de que el riesgo ocurra?</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Prioridad: primero eliminar el peligro por diseño, luego barreras físicas,
            luego controles administrativos.
          </p>
        </div>

        {/* Nivel A */}
        <div className="space-y-2 rounded-md border-l-2 border-primary pl-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-bold text-primary">
              {etq.nivelA}
            </div>
            <Label className="text-sm">
              ¿Puedes eliminar o reducir el peligro desde el diseño?
            </Label>
          </div>
          <ListaMulti
            items={s.controles_prev_a}
            setItems={(i) => setS({ ...s, controles_prev_a: i })}
            placeholder="Ej: Rediseño del componente para eliminar la fuente del peligro"
          />
          <div className="flex flex-wrap gap-1.5">
            {chips.prevA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => addChip("controles_prev_a", c)}
                className={chipBtn}
              >
                + {c}
              </button>
            ))}
          </div>
        </div>

        {/* Nivel B */}
        <div className="space-y-2 rounded-md border-l-2 border-blue-500 pl-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-bold text-blue-600 dark:text-blue-400">
              {etq.nivelB}
            </div>
            <Label className="text-sm">¿Qué barreras o validaciones controlan el riesgo?</Label>
          </div>
          <ListaMulti
            items={s.controles_prev_b}
            setItems={(i) => setS({ ...s, controles_prev_b: i })}
            placeholder="Ej: Validación de proceso con tres lotes consecutivos"
          />
          <div className="flex flex-wrap gap-1.5">
            {chips.prevB.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => addChip("controles_prev_b", c)}
                className={chipBtn}
              >
                + {c}
              </button>
            ))}
          </div>
        </div>

        {/* Nivel C */}
        <div className="space-y-2 rounded-md border-l-2 border-muted-foreground/40 pl-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">
              {etq.nivelC}
            </div>
            <Label className="text-sm">
              ¿Qué controles documentales o de capacitación aplican?
            </Label>
          </div>
          <ListaMulti
            items={s.controles_prev_c}
            setItems={(i) => setS({ ...s, controles_prev_c: i })}
            placeholder="Ej: PNO actualizado con evidencia de capacitación al personal"
          />
          <div className="flex flex-wrap gap-1.5">
            {chips.prevC.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => addChip("controles_prev_c", c)}
                className={chipBtn}
              >
                + {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIÓN B — Detección */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ElemBadge num="D↑" label={etq.tituloNaranja} tone="orange" />
        </div>
        <div>
          <Label>¿Cómo detectas que el riesgo ocurrió antes de llegar al paciente?</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Los controles de detección no evitan el riesgo — lo identifican a tiempo para
            actuar.
          </p>
        </div>
        <ListaMulti
          items={s.controles_deteccion}
          setItems={(i) => setS({ ...s, controles_deteccion: i })}
          placeholder="Describe un control de detección"
        />
        <div className="flex flex-wrap gap-1.5">
          {chips.deteccion.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => addChip("controles_deteccion", c)}
              className={chipBtn}
            >
              + {c}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Los controles de Nivel A son siempre preferibles. Un control que elimina el peligro
        es mejor que uno que lo detecta después de ocurrir.
      </p>
    </div>
  );
}
