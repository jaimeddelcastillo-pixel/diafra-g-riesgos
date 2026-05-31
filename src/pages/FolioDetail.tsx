import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrigenAnalisisSelect } from "@/components/OrigenAnalisisSelect";
import { ArrowLeft, FileSignature, Lock, Printer, Plus, Pencil, Trash2, Save, X, History } from "lucide-react";
import { useFolioDetail, getNPRLevel, getEstadoStyle } from "@/hooks/useFolios";
import type { Folio, Riesgo, FolioComite } from "@/hooks/useFolios";
import { Skeleton } from "@/components/ui/skeleton";
import { RiesgoFormDialog } from "@/components/RiesgoFormDialog";
import { RiesgoWizardDialog } from "@/components/RiesgoWizardDialog";
import { SeccionDictamen } from "@/components/SeccionDictamen";
import { SeccionEvidencias } from "@/components/SeccionEvidencias";
import { ComiteTab } from "@/components/comite/ComiteTab";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { generateFolioPDF } from "@/lib/generateFolioPDF";
import {
  getNormaConfig,
  getClasificacionMode,
  CLASIFICACION_DM,
  CLASIFICACION_MED_TIPO,
  CLASIFICACION_MED_VENTA,
  CLASIFICACION_MED_RIESGO,
} from "@/config/normas";

// Componente para mostrar firmas usando URLs firmadas (bucket privado)
function FirmaImg({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("firmas")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}

// ─── Checklist NOM-241-SSA1-2025 / FEUM / ISO 14971 ───────────────────────────────────────────
interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  critico: boolean; // true = bloquea envío a firma
}

function evaluarChecklistNOM241(folio: Folio, riesgos: Riesgo[], comite: FolioComite[]): CheckItem[] {
  const items: CheckItem[] = [];
  const nc = getNormaConfig(folio.norma_folio);
  const beneficio = nc.terminologia.beneficio;
  const refs = nc.normasReferencia.join(" / ");

  // ── Folio ──
  items.push({ id: "alcance", label: "Alcance del análisis capturado", ok: !!folio.alcance?.trim(), critico: true });
  items.push({ id: "modelo", label: "Identificación del proceso / dispositivo (opcional)", ok: !!folio.numero_modelo?.trim(), critico: false });
  items.push({ id: "beneficio", label: `${beneficio} documentado (${refs})`, ok: !!folio.beneficio_clinico?.trim(), critico: true });
  items.push({ id: "residual_global", label: `Evaluación de riesgo residual global (${refs})`, ok: !!folio.riesgo_residual_global?.trim(), critico: true });
  items.push({ id: "comite", label: "Al menos un miembro en el comité", ok: comite.length > 0, critico: true });
  items.push({ id: "riesgos_count", label: "Al menos un riesgo analizado", ok: riesgos.length > 0, critico: true });

  // ── Por riesgo ──
  let sinPeligro = 0, sinSituacion = 0, sinAccionResp = 0, sinFecha = 0, sinVerif = 0, alarpSinJust = 0, criticoSinEvidencia = 0;

  const umbralCrit = nc.umbralNPRAlto;
  const umbralSev = nc.umbralSeveridadCritica;
  const umbralAlarpMin = nc.umbralNPRMedio;
  for (const r of riesgos) {
    if (!r.peligro?.trim()) sinPeligro++;
    if (!r.situacion_peligrosa?.trim()) sinSituacion++;
    const npr = r.npr ?? 0;
    if (r.requiere_accion) {
      if (!r.responsable?.trim()) sinAccionResp++;
      if (!r.fecha_compromiso) sinFecha++;
    }
    if (r.accion_implementada?.trim() && !r.verificado_por?.trim()) sinVerif++;
    if (npr >= umbralAlarpMin && npr <= umbralCrit && r.dictamen === "Aceptable" && !r.justificacion_aceptabilidad?.trim()) alarpSinJust++;
    const esCritico = npr > umbralCrit || r.severidad >= umbralSev;
    const tieneEvidencia = r.anexos && (r.anexos as unknown[]).length > 0;
    if (esCritico && r.requiere_accion && !tieneEvidencia) criticoSinEvidencia++;
  }

  items.push({ id: "peligro", label: `Peligro (fuente) capturado en todos los riesgos${sinPeligro > 0 ? ` (${sinPeligro} pendiente${sinPeligro > 1 ? "s" : ""})` : ""}`, ok: sinPeligro === 0, critico: true });
  items.push({ id: "situacion", label: `Situación peligrosa capturada en todos los riesgos${sinSituacion > 0 ? ` (${sinSituacion} pendiente${sinSituacion > 1 ? "s" : ""})` : ""}`, ok: sinSituacion === 0, critico: true });
  items.push({ id: "responsable", label: `Acciones con responsable asignado${sinAccionResp > 0 ? ` (${sinAccionResp} sin asignar)` : ""}`, ok: sinAccionResp === 0, critico: true });
  items.push({ id: "fecha", label: `Acciones con fecha de compromiso${sinFecha > 0 ? ` (${sinFecha} sin fecha)` : ""}`, ok: sinFecha === 0, critico: true });
  items.push({ id: "evidencia_criticos", label: `Riesgos críticos con evidencia adjunta${criticoSinEvidencia > 0 ? ` (${criticoSinEvidencia} sin PDF)` : ""}`, ok: criticoSinEvidencia === 0, critico: true });
  items.push({ id: "verificacion", label: `Acciones implementadas con verificación${sinVerif > 0 ? ` (${sinVerif} sin verificar)` : ""}`, ok: sinVerif === 0, critico: false });
  items.push({ id: "alarp", label: `Riesgos en zona de reducción al mínimo posible con justificación de aceptabilidad${alarpSinJust > 0 ? ` (${alarpSinJust} sin justificar)` : ""}`, ok: alarpSinJust === 0, critico: false });

  // ── Informativos: clasificación según norma ──
  const modo = getClasificacionMode(folio.norma_folio, folio.clasificacion_categoria);
  if (modo === "dm") {
    items.push({ id: "clase", label: "Clase del dispositivo especificada", ok: !!folio.clase_dispositivo?.trim(), critico: false });
  } else {
    items.push({ id: "clase_tipo", label: "Tipo de medicamento especificado", ok: !!folio.clasificacion_tipo?.trim(), critico: false });
    items.push({ id: "clase_venta", label: "Condición de venta especificada", ok: !!folio.clasificacion_condicion_venta?.trim(), critico: false });
    items.push({ id: "clase_riesgo", label: "Nivel de riesgo sanitario especificado", ok: !!folio.clasificacion_riesgo_sanitario?.trim(), critico: false });
  }
  items.push({ id: "lote", label: "Número de lote / revisión especificado", ok: !!folio.numero_lote?.trim(), critico: false });

  return items;
}

