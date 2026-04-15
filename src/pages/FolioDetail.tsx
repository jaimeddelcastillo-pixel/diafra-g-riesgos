import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileSignature, Lock, Printer, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useFolioDetail, getNPRLevel, getEstadoStyle } from "@/hooks/useFolios";
import type { Folio, Riesgo, FolioComite } from "@/hooks/useFolios";
import { Skeleton } from "@/components/ui/skeleton";
import { RiesgoFormDialog } from "@/components/RiesgoFormDialog";
import { SeccionDictamen } from "@/components/SeccionDictamen";
import { SeccionEvidencias } from "@/components/SeccionEvidencias";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Constants } from "@/integrations/supabase/types";
import { generateFolioPDF } from "@/lib/generateFolioPDF";

// ─── Checklist NOM-241 / ISO 14971 ───────────────────────────────────────────
interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  critico: boolean; // true = bloquea envío a firma
}

function evaluarChecklistNOM241(folio: Folio, riesgos: Riesgo[], comite: FolioComite[]): CheckItem[] {
  const items: CheckItem[] = [];

  // ── Folio ──
  items.push({ id: "alcance", label: "Alcance del análisis capturado", ok: !!folio.alcance?.trim(), critico: true });
  items.push({ id: "modelo", label: "Número de modelo del dispositivo (§7.5.3)", ok: !!folio.numero_modelo?.trim(), critico: true });
  items.push({ id: "beneficio", label: "Beneficio clínico documentado (ISO 14971 §7)", ok: !!folio.beneficio_clinico?.trim(), critico: true });
  items.push({ id: "residual_global", label: "Evaluación de riesgo residual global (ISO 14971 §8)", ok: !!folio.riesgo_residual_global?.trim(), critico: true });
  items.push({ id: "comite", label: "Al menos un miembro en el comité", ok: comite.length > 0, critico: true });
  items.push({ id: "riesgos_count", label: "Al menos un riesgo analizado", ok: riesgos.length > 0, critico: true });

  // ── Por riesgo ──
  let sinPeligro = 0, sinSituacion = 0, sinAccionResp = 0, sinFecha = 0, sinVerif = 0, alarpSinJust = 0, criticoSinEvidencia = 0;

  for (const r of riesgos) {
    if (!r.peligro?.trim()) sinPeligro++;
    if (!r.situacion_peligrosa?.trim()) sinSituacion++;
    const npr = r.npr ?? 0;
    if (r.requiere_accion) {
      if (!r.responsable?.trim()) sinAccionResp++;
      if (!r.fecha_compromiso) sinFecha++;
    }
    if (r.accion_implementada?.trim() && !r.verificado_por?.trim()) sinVerif++;
    if (npr >= 125 && npr < 200 && r.dictamen === "Aceptable" && !r.justificacion_aceptabilidad?.trim()) alarpSinJust++;
    const esCritico = npr > 150 || r.severidad >= 9;
    const tieneEvidencia = r.anexos && (r.anexos as unknown[]).length > 0;
    if (esCritico && r.requiere_accion && !tieneEvidencia) criticoSinEvidencia++;
  }

  items.push({ id: "peligro", label: `Peligro (fuente) capturado en todos los riesgos${sinPeligro > 0 ? ` (${sinPeligro} pendiente${sinPeligro > 1 ? "s" : ""})` : ""}`, ok: sinPeligro === 0, critico: true });
  items.push({ id: "situacion", label: `Situación peligrosa capturada en todos los riesgos${sinSituacion > 0 ? ` (${sinSituacion} pendiente${sinSituacion > 1 ? "s" : ""})` : ""}`, ok: sinSituacion === 0, critico: true });
  items.push({ id: "responsable", label: `Acciones con responsable asignado${sinAccionResp > 0 ? ` (${sinAccionResp} sin asignar)` : ""}`, ok: sinAccionResp === 0, critico: true });
  items.push({ id: "fecha", label: `Acciones con fecha de compromiso${sinFecha > 0 ? ` (${sinFecha} sin fecha)` : ""}`, ok: sinFecha === 0, critico: true });
  items.push({ id: "evidencia_criticos", label: `Riesgos críticos con evidencia adjunta${criticoSinEvidencia > 0 ? ` (${criticoSinEvidencia} sin PDF)` : ""}`, ok: criticoSinEvidencia === 0, critico: true });
  items.push({ id: "verificacion", label: `Acciones implementadas con verificación${sinVerif > 0 ? ` (${sinVerif} sin verificar)` : ""}`, ok: sinVerif === 0, critico: false });
  items.push({ id: "alarp", label: `Riesgos zona ALARP con justificación de aceptabilidad${alarpSinJust > 0 ? ` (${alarpSinJust} sin justificar)` : ""}`, ok: alarpSinJust === 0, critico: false });

  // ── Informativos ──
  items.push({ id: "clase", label: "Clase del dispositivo especificada", ok: !!folio.clase_dispositivo?.trim(), critico: false });
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
        <p className="text-xs font-bold">Checklist NOM-241 / ISO 14971</p>
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
          Todos los requisitos NOM-241 cumplidos
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
    // Nuevos — trazabilidad y versión (NOM-241)
    numero_version: folio.numero_version || "1.0",
    numero_modelo: folio.numero_modelo || "",
    numero_lote: folio.numero_lote || "",
    clase_dispositivo: folio.clase_dispositivo || "",
  });

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
        clase_dispositivo: form.clase_dispositivo,
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
          <FormField label="Modelo / Ref." value={folio.numero_modelo} className="col-span-2" />
          <FormField label="Lote / Rev." value={folio.numero_lote} className="col-span-2" />
          <FormField label="Clase" value={folio.clase_dispositivo} className="col-span-2 border-r-0" />
        </div>
        <div className="grid grid-cols-12">
          <FormField label="Proceso / Equipo Analizado" value={folio.proceso_equipo} className="col-span-4" />
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
              Proceso / Equipo Analizado
            </label>
            <Input value={form.proceso_equipo} onChange={(e) => setForm({ ...form, proceso_equipo: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Origen</label>
            <Select value={form.origen} onValueChange={(v) => setForm({ ...form, origen: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.origen_riesgo.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        {/* Trazabilidad NOM-241 §7.5.3 */}
        <div className="border-t pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">
            Trazabilidad del Dispositivo — NOM-241 §7.5.3
          </p>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Versión Doc.</label>
              <Input
                value={form.numero_version}
                onChange={(e) => setForm({ ...form, numero_version: e.target.value })}
                placeholder="1.0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Modelo / Referencia</label>
              <Input
                value={form.numero_modelo}
                onChange={(e) => setForm({ ...form, numero_modelo: e.target.value })}
                placeholder="MOD-001"
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
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Clase Dispositivo</label>
              <Select
                value={form.clase_dispositivo}
                onValueChange={(v) => setForm({ ...form, clase_dispositivo: v })}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clase I">Clase I — Bajo riesgo</SelectItem>
                  <SelectItem value="Clase II">Clase II — Riesgo moderado</SelectItem>
                  <SelectItem value="Clase III">Clase III — Alto riesgo</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

  const TEXTO_COMPROMISO =
    "Declaro bajo protesta de decir verdad que he revisado el contenido íntegro de este Análisis de Gestión de Riesgos, que la información es correcta y completa conforme a la NOM-241-SSA1-2025 e ISO 14971:2019, y que mi firma electrónica registrada en este sistema tiene el mismo valor legal que mi firma autógrafa.";

  const { data: profiles } = useQuery({
    queryKey: ["profiles-firmas"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nombre, firma_url");
      return data || [];
    },
  });

  const getFirmaUrl = (userId: string | null) => {
    if (!userId) return null;
    const profile = profiles?.find((p: any) => p.id === userId);
    if (profile && (profile as any).firma_url) {
      const { data } = supabase.storage.from("firmas").getPublicUrl((profile as any).firma_url);
      return data.publicUrl;
    }
    return null;
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
            <th className="text-left p-2 font-semibold text-[11px] text-muted-foreground w-[22%]">CARGO</th>
            <th className="text-left p-2 font-semibold text-[11px] text-muted-foreground w-[34%]">RESPONSABILIDAD</th>
            <th className="text-center p-2 font-semibold text-[11px] text-muted-foreground w-[22%]">FIRMA</th>
          </tr>
        </thead>
        <tbody>
          {comite.map((m) => {
            const firmaImgUrl = m.firmado ? getFirmaUrl(m.user_id) : null;
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
                      {firmaImgUrl ? (
                        <img src={firmaImgUrl} alt={`Firma de ${m.nombre}`} className="h-10 w-auto object-contain" />
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
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal de confirmación de firma electrónica — NOM-241 / 21 CFR Part 11 */}
      {showFirmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-base">Confirmación de Firma Electrónica</h3>
            </div>
            <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground border-l-4 border-primary">
              <p className="font-semibold text-foreground mb-1">Declaración de firma — NOM-241-SSA1-2025</p>
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

// ─── Sección Riesgo Residual Global (ISO 14971 §7 / §8) ──────────────────────
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
      <SectionHeader number="V" title="EVALUACIÓN GLOBAL DE RIESGO-BENEFICIO — ISO 14971 §7/§8" />
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
          <span className="font-bold">⚠ NOM-241:</span>
          {faltaBeneficio && <span>Beneficio clínico requerido.</span>}
          {faltaResidual && <span>Evaluación de riesgo residual global requerida.</span>}
        </div>
      )}

      {editing ? (
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              Beneficio Clínico del Dispositivo — ISO 14971 §7
            </label>
            <Textarea
              value={form.beneficio_clinico}
              onChange={(e) => setForm({ ...form, beneficio_clinico: e.target.value })}
              rows={3}
              placeholder="Describa el beneficio clínico que justifica el uso del dispositivo y los riesgos residuales aceptados."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">
              Evaluación del Riesgo Residual Global — ISO 14971 §8
            </label>
            <Textarea
              value={form.riesgo_residual_global}
              onChange={(e) => setForm({ ...form, riesgo_residual_global: e.target.value })}
              rows={4}
              placeholder="Ejemplo: El riesgo residual global del dispositivo es aceptable. Se identificaron N riesgos, de los cuales X son Aceptables y Y requirieron acción. Los beneficios clínicos superan los riesgos residuales conforme a ISO 14971 §8."
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
              Beneficio Clínico — ISO 14971 §7
            </p>
            <p className="text-sm whitespace-pre-line">
              {folio.beneficio_clinico || (
                <span className="text-muted-foreground/50 italic">Sin capturar — requerido antes de enviar a firma</span>
              )}
            </p>
          </div>
          <div className="border-b p-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">
              Riesgo Residual Global — ISO 14971 §8
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
function SeccionRiesgos({ riesgos, locked, folioId }: { riesgos: Riesgo[]; locked: boolean; folioId: string }) {
  const [riesgoForm, setRiesgoForm] = useState<{ open: boolean; riesgo: Riesgo | null }>({ open: false, riesgo: null });
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
            🔴 <strong>Crítico</strong> (&gt; 150 ó S ≥ 9)
          </span>
          <span>
            🟡 <strong>Mayor</strong> (60-149)
          </span>
          <span>
            🟢 <strong>Menor</strong> (&lt; 60)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[1300px]">
            <thead>
              <tr className="bg-muted/50">
                <th rowSpan={2} className="border-r border-b p-2 text-center font-bold w-10">
                  ID
                </th>
                <th colSpan={4} className="border-r border-b p-2 text-center font-bold">
                  1. IDENTIFICACIÓN DE PELIGRO Y FALLA
                </th>
                <th colSpan={4} className="border-r border-b p-2 text-center font-bold">
                  2. EVALUACIÓN INICIAL
                </th>
                <th colSpan={4} className="border-r border-b p-2 text-center font-bold">
                  3. CONTROLES Y GESTIÓN
                </th>
                <th colSpan={5} className={`border-b p-2 text-center font-bold ${!locked ? "border-r" : ""}`}>
                  4. EVALUACIÓN FINAL (RESIDUAL)
                </th>
                {!locked && (
                  <th rowSpan={2} className="border-b p-2 text-center font-bold w-16">
                    Acc.
                  </th>
                )}
              </tr>
              <tr className="bg-muted/30 text-[10px] text-muted-foreground">
                <th className="border-r border-b p-1.5">Etapa</th>
                <th className="border-r border-b p-1.5">Peligro / Modo de Falla</th>
                <th className="border-r border-b p-1.5">Causa Potencial</th>
                <th className="border-r border-b p-1.5">Efecto / Daño</th>
                <th className="border-r border-b p-1.5 text-center w-8">S</th>
                <th className="border-r border-b p-1.5 text-center w-8">O</th>
                <th className="border-r border-b p-1.5 text-center w-8">D</th>
                <th className="border-r border-b p-1.5 text-center w-14">NPR</th>
                <th className="border-r border-b p-1.5">Controles Actuales</th>
                <th className="border-r border-b p-1.5">Acción Propuesta</th>
                <th className="border-r border-b p-1.5">Responsable</th>
                <th className="border-r border-b p-1.5">Fecha</th>
                <th className="border-r border-b p-1.5">Acción Implementada</th>
                <th className="border-r border-b p-1.5 text-center w-8">S'</th>
                <th className="border-r border-b p-1.5 text-center w-8">O'</th>
                <th className="border-r border-b p-1.5 text-center w-8">D'</th>
                <th className={`border-b p-1.5 text-center w-14 ${!locked ? "border-r" : ""}`}>NPR'</th>
              </tr>
            </thead>
            <tbody>
              {riesgos.map((r) => {
                const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
                const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
                const needsAction = r.severidad >= 9 || npr > 150;
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
                    <td className="border-r p-1.5">{r.etapa_proceso}</td>
                    <td className="border-r p-1.5 max-w-[160px] whitespace-pre-line">{r.peligro_modo_falla}</td>
                    <td className="border-r p-1.5 max-w-[140px] whitespace-pre-line">{r.causa_potencial}</td>
                    <td className="border-r p-1.5 max-w-[140px] whitespace-pre-line">{r.efecto_dano}</td>
                    <td
                      className={`border-r p-1.5 text-center font-bold ${r.severidad >= 9 ? "text-destructive bg-destructive/10" : ""}`}
                    >
                      {r.severidad}
                    </td>
                    <td className="border-r p-1.5 text-center">{r.ocurrencia}</td>
                    <td className="border-r p-1.5 text-center">{r.deteccion}</td>
                    <td className="border-r p-1.5 text-center">
                      <NPRBadge npr={npr} severidad={r.severidad} />
                    </td>
                    <td className="border-r p-1.5 max-w-[130px] whitespace-pre-line">{r.controles_actuales}</td>
                    <td className="border-r p-1.5 max-w-[160px] whitespace-pre-line">
                      {r.accion_propuesta ||
                        (needsAction && <span className="text-destructive font-bold">⚠ REQUERIDO</span>)}
                    </td>
                    <td className="border-r p-1.5">{r.responsable}</td>
                    <td className="border-r p-1.5 text-[10px]">{r.fecha_compromiso}</td>
                    <td className="border-r p-1.5 max-w-[140px] whitespace-pre-line">
                      {r.accion_implementada || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="border-r p-1.5 text-center">{r.sev_residual}</td>
                    <td className="border-r p-1.5 text-center">{r.ocu_residual}</td>
                    <td className="border-r p-1.5 text-center">{r.det_residual}</td>
                    <td className={`p-1.5 text-center ${!locked ? "border-r" : ""}`}>
                      <NPRBadge npr={nprRes} severidad={r.sev_residual} />
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
              onClick={() => setRiesgoForm({ open: true, riesgo: null })}
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
        />
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useFolioDetail(id);
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
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
      const { data: result, error } = await supabase.functions.invoke("folio-workflow", {
        body: {
          accion: "enviar-a-firma",
          folio_id: folio.id,
        },
      });

      if (error) throw new Error(error.message);

      // El backend retorna errores NOM-241 con código 422
      if (result?.errores_nom241) {
        const errores: string[] = result.errores_nom241;
        toast({
          title: "⛔ Folio incompleto — NOM-241",
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
              {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">FOR-SGC-11-01 · DIAFRA S.A. DE C.V.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => generateFolioPDF(folio, riesgos, comite)}
          >
            <Printer className="h-3 w-3" /> Generar PDF
          </Button>

          {/* Botón Enviar a Firma + Checklist NOM-241 */}
          {folio.estado === "Borrador" && (
            <div className="relative flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                {/* Botón checklist */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setShowChecklist((v) => !v)}
                  title="Ver checklist de requisitos NOM-241"
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
                  NOM-241
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
          <h2 className="text-base font-bold tracking-wide">DIAFRA S.A. DE C.V.</h2>
          <p className="text-xs text-muted-foreground italic">FORMATO — DEPARTAMENTO: SISTEMA DE GESTIÓN DE CALIDAD</p>
          <p className="text-sm font-semibold mt-1">ARCHIVO MAESTRO DE GESTIÓN DE RIESGOS</p>
        </div>

        <SeccionDescripcion folio={folio} locked={locked} onSaved={handleRefresh} />

        {/* Comité con firma conectada */}
        <SeccionComite comite={comite} folioId={folio.id} folioEstado={folio.estado} onSaved={handleRefresh} />

        <SeccionRiesgos riesgos={riesgos} locked={locked} folioId={folio.id} />

        {/* Evidencias — pestaña documental para auditor */}
        <SeccionEvidencias riesgos={riesgos} folioCodigo={folio.codigo} folioId={folio.id} />

        {/* Evaluación global de riesgo-beneficio — ISO 14971 §7/§8 */}
        <SeccionRiesgoResidualGlobal folio={folio} locked={locked} onSaved={handleRefresh} />

        {/* Dictamen con zona exclusiva del RS */}
        <SeccionDictamen folio={folio} riesgos={riesgos} locked={locked} onSaved={handleRefresh} />

        <div className="text-center pt-3 border-t">
          <p className="text-[10px] text-muted-foreground">FOR-SGC-11-01 (02)</p>
          <p className="text-[9px] text-muted-foreground">
            Documento confidencial propiedad de Diafra S.A. de C.V., queda prohibido su uso, divulgación y/o
            reproducción total o parcial sin previa autorización.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