function ChecklistNOM241({ folio, riesgos, comite }: { folio: Folio; riesgos: Riesgo[]; comite: FolioComite[] }) {
  const items = evaluarChecklistNOM241(folio, riesgos, comite);
  const pendientes = items.filter((i) => !i.ok);
  const bloqueantes = pendientes.filter((i) => i.critico);

  return (
    <div className="border rounded-lg shadow-md bg-background p-4 w-80 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold">Checklist de cumplimiento</p>
        {bloqueantes.length === 0 ? (
          <span className="text-[10px] text-green-700 font-bold bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
            ✓ Listo para firma
          </span>
        ) : (
          <span className="text-[10px] text-destructive font-bold bg-destructive/5 border border-destructive/20 rounded px-1.5 py-0.5">
            {bloqueantes.length} bloqueante{bloqueantes.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className={`flex items-start gap-1.5 text-[10px] rounded px-1.5 py-1 ${item.ok ? "text-muted-foreground" : item.critico ? "text-destructive bg-destructive/5" : "text-amber-700 bg-amber-50"}`}>
            <span className="mt-px shrink-0">{item.ok ? "✓" : item.critico ? "✗" : "⚠"}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      {pendientes.length === 0 && (
        <p className="text-[10px] text-green-700 text-center font-medium">
          Todos los requisitos cumplidos
        </p>
      )}
    </div>
  );
}

function NPRBadge({ npr, severidad }: { npr: number; severidad: number }) {
  const level = getNPRLevel(npr, severidad);
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold ${
        level.label === "Crítico" ? "text-destructive" : level.label === "Mayor" ? "text-warning" : "text-success"
      }`}
    >
      {level.dot} {npr}
    </span>
  );
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

function FormField({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`border-r border-b last:border-r-0 p-2 ${className}`}>
      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</span>
      <div className="text-sm mt-0.5 whitespace-pre-line">
        {value || <span className="text-muted-foreground/50">—</span>}
      </div>
    </div>
  );
}

// ─── Sección Descripción ──────────────────────────────────────────────────────
function SeccionDescripcion({ folio, locked, onSaved }: { folio: Folio; locked: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    proceso_equipo: folio.proceso_equipo,
    origen: folio.origen,
    desviacion_id: folio.desviacion_id || "",
    control_cambios_id: folio.control_cambios_id || "",
    fecha_inicio: folio.fecha_inicio,
    fecha_cierre: folio.fecha_cierre || "",
    alcance: folio.alcance || "",
    // Nuevos — trazabilidad y versión (NOM-241-SSA1-2025)
    numero_version: folio.numero_version || "1.0",
    numero_modelo: folio.numero_modelo || "",
    numero_lote: folio.numero_lote || "",
    clase_dispositivo: folio.clase_dispositivo || "",
    // Clasificación adaptable según norma
    clasificacion_categoria: folio.clasificacion_categoria || "",
    clasificacion_tipo: folio.clasificacion_tipo || "",
    clasificacion_condicion_venta: folio.clasificacion_condicion_venta || "",
    clasificacion_riesgo_sanitario: folio.clasificacion_riesgo_sanitario || "",
  });

  const nc = getNormaConfig(folio.norma_folio);
  const isMulti = nc.key === "MULTI";
  const modo = getClasificacionMode(folio.norma_folio, form.clasificacion_categoria);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("folios")
      .update({
        proceso_equipo: form.proceso_equipo,
        origen: form.origen,
        desviacion_id: form.desviacion_id,
        control_cambios_id: form.control_cambios_id,
        fecha_inicio: form.fecha_inicio,
        fecha_cierre: form.fecha_cierre || null,
        alcance: form.alcance,
        numero_version: form.numero_version,
        numero_modelo: form.numero_modelo,
        numero_lote: form.numero_lote,
        // Solo persistimos los campos del bloque visible para evitar mezclar normas.
        clase_dispositivo: modo === "dm" ? form.clase_dispositivo : "",
        clasificacion_tipo: modo === "med" ? form.clasificacion_tipo : "",
        clasificacion_condicion_venta: modo === "med" ? form.clasificacion_condicion_venta : "",
        clasificacion_riesgo_sanitario: modo === "med" ? form.clasificacion_riesgo_sanitario : "",
        clasificacion_categoria: isMulti ? form.clasificacion_categoria : "",
      })
      .eq("id", folio.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Descripción actualizada" });
      setEditing(false);
      onSaved();
    }
  };

  if (!editing) {
    return (
      <div className="border rounded-md overflow-hidden relative">
        <SectionHeader number="I" title="DESCRIPCIÓN" />
        {!locked && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="grid grid-cols-12 border-b">
          <FormField
            label="Folio de Gestión"
            value={<span className="font-mono font-bold">{folio.codigo}</span>}
            className="col-span-4"
          />
          <FormField
            label="Versión"
            value={<span className="font-mono font-semibold text-primary">{folio.numero_version || "1.0"}</span>}
            className="col-span-2"
          />
          <FormField label="Identificación del proceso / dispositivo" value={folio.numero_modelo} className="col-span-2" />
          <FormField label="Lote / Rev." value={folio.numero_lote} className="col-span-2" />
          {getClasificacionMode(folio.norma_folio, folio.clasificacion_categoria) === "dm" ? (
            <FormField label="Clase" value={folio.clase_dispositivo} className="col-span-2 border-r-0" />
          ) : (
            <FormField
              label="Clasificación"
              value={
                [folio.clasificacion_tipo, folio.clasificacion_condicion_venta, folio.clasificacion_riesgo_sanitario]
                  .filter(Boolean)
                  .join(" · ")
              }
              className="col-span-2 border-r-0"
            />
          )}
        </div>
        <div className="grid grid-cols-12">
          <FormField label="Proceso / Producto / Equipo / Sistema Analizado" value={folio.proceso_equipo} className="col-span-4" />
          <FormField
            label="Origen"
            value={
              <Badge variant="outline" className="text-[10px]">
                {folio.origen}
              </Badge>
            }
            className="col-span-3"
          />
          <FormField label="Desviación" value={folio.desviacion_id} className="col-span-2" />
          <FormField label="Control de Cambios" value={folio.control_cambios_id} className="col-span-3 border-r-0" />
        </div>
        <div className="grid grid-cols-4">
          <FormField label="Fecha Inicio" value={folio.fecha_inicio} />
          <FormField label="Fecha Cierre" value={folio.fecha_cierre} />
          <FormField label="Alcance" value={folio.alcance} className="col-span-2 border-r-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="I" title="DESCRIPCIÓN — Editando" />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              Proceso / Producto / Equipo / Sistema Analizado
            </label>
            <Input value={form.proceso_equipo} onChange={(e) => setForm({ ...form, proceso_equipo: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Origen</label>
            <OrigenAnalisisSelect
              norma={folio.norma_folio}
              value={form.origen}
              onChange={(v) => setForm({ ...form, origen: v as any })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">ID Desviación</label>
            <Input
              value={form.desviacion_id}
              onChange={(e) => setForm({ ...form, desviacion_id: e.target.value })}
              placeholder="DES-2026-XXX"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Control de Cambios</label>
            <Input
              value={form.control_cambios_id}
              onChange={(e) => setForm({ ...form, control_cambios_id: e.target.value })}
              placeholder="CC-2026-XXX"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha Inicio</label>
            <Input
              type="date"
              value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha Cierre</label>
            <Input
              type="date"
              value={form.fecha_cierre}
              onChange={(e) => setForm({ ...form, fecha_cierre: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Alcance</label>
          <Textarea value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })} rows={3} />
        </div>
        {/* Trazabilidad NOM-241-SSA1-2025 §7.5.3 */}
        <div className="border-t pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">
            Trazabilidad del Dispositivo
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Versión Doc.</label>
              <Input
                value={form.numero_version}
                onChange={(e) => setForm({ ...form, numero_version: e.target.value })}
                placeholder="1.0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Identificación del proceso / dispositivo</label>
              <Input
                value={form.numero_modelo}
                onChange={(e) => setForm({ ...form, numero_modelo: e.target.value })}
                placeholder="Ej. MAN-SGC-01, PCT-500, Lote XYZ…"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Lote / Revisión</label>
              <Input
                value={form.numero_lote}
                onChange={(e) => setForm({ ...form, numero_lote: e.target.value })}
                placeholder="L-2026-001"
              />
            </div>
          </div>
          {/* ─── Clasificación (adaptable según norma) ─── */}
          <div className="border-t pt-3 mt-3 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">
              Clasificación regulatoria{" "}
              <span className="text-muted-foreground/70 normal-case">
                ({modo === "dm"
                  ? "NOM-241-SSA1-2025 / COFEPRIS"
                  : "NOM-059-SSA1-2015 / COFEPRIS"})
              </span>
            </p>
            {isMulti && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  ¿Este folio es para dispositivo médico o medicamento?
                </label>
                <Select
                  value={form.clasificacion_categoria}
                  onValueChange={(v) => setForm({ ...form, clasificacion_categoria: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dispositivo">Dispositivo médico (NOM-241)</SelectItem>
                    <SelectItem value="medicamento">Medicamento (NOM-059)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {modo === "dm" ? (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Clase del dispositivo</label>
                <Select
                  value={form.clase_dispositivo}
                  onValueChange={(v) => setForm({ ...form, clase_dispositivo: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {CLASIFICACION_DM.map((c) => (
                      <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Tipo de medicamento</label>
                  <Select
                    value={form.clasificacion_tipo}
                    onValueChange={(v) => setForm({ ...form, clasificacion_tipo: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {CLASIFICACION_MED_TIPO.map((c) => (
                        <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Condición de venta</label>
                  <Select
                    value={form.clasificacion_condicion_venta}
                    onValueChange={(v) => setForm({ ...form, clasificacion_condicion_venta: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {CLASIFICACION_MED_VENTA.map((c) => (
                        <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Nivel de riesgo sanitario</label>
                  <Select
                    value={form.clasificacion_riesgo_sanitario}
                    onValueChange={(v) => setForm({ ...form, clasificacion_riesgo_sanitario: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {CLASIFICACION_MED_RIESGO.map((c) => (
                        <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1">
            <X className="h-3 w-3" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            <Save className="h-3 w-3" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sección Comité — con botón Firmar conectado a Edge Function ──────────────
function SeccionComite({
  comite,
  folioId,
  folioEstado,
  onSaved,
}: {
  comite: FolioComite[];
  folioId: string;
  folioEstado: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firmando, setFirmando] = useState(false);
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  // Estado para agregar nuevo miembro
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nuevoMiembro, setNuevoMiembro] = useState({ nombre: "", cargo: "", responsabilidad: "", user_id: "" });

  const TEXTO_COMPROMISO =
    "Declaro bajo protesta de decir verdad que he revisado el contenido íntegro de este Análisis de Gestión de Riesgos, que la información es correcta y completa conforme a la normativa aplicable, y que mi firma electrónica registrada en este sistema tiene el mismo valor legal que mi firma autógrafa.";

  const { data: profiles } = useQuery({
    queryKey: ["profiles-firmas", orgId ?? "all"],
    queryFn: async () => {
      if (orgId) {
        const { data } = await supabase
          .from("org_members")
          .select("profiles!inner(id, nombre, cargo, firma_url)")
          .eq("org_id", orgId);
        return (data ?? []).map((r: any) => r.profiles);
      }
      const { data } = await supabase.from("profiles").select("id, nombre, cargo, firma_url");
      return data || [];
    },
    enabled: orgId != null,
  });

  const getFirmaPath = (userId: string | null): string | null => {
    if (!userId) return null;
    const profile = profiles?.find((p: any) => p.id === userId);
    return (profile && (profile as any).firma_url) || null;
  };

  const handleAgregarMiembro = async () => {
    if (!nuevoMiembro.nombre.trim() || !nuevoMiembro.cargo.trim() || !nuevoMiembro.responsabilidad.trim()) {
      toast({ title: "Completa todos los campos requeridos", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: {
      folio_id: string;
      nombre: string;
      cargo: string;
      responsabilidad: string;
      user_id?: string;
    } = {
      folio_id: folioId,
      nombre: nuevoMiembro.nombre.trim(),
      cargo: nuevoMiembro.cargo.trim(),
      responsabilidad: nuevoMiembro.responsabilidad.trim(),
    };
    if (nuevoMiembro.user_id) payload.user_id = nuevoMiembro.user_id;
    const { error } = await supabase.from("folio_comite").insert([payload]);
    setSaving(false);
    if (error) {
      toast({ title: "Error al agregar miembro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Miembro agregado al comité" });
      setNuevoMiembro({ nombre: "", cargo: "", responsabilidad: "", user_id: "" });
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ["folio", folioId] });
      onSaved();
    }
  };

  const handleEliminarMiembro = async (miembroId: string) => {
    const { error } = await supabase.from("folio_comite").delete().eq("id", miembroId);
    if (error) {
      toast({ title: "Error al eliminar miembro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Miembro eliminado" });
      queryClient.invalidateQueries({ queryKey: ["folio", folioId] });
      onSaved();
    }
  };

  const handleFirmar = async () => {
    setShowFirmaModal(false);
    setFirmando(true);
    try {
      const { data, error } = await supabase.functions.invoke("folio-workflow", {
        body: { accion: "firmar", folio_id: folioId, texto_compromiso: TEXTO_COMPROMISO },
      });

      if (error || data?.error) throw new Error(error?.message || data?.error);

      toast({
        title: "✅ Firma registrada",
        description: data?.todos_firmaron
          ? "Todos firmaron — Responsable Sanitario notificado"
          : "Esperando firmas de otros miembros",
      });

      queryClient.invalidateQueries({ queryKey: ["folio", folioId] });
      onSaved();
    } catch (err: any) {
      toast({ title: "Error al firmar", description: err.message, variant: "destructive" });
    } finally {
      setFirmando(false);
    }
  };

  const totalFirmas = comite.filter((m) => m.firmado).length;
  const totalMiembros = comite.length;

  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="II" title="FORMACIÓN Y APROBACIÓN DEL COMITÉ TÉCNICO" />

      {/* Barra de progreso cuando está En Firma */}
      {folioEstado === "En Firma" && totalMiembros > 0 && (
        <div className="px-4 py-2 bg-primary/5 border-b flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Firmas: {totalFirmas} de {totalMiembros}
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${totalMiembros > 0 ? (totalFirmas / totalMiembros) * 100 : 0}%` }}
            />
          </div>
          {totalFirmas === totalMiembros && totalMiembros > 0 && (
            <span className="text-xs text-green-700 font-medium">✓ Completo</span>
          )}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left p-2 font-semibold text-[11px] text-muted-foreground w-[22%]">NOMBRE</th>
            <th className="text-left p-2 font-semibold text-[11px] text-muted-foreground w-[18%]">CARGO</th>
            <th className="text-left p-2 font-semibold text-[11px] text-muted-foreground">RESPONSABILIDAD</th>
            <th className="text-center p-2 font-semibold text-[11px] text-muted-foreground w-[20%]">FIRMA</th>
            {folioEstado === "Borrador" && <th className="w-[40px]"></th>}
          </tr>
        </thead>
        <tbody>
          {comite.map((m) => {
            const firmaPath = m.firmado ? getFirmaPath(m.user_id) : null;
            const esMiembro = m.user_id === user?.id;
            const puedeFiremar = esMiembro && !m.firmado && folioEstado === "En Firma";

            return (
              <tr key={m.id} className="border-b last:border-0">
                <td className="p-2">{m.nombre}</td>
                <td className="p-2 font-medium">{m.cargo}</td>
                <td className="p-2 text-xs">{m.responsabilidad}</td>
                <td className="p-2 text-center">
                  {m.firmado ? (
                    <div className="flex flex-col items-center gap-1">
                      {firmaPath ? (
                        <FirmaImg path={firmaPath} alt={`Firma de ${m.nombre}`} className="h-10 w-auto object-contain" />
                      ) : (
                        <span className="text-success font-bold text-[10px]">✓ Firmado</span>
                      )}
                      <span className="text-[9px] text-muted-foreground">
                        {m.fecha_firma ? new Date(m.fecha_firma).toLocaleDateString("es-MX") : ""}
                      </span>
                    </div>
                  ) : puedeFiremar ? (
                    <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => setShowFirmaModal(true)} disabled={firmando}>
                      <FileSignature className="h-3 w-3" />
                      {firmando ? "Firmando..." : "Firmar"}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">
                      {folioEstado === "En Firma" ? "Pendiente" : "—"}
                    </span>
                  )}
                </td>
                {/* Botón eliminar — solo en Borrador */}
                {folioEstado === "Borrador" && (
                  <td className="p-1 text-center w-[40px]">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => handleEliminarMiembro(m.id)}
                      title="Eliminar miembro"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}

          {/* Fila vacía si no hay miembros */}
          {comite.length === 0 && (
            <tr>
              <td colSpan={folioEstado === "Borrador" ? 5 : 4} className="p-4 text-center text-xs text-muted-foreground italic">
                Sin miembros en el comité. Agrega al menos un miembro antes de enviar a firma.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Botón Agregar Miembro — solo en Borrador */}
      {folioEstado === "Borrador" && (
        <div className="border-t px-3 py-2">
          {!showAddForm ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-3 w-3" />
              Agregar Miembro al Comité
            </Button>
          ) : (
            <div className="space-y-2 py-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Nuevo Miembro</p>

              {/* Selector de usuario registrado — auto-rellena nombre y cargo */}
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">
                  Usuario del sistema <span className="text-primary">(selecciona para auto-rellenar nombre y cargo)</span>
                </label>
                <select
                  className="w-full border rounded px-2 py-1 text-xs mt-0.5 bg-background"
                  value={nuevoMiembro.user_id}
                  onChange={(e) => {
                    const uid = e.target.value;
                    const perfil = profiles?.find((p: any) => p.id === uid);
                    setNuevoMiembro({
                      ...nuevoMiembro,
                      user_id: uid,
                      nombre: perfil ? perfil.nombre : nuevoMiembro.nombre,
                      cargo: perfil ? (perfil.cargo || "") : nuevoMiembro.cargo,
                    });
                  }}
                >
                  <option value="">— Miembro externo / sin cuenta en el sistema —</option>
                  {profiles?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.cargo ? ` — ${p.cargo}` : ""}
                    </option>
                  ))}
                </select>
                {nuevoMiembro.user_id && (
                  <p className="text-[10px] text-green-700 mt-0.5">
                    ✓ Vinculado — podrá firmar digitalmente desde su cuenta
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Nombre completo *</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1 text-xs mt-0.5"
                    placeholder="Nombre completo"
                    value={nuevoMiembro.nombre}
                    onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Cargo *</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1 text-xs mt-0.5"
                    placeholder="Ej. Director Técnico"
                    value={nuevoMiembro.cargo}
                    onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, cargo: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Responsabilidad en el análisis *</label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1 text-xs mt-0.5"
                  placeholder="Ej. Revisión y aprobación del análisis de riesgos"
                  value={nuevoMiembro.responsabilidad}
                  onChange={(e) => setNuevoMiembro({ ...nuevoMiembro, responsabilidad: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="text-xs gap-1" onClick={handleAgregarMiembro} disabled={saving}>
                  <Plus className="h-3 w-3" />
                  {saving ? "Guardando..." : "Agregar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => { setShowAddForm(false); setNuevoMiembro({ nombre: "", cargo: "", responsabilidad: "", user_id: "" }); }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación de firma electrónica — NOM-241-SSA1-2025 / 21 CFR Part 11 */}
      {showFirmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-base">Confirmación de Firma Electrónica</h3>
            </div>
            <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground border-l-4 border-primary">
              <p className="font-semibold text-foreground mb-1">Declaración de firma electrónica</p>
              <p>{TEXTO_COMPROMISO}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
              <strong>Importante:</strong> Esta firma electrónica tiene el mismo valor legal que su firma autógrafa y quedará registrada con fecha, hora e IP conforme a los requisitos de trazabilidad.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowFirmaModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleFirmar} className="gap-1">
                <FileSignature className="h-3.5 w-3.5" />
                Acepto y Firmo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sección Riesgo Residual Global (FEUM / ISO 14971 §7 / §8) ──────────────────────
function SeccionRiesgoResidualGlobal({
  folio,
  locked,
  onSaved,
}: {
  folio: Folio;
  locked: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    beneficio_clinico: folio.beneficio_clinico || "",
    riesgo_residual_global: folio.riesgo_residual_global || "",
  });
  const nc = getNormaConfig(folio.norma_folio);
  const beneficio = nc.terminologia.beneficio;
  const objeto = nc.terminologia.objetoAnalisis;
  const refs = nc.normasReferencia.join(" / ");

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("folios")
      .update({
        beneficio_clinico: form.beneficio_clinico,
        riesgo_residual_global: form.riesgo_residual_global,
      })
      .eq("id", folio.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Evaluación global guardada" });
      setEditing(false);
      onSaved();
    }
  };

  const faltaBeneficio = !folio.beneficio_clinico?.trim();
  const faltaResidual = !folio.riesgo_residual_global?.trim();

  return (
    <div className="border rounded-md overflow-hidden relative">
      <SectionHeader number="V" title={`EVALUACIÓN GLOBAL DE RIESGO-BENEFICIO — ${refs}`} />
      {!locked && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-7 w-7"
          onClick={() => setEditing(!editing)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Alertas de completitud */}
      {(faltaBeneficio || faltaResidual) && (
        <div className="px-4 py-2 bg-destructive/5 border-b flex items-center gap-2 text-xs text-destructive">
          <span className="font-bold">⚠ Atención:</span>
          {faltaBeneficio && <span>{beneficio} requerido.</span>}
          {faltaResidual && <span>Evaluación de riesgo residual global requerida.</span>}
        </div>
      )}

      {editing ? (
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              {beneficio} del {objeto} — {refs}
            </label>
            <Textarea
              value={form.beneficio_clinico}
              onChange={(e) => setForm({ ...form, beneficio_clinico: e.target.value })}
              rows={3}
              placeholder={`Describa el ${beneficio.toLowerCase()} que justifica el uso del ${objeto.toLowerCase()} y los riesgos residuales aceptados.`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              Evaluación del Riesgo Residual Global — {refs}
            </label>
            <Textarea
              value={form.riesgo_residual_global}
              onChange={(e) => setForm({ ...form, riesgo_residual_global: e.target.value })}
              rows={4}
              placeholder={`Ejemplo: El riesgo residual global del ${objeto.toLowerCase()} es aceptable. Se identificaron N riesgos, de los cuales X son Aceptables y Y requirieron acción. Los beneficios superan los riesgos residuales conforme a ${refs}.`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1">
              <X className="h-3 w-3" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
              <Save className="h-3 w-3" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2">
          <div className="border-r border-b p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">
              {beneficio} — {refs}
            </p>
            <p className="text-sm whitespace-pre-line">
              {folio.beneficio_clinico || (
                <span className="text-muted-foreground/50 italic">Sin capturar — requerido antes de enviar a firma</span>
              )}
            </p>
          </div>
          <div className="border-b p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">
              Riesgo Residual Global — {refs}
            </p>
            <p className="text-sm whitespace-pre-line">
              {folio.riesgo_residual_global || (
                <span className="text-muted-foreground/50 italic">Sin capturar — requerido antes de enviar a firma</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sección Riesgos ──────────────────────────────────────────────────────────
function SeccionRiesgos({ riesgos, locked, folioId, folioCodigo, procesoEquipo, normaFolio, folioEstado }: { riesgos: Riesgo[]; locked: boolean; folioId: string; folioCodigo: string; procesoEquipo: string; normaFolio?: string | null; folioEstado?: string }) {
  const [riesgoForm, setRiesgoForm] = useState<{ open: boolean; riesgo: Riesgo | null }>({ open: false, riesgo: null });
  const [wizardOpen, setWizardOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const nc = getNormaConfig(normaFolio);
  const refs = nc.normasReferencia.join(" / ");
  const umbralCrit = nc.umbralNPRAlto;
  const umbralSev = nc.umbralSeveridadCritica;
  const umbralMed = nc.umbralNPRMedio;

  const handleDelete = async (r: Riesgo) => {
    if (!confirm(`¿Eliminar riesgo ${String(r.numero_id).padStart(2, "0")} — "${r.peligro_modo_falla}"?`)) return;
    const { error } = await supabase.from("riesgos").delete().eq("id", r.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Riesgo eliminado" });
      queryClient.invalidateQueries({ queryKey: ["folio", folioId] });
      queryClient.invalidateQueries({ queryKey: ["all-riesgos"] });
    }
  };

  const nextNumeroId = riesgos.length > 0 ? Math.max(...riesgos.map((r) => r.numero_id)) + 1 : 1;

  return (
    <>
      <div className="border rounded-md overflow-hidden">
        <SectionHeader number="III" title="GESTIÓN DE RIESGOS" />
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border-b text-[10px]">
          <span>
            🔴 <strong>Crítico</strong> (&gt; {umbralCrit} ó S ≥ {umbralSev})
          </span>
          <span>
            🟡 <strong>Mayor</strong> ({umbralMed}-{umbralCrit})
          </span>
          <span>
            🟢 <strong>Menor</strong> (&lt; {umbralMed})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[1800px]">
            <thead>
              <tr className="bg-muted/50">
                <th rowSpan={2} className="border-r border-b p-2 text-center font-bold w-10">
                  ID
                </th>
                <th colSpan={7} className="border-r border-b p-2 text-center font-bold">
                  1. IDENTIFICACIÓN — {refs}
                </th>
                <th colSpan={4} className="border-r border-b p-2 text-center font-bold">
                  2. EVALUACIÓN INICIAL
                </th>
                <th colSpan={5} className="border-r border-b p-2 text-center font-bold">
                  3. CONTROLES Y GESTIÓN — {refs}
                </th>
                <th colSpan={6} className={`border-b p-2 text-center font-bold ${!locked ? "border-r" : ""}`}>
                  4. EVALUACIÓN FINAL (RESIDUAL) + VERIFICACIÓN
                </th>
                {!locked && (
                  <th rowSpan={2} className="border-b p-2 text-center font-bold w-16">
                    Acc.
                  </th>
                )}
              </tr>
              <tr className="bg-muted/30 text-[10px] text-muted-foreground">
                <th className="border-r border-b p-1.5 min-w-[90px]">Etapa</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Peligro (fuente)</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Situación Peligrosa</th>
                <th className="border-r border-b p-1.5 min-w-[130px]">Secuencia de Eventos</th>
                <th className="border-r border-b p-1.5 min-w-[130px]">Modo de Falla</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Causa Potencial</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Efecto / Daño</th>
                <th className="border-r border-b p-1.5 text-center w-8">S</th>
                <th className="border-r border-b p-1.5 text-center w-8">O</th>
                <th className="border-r border-b p-1.5 text-center w-8">D</th>
                <th className="border-r border-b p-1.5 text-center w-14">NPR</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Controles Actuales</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Prevención</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Detección</th>
                <th className="border-r border-b p-1.5 min-w-[130px]">Acción Propuesta</th>
                <th className="border-r border-b p-1.5 min-w-[90px]">Responsable / Fecha</th>
                <th className="border-r border-b p-1.5 min-w-[110px]">Acción Implementada</th>
                <th className="border-r border-b p-1.5 text-center w-8">S'</th>
                <th className="border-r border-b p-1.5 text-center w-8">O'</th>
                <th className="border-r border-b p-1.5 text-center w-8">D'</th>
                <th className="border-r border-b p-1.5 text-center w-14">NPR'</th>
                <th className="border-r border-b p-1.5 min-w-[90px]">Verificación</th>
                <th className={`border-b p-1.5 text-center w-16 ${!locked ? "border-r" : ""}`}>Dictamen</th>
              </tr>
            </thead>
            <tbody>
              {riesgos.map((r) => {
                const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
                const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
                const needsAction = r.severidad >= umbralSev || npr > umbralCrit;
                const rowAlert = needsAction && !r.accion_propuesta;
                return (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 ${rowAlert ? "bg-destructive/5" : ""} ${!locked ? "hover:bg-muted/30 cursor-pointer" : ""}`}
                    onClick={() => !locked && setRiesgoForm({ open: true, riesgo: r })}
                  >
                    <td className="border-r p-1.5 text-center font-mono font-bold">
                      {String(r.numero_id).padStart(2, "0")}
                    </td>
                    {/* Grupo 1: Identificación FEUM / ISO 14971 */}
                    <td className="border-r p-1.5 max-w-[90px] whitespace-pre-line">{r.etapa_proceso}</td>
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">
                      {r.peligro || <span className="text-muted-foreground/50 italic text-[9px]">Sin capturar</span>}
                    </td>
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">
                      {r.situacion_peligrosa || <span className="text-muted-foreground/50 italic text-[9px]">Sin capturar</span>}
                    </td>
                    <td className="border-r p-1.5 max-w-[130px] whitespace-pre-line">
                      {r.secuencia_eventos || <span className="text-muted-foreground/50 italic text-[9px]">Sin capturar</span>}
                    </td>
                    <td className="border-r p-1.5 max-w-[130px] whitespace-pre-line">{r.peligro_modo_falla}</td>
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">{r.causa_potencial}</td>
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">{r.efecto_dano}</td>
                    {/* Grupo 2: Evaluación inicial */}
                    <td className={`border-r p-1.5 text-center font-bold ${r.severidad >= 9 ? "text-destructive bg-destructive/10" : ""}`}>
                      {r.severidad}
                    </td>
                    <td className="border-r p-1.5 text-center">{r.ocurrencia}</td>
                    <td className="border-r p-1.5 text-center">{r.deteccion}</td>
                    <td className="border-r p-1.5 text-center">
                      <NPRBadge npr={npr} severidad={r.severidad} />
                    </td>
                    {/* Grupo 3: Controles */}
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">{r.controles_actuales || <span className="text-muted-foreground">—</span>}</td>
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">
                      {r.controles_prevencion || <span className="text-muted-foreground/50 italic text-[9px]">Sin capturar</span>}
                    </td>
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">
                      {r.controles_deteccion || <span className="text-muted-foreground/50 italic text-[9px]">Sin capturar</span>}
                    </td>
                    <td className="border-r p-1.5 max-w-[130px] whitespace-pre-line">
                      {r.accion_propuesta ||
                        (needsAction && <span className="text-destructive font-bold">⚠ REQUERIDO</span>)}
                    </td>
                    <td className="border-r p-1.5 text-[10px]">
                      <div>{r.responsable || <span className="text-muted-foreground">—</span>}</div>
                      <div className="text-muted-foreground">{r.fecha_compromiso || ""}</div>
                    </td>
                    {/* Grupo 4: Residual + Verificación */}
                    <td className="border-r p-1.5 max-w-[110px] whitespace-pre-line">
                      {r.accion_implementada || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="border-r p-1.5 text-center">{r.sev_residual}</td>
                    <td className="border-r p-1.5 text-center">{r.ocu_residual}</td>
                    <td className="border-r p-1.5 text-center">{r.det_residual}</td>
                    <td className="border-r p-1.5 text-center">
                      <NPRBadge npr={nprRes} severidad={r.sev_residual} />
                    </td>
                    <td className="border-r p-1.5 text-[10px]">
                      <div>{r.verificado_por || <span className="text-muted-foreground">—</span>}</div>
                      <div className="text-muted-foreground text-[9px]">{r.resultado_verificacion || ""}</div>
                    </td>
                    <td className={`p-1.5 text-center text-[10px] font-semibold ${!locked ? "border-r" : ""} ${r.dictamen === "No Aceptable" ? "text-destructive" : r.dictamen === "Aceptable" ? "text-green-700" : "text-amber-600"}`}>
                      {r.dictamen}
                    </td>
                    {!locked && (
                      <td className="p-1 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-0.5 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setRiesgoForm({ open: true, riesgo: r })}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => handleDelete(r)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!locked && (
          <div className="p-3 border-t bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setWizardOpen(true)}
            >
              <Plus className="h-3 w-3" /> Agregar Riesgo
            </Button>
          </div>
        )}
      </div>

      {riesgoForm.open && (
        <RiesgoFormDialog
          open={riesgoForm.open}
          onClose={() => setRiesgoForm({ open: false, riesgo: null })}
          folioId={folioId}
          riesgo={riesgoForm.riesgo}
          nextNumeroId={nextNumeroId}
          normaFolio={normaFolio}
          folioEstado={folioEstado}
          procesoEquipo={procesoEquipo}
        />
      )}
      {wizardOpen && (
        <RiesgoWizardDialog
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          folioId={folioId}
          folioCodigo={folioCodigo}
          procesoEquipo={procesoEquipo}
          nextNumeroId={nextNumeroId}
          normaFolio={normaFolio}
        />
      )}
    </>
  );
}

// ─── Sección VII — Control de Cambios (versiones del folio) ──────────────────
function SeccionVersiones({
  folioId,
  numeroVersion,
  canEdit,
  onSaved,
}: {
  folioId: string;
  numeroVersion: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [motivo, setMotivo] = useState("");
  const [archivando, setArchivando] = useState(false);

  const { data: versiones, refetch } = useQuery({
    queryKey: ["folio-versiones", folioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folio_versiones")
        .select("id, version, motivo_revision, created_at, creado_por")
        .eq("folio_id", folioId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const creadoresIds = Array.from(
    new Set((versiones || []).map((v) => v.creado_por).filter(Boolean) as string[]),
  );

  const { data: creadores } = useQuery({
    queryKey: ["folio-versiones-creadores", folioId, creadoresIds.join(",")],
    enabled: creadoresIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nombre")
        .in("id", creadoresIds);
      if (error) throw error;
      return data;
    },
  });

  const nombrePorId = new Map<string, string>(
    (creadores || []).map((c) => [c.id, c.nombre]),
  );

  const handleArchivar = async () => {
    if (!motivo.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Describe brevemente el cambio realizado.",
        variant: "destructive",
      });
      return;
    }
    setArchivando(true);
    const { error } = await supabase.rpc("archivar_version_folio", {
      p_folio_id: folioId,
      p_motivo: motivo.trim(),
    });
    setArchivando(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Versión archivada",
      description: `Se archivó la versión ${numeroVersion} y se incrementó el número de versión.`,
    });
    setMotivo("");
    refetch();
    onSaved();
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="VII" title="CONTROL DE CAMBIOS — Historial de versiones del folio" />

      {/* Tabla de versiones */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-semibold w-20">Versión</th>
              <th className="text-left px-3 py-2 font-semibold w-32">Fecha</th>
              <th className="text-left px-3 py-2 font-semibold">Motivo de revisión</th>
              <th className="text-left px-3 py-2 font-semibold w-44">Realizado por</th>
            </tr>
          </thead>
          <tbody>
            {(versiones || []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground italic">
                  Sin versiones archivadas. La versión actual es <strong>{numeroVersion}</strong>.
                </td>
              </tr>
            )}
            {(versiones || []).map((v) => (
              <tr key={v.id} className="border-b last:border-b-0 align-top">
                <td className="px-3 py-2 font-mono">{v.version}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })}
                </td>
                <td className="px-3 py-2 whitespace-pre-line">
                  {v.motivo_revision?.trim() || (
                    <span className="text-muted-foreground/60 italic">Sin descripción</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {(v.creado_por && nombrePorId.get(v.creado_por)) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Captura de nueva versión */}
      {canEdit && (
        <div className="border-t bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Archivar nueva versión
            </p>
            <span className="text-[10px] text-muted-foreground">
              Versión actual: <strong className="font-mono">{numeroVersion}</strong> →
              se incrementará automáticamente al archivar
            </span>
          </div>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Describe el cambio realizado en esta revisión (ej: Se agregó riesgo R-05 por queja CL-2025-12)."
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1 text-xs"
              onClick={handleArchivar}
              disabled={archivando || !motivo.trim()}
            >
              <History className="h-3 w-3" />
              {archivando ? "Archivando..." : "Archivar versión"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useFolioDetail(id);
  const queryClient = useQueryClient();
  const { hasRole, org } = useAuth();
  const { toast } = useToast();

  const isAdmin = hasRole("admin") || hasRole("responsable_sanitario");

  const [enviandoFirma, setEnviandoFirma] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Folio no encontrado</div>;
  }

  const { folio, riesgos, comite } = data;
  const locked = folio.estado !== "Borrador" && !isAdmin;

  // Verificar si hay riesgos críticos sin evidencia — bloquea envío a firma
  const criticosSinEvidencia = riesgos.filter((r) => {
    const esCritico = (r.npr ?? 0) > 150 || r.severidad >= 9;
    const tieneAccion = !!r.accion_propuesta;
    const tieneEvidencia = r.anexos && (r.anexos as unknown[]).length > 0;
    return esCritico && tieneAccion && !tieneEvidencia;
  });
  const bloqueadoPorEvidencia = criticosSinEvidencia.length > 0;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["folio", id] });
    queryClient.invalidateQueries({ queryKey: ["folios"] });
  };

  // ── Enviar folio a firma ──
  const handleEnviarAFirma = async () => {
    setEnviandoFirma(true);
    try {
      // Validaciones de votación del comité (evidencia regulatoria)
      const { data: votosFolio } = await supabase
        .from("comite_votos")
        .select("user_id, voto")
        .eq("folio_id", folio.id);
      const { data: comentariosFolio } = await supabase
        .from("comite_comentarios")
        .select("id, tipo, resuelto")
        .eq("folio_id", folio.id);

      const votos = votosFolio || [];
      const rechazos = votos.filter((v) => v.voto === "rechaza").length;
      const observ = votos.filter((v) => v.voto === "aprueba_con_observaciones").length;
      const pendientes = comite.length - votos.filter((v) =>
        comite.some((c) => c.user_id === v.user_id),
      ).length;
      const obsNoResueltas = (comentariosFolio || []).filter(
        (c) => c.tipo === "observacion" && !c.resuelto,
      ).length;

      if (rechazos > 0) {
        toast({
          title: "⛔ Envío bloqueado",
          description: `Hay ${rechazos} rechazo(s) activo(s) del comité. Resuelve las observaciones antes de enviar a firma.`,
          variant: "destructive",
        });
        setEnviandoFirma(false);
        return;
      }
      if (pendientes > 0) {
        const ok = window.confirm(
          `${pendientes} miembro(s) del comité aún no han votado. ¿Deseas continuar de todas formas?`,
        );
        if (!ok) {
          setEnviandoFirma(false);
          return;
        }
      }
      if (observ > 0 || obsNoResueltas > 0) {
        const ok = window.confirm(
          `Hay ${observ + obsNoResueltas} observación(es) sin resolver. ¿Confirmas que fueron atendidas?`,
        );
        if (!ok) {
          setEnviandoFirma(false);
          return;
        }
      }

      const { data: result, error } = await supabase.functions.invoke("folio-workflow", {
        body: {
          accion: "enviar-a-firma",
          folio_id: folio.id,
        },
      });

      if (error) throw new Error(error.message);

      // El backend retorna errores NOM-241-SSA1-2025 con código 422
      if (result?.errores_nom241) {
        const errores: string[] = result.errores_nom241;
        toast({
          title: "⛔ Folio incompleto",
          description: `${errores.length} requisito${errores.length > 1 ? "s" : ""} pendiente${errores.length > 1 ? "s" : ""}. Revisa el checklist.`,
          variant: "destructive",
        });
        setShowChecklist(true);
        return;
      }

      if (result?.error) throw new Error(result.error);

      toast({
        title: "📨 Folio enviado a firma",
        description: "Se notificó a los miembros del comité por correo",
      });
      setShowChecklist(false);
      handleRefresh();
    } catch (err: any) {
      toast({
        title: "Error al enviar a firma",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setEnviandoFirma(false);
    }
  };

  return (
    <>
      {/* Overlay para cerrar checklist al hacer clic fuera */}
      {showChecklist && (
        <div className="fixed inset-0 z-40" onClick={() => setShowChecklist(false)} />
      )}
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/folios")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">Archivo Maestro de Gestión de Riesgos</h1>
              <Badge className={`text-[10px] ${getEstadoStyle(folio.estado)}`}>{folio.estado}</Badge>
              {(() => {
                const nc = getNormaConfig(folio.norma_folio);
                return (
                  <>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {nc.nombre}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {nc.metodologia}
                    </Badge>
                  </>
                );
              })()}
              {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">
              {(() => {
                const cf = ((org as any)?.codigo_formato || "").trim();
                const vf = ((org as any)?.version_formato || "").trim();
                const codigo = cf ? (vf ? `${cf} (${vf})` : cf) : "";
                if (codigo && org?.nombre) return `${codigo} · ${org.nombre}`;
                return codigo || org?.nombre || "";
              })()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => generateFolioPDF(folio, riesgos, comite, org)}
          >
            <Printer className="h-3 w-3" /> Generar PDF
          </Button>

          {/* Botón Enviar a Firma + Checklist NOM-241-SSA1-2025 */}
          {folio.estado === "Borrador" && (
            <div className="relative flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                {/* Botón checklist */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setShowChecklist((v) => !v)}
                  title="Ver checklist de requisitos"
                >
                  {(() => {
                    const items = evaluarChecklistNOM241(folio, riesgos, comite);
                    const bloqueantes = items.filter((i) => !i.ok && i.critico).length;
                    const advertencias = items.filter((i) => !i.ok && !i.critico).length;
                    return bloqueantes > 0
                      ? <span className="text-destructive font-bold">⛔ {bloqueantes}</span>
                      : advertencias > 0
                        ? <span className="text-amber-600 font-bold">⚠ {advertencias}</span>
                        : <span className="text-green-700 font-bold">✓</span>;
                  })()}
                  Checklist
                </Button>
                {/* Botón enviar */}
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleEnviarAFirma}
                  disabled={enviandoFirma || comite.length === 0}
                  title={comite.length === 0 ? "Agrega miembros al comité primero" : ""}
                >
                  <FileSignature className="h-3 w-3" />
                  {enviandoFirma ? "Enviando..." : "Enviar a Firma"}
                </Button>
              </div>

              {/* Popover del checklist */}
              {showChecklist && (
                <div className="absolute top-9 right-0 z-50">
                  <ChecklistNOM241 folio={folio} riesgos={riesgos} comite={comite} />
                </div>
              )}
            </div>
          )}

          {/* Indicador de estado En Firma */}
          {folio.estado === "En Firma" && (
            <Badge variant="outline" className="text-xs gap-1 text-primary border-primary">
              <FileSignature className="h-3 w-3" />
              En proceso de firma
            </Badge>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border p-6 space-y-5 print:shadow-none print:border-none">
        <div className="text-center border-b pb-4">
          <h2 className="text-base font-bold tracking-wide">{org?.nombre || "—"}</h2>
          <p className="text-xs text-muted-foreground italic">FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD</p>
          <p className="text-sm font-semibold mt-1">ARCHIVO MAESTRO DE GESTIÓN DE RIESGOS</p>
        </div>

        <SeccionDescripcion folio={folio} locked={locked} onSaved={handleRefresh} />

        {/* Comité con firma conectada */}
        <SeccionComite comite={comite} folioId={folio.id} folioEstado={folio.estado} onSaved={handleRefresh} />

        {/* II-B: Discusión y votación del comité técnico (pre-dictamen) */}
        <ComiteTab
          folioId={folio.id}
          orgId={folio.org_id}
          folioEstado={folio.estado}
          comite={comite}
        />

        <SeccionRiesgos riesgos={riesgos} locked={locked} folioId={folio.id} folioCodigo={folio.codigo} procesoEquipo={folio.proceso_equipo || ""} normaFolio={folio.norma_folio} folioEstado={folio.estado} />

        {/* Evidencias — pestaña documental para auditor */}
        <SeccionEvidencias riesgos={riesgos} folioCodigo={folio.codigo} folioId={folio.id} normaFolio={folio.norma_folio} />

        {/* Evaluación global de riesgo-beneficio — FEUM / ISO 14971 §7/§8 */}
        <SeccionRiesgoResidualGlobal folio={folio} locked={locked} onSaved={handleRefresh} />

        {/* Dictamen con zona exclusiva del RS */}
        <SeccionDictamen folio={folio} riesgos={riesgos} locked={locked} onSaved={handleRefresh} />

        {/* VII. Control de Cambios — historial de versiones */}
        <SeccionVersiones
          folioId={folio.id}
          numeroVersion={folio.numero_version}
          canEdit={isAdmin}
          onSaved={handleRefresh}
        />

        <div className="text-center pt-3 border-t">
          {(() => {
            const cf = ((org as any)?.codigo_formato || "").trim();
            const vf = ((org as any)?.version_formato || "").trim();
            if (!cf) return null;
            return (
              <p className="text-[10px] text-muted-foreground">
                {cf}{vf ? ` (${vf})` : ""}
              </p>
            );
          })()}
          <p className="text-[9px] text-muted-foreground">
            Documento confidencial propiedad de {org?.nombre || "la organización"}. Queda prohibido su uso, divulgación y/o
            reproducción total o parcial sin previa autorización.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
