import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Constants } from "@/integrations/supabase/types";
import { generateFolioPDF } from "@/lib/generateFolioPDF";

function NPRBadge({ npr, severidad }: { npr: number; severidad: number }) {
  const level = getNPRLevel(npr, severidad);
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${
      level.label === "Crítico" ? "text-destructive" : level.label === "Mayor" ? "text-warning" : "text-success"
    }`}>
      {level.dot} {npr}
    </span>
  );
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="bg-muted px-4 py-2 border-b">
      <h3 className="text-sm font-bold">{number}. {title}</h3>
    </div>
  );
}

function FormField({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`border-r border-b last:border-r-0 p-2 ${className}`}>
      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</span>
      <div className="text-sm mt-0.5 whitespace-pre-line">{value || <span className="text-muted-foreground/50">—</span>}</div>
    </div>
  );
}

// Editable description section
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
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("folios").update({
      proceso_equipo: form.proceso_equipo,
      origen: form.origen,
      desviacion_id: form.desviacion_id,
      control_cambios_id: form.control_cambios_id,
      fecha_inicio: form.fecha_inicio,
      fecha_cierre: form.fecha_cierre || null,
      alcance: form.alcance,
    }).eq("id", folio.id);
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
          <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="grid grid-cols-4 border-b">
          <FormField label="Folio de Gestión" value={<span className="font-mono font-bold">{folio.codigo}</span>} className="col-span-4" />
        </div>
        <div className="grid grid-cols-12">
          <FormField label="Proceso / Equipo Analizado" value={folio.proceso_equipo} className="col-span-4" />
          <FormField label="Origen" value={<Badge variant="outline" className="text-[10px]">{folio.origen}</Badge>} className="col-span-3" />
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
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Proceso / Equipo Analizado</label>
            <Input value={form.proceso_equipo} onChange={(e) => setForm({ ...form, proceso_equipo: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Origen</label>
            <Select value={form.origen} onValueChange={(v) => setForm({ ...form, origen: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.origen_riesgo.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">ID Desviación</label>
            <Input value={form.desviacion_id} onChange={(e) => setForm({ ...form, desviacion_id: e.target.value })} placeholder="DES-2026-XXX" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Control de Cambios</label>
            <Input value={form.control_cambios_id} onChange={(e) => setForm({ ...form, control_cambios_id: e.target.value })} placeholder="CC-2026-XXX" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha Inicio</label>
            <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fecha Cierre</label>
            <Input type="date" value={form.fecha_cierre} onChange={(e) => setForm({ ...form, fecha_cierre: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Alcance</label>
          <Textarea value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })} rows={3} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1"><X className="h-3 w-3" /> Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1"><Save className="h-3 w-3" /> {saving ? "Guardando..." : "Guardar"}</Button>
        </div>
      </div>
    </div>
  );
}

function SeccionComite({ comite }: { comite: FolioComite[] }) {
  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="II" title="FORMACIÓN Y APROBACIÓN DEL COMITÉ TÉCNICO" />
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
          {comite.map((m) => (
            <tr key={m.id} className="border-b last:border-0">
              <td className="p-2">{m.nombre}</td>
              <td className="p-2 font-medium">{m.cargo}</td>
              <td className="p-2 text-xs">{m.responsabilidad}</td>
              <td className="p-2 text-center">
                {m.firmado ? (
                  <div className="text-[10px]">
                    <span className="text-success font-bold">✓ Firmado</span>
                    <br />
                    <span className="text-muted-foreground">{m.fecha_firma ? new Date(m.fecha_firma).toLocaleString() : ""}</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                    <FileSignature className="h-3 w-3" /> Firmar
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          <span>🔴 <strong>Crítico</strong> (&gt; 150 ó S ≥ 9)</span>
          <span>🟡 <strong>Mayor</strong> (60-149)</span>
          <span>🟢 <strong>Menor</strong> (&lt; 60)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[1300px]">
            <thead>
              <tr className="bg-muted/50">
                <th rowSpan={2} className="border-r border-b p-2 text-center font-bold w-10">ID</th>
                <th colSpan={4} className="border-r border-b p-2 text-center font-bold">1. IDENTIFICACIÓN DE PELIGRO Y FALLA</th>
                <th colSpan={4} className="border-r border-b p-2 text-center font-bold">2. EVALUACIÓN INICIAL</th>
                <th colSpan={4} className="border-r border-b p-2 text-center font-bold">3. CONTROLES Y GESTIÓN</th>
                <th colSpan={5} className={`border-b p-2 text-center font-bold ${!locked ? "border-r" : ""}`}>4. EVALUACIÓN FINAL (RESIDUAL)</th>
                {!locked && <th rowSpan={2} className="border-b p-2 text-center font-bold w-16">Acc.</th>}
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
                  <tr key={r.id} className={`border-b last:border-0 ${rowAlert ? "bg-destructive/5" : ""} ${!locked ? "hover:bg-muted/30 cursor-pointer" : ""}`} onClick={() => !locked && setRiesgoForm({ open: true, riesgo: r })}>
                    <td className="border-r p-1.5 text-center font-mono font-bold">{String(r.numero_id).padStart(2, "0")}</td>
                    <td className="border-r p-1.5">{r.etapa_proceso}</td>
                    <td className="border-r p-1.5 max-w-[160px] whitespace-pre-line">{r.peligro_modo_falla}</td>
                    <td className="border-r p-1.5 max-w-[140px] whitespace-pre-line">{r.causa_potencial}</td>
                    <td className="border-r p-1.5 max-w-[140px] whitespace-pre-line">{r.efecto_dano}</td>
                    <td className={`border-r p-1.5 text-center font-bold ${r.severidad >= 9 ? "text-destructive bg-destructive/10" : ""}`}>{r.severidad}</td>
                    <td className="border-r p-1.5 text-center">{r.ocurrencia}</td>
                    <td className="border-r p-1.5 text-center">{r.deteccion}</td>
                    <td className="border-r p-1.5 text-center"><NPRBadge npr={npr} severidad={r.severidad} /></td>
                    <td className="border-r p-1.5 max-w-[130px] whitespace-pre-line">{r.controles_actuales}</td>
                    <td className="border-r p-1.5 max-w-[160px] whitespace-pre-line">
                      {r.accion_propuesta || (needsAction && <span className="text-destructive font-bold">⚠ REQUERIDO</span>)}
                    </td>
                    <td className="border-r p-1.5">{r.responsable}</td>
                    <td className="border-r p-1.5 text-[10px]">{r.fecha_compromiso}</td>
                    <td className="border-r p-1.5 max-w-[140px] whitespace-pre-line">{r.accion_implementada || <span className="text-muted-foreground">—</span>}</td>
                    <td className="border-r p-1.5 text-center">{r.sev_residual}</td>
                    <td className="border-r p-1.5 text-center">{r.ocu_residual}</td>
                    <td className="border-r p-1.5 text-center">{r.det_residual}</td>
                    <td className={`p-1.5 text-center ${!locked ? "border-r" : ""}`}><NPRBadge npr={nprRes} severidad={r.sev_residual} /></td>
                    {!locked && (
                      <td className="p-1 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-0.5 justify-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRiesgoForm({ open: true, riesgo: r })}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(r)}>
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
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setRiesgoForm({ open: true, riesgo: null })}>
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

export default function FolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useFolioDetail(id);
  const queryClient = useQueryClient();

  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Folio no encontrado</div>;
  }

  const { folio, riesgos, comite } = data;
  const locked = folio.estado !== "Borrador";

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["folio", id] });
    queryClient.invalidateQueries({ queryKey: ["folios"] });
  };

  return (
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
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Printer className="h-3 w-3" /> Generar PDF
          </Button>
          {folio.estado === "Borrador" && (
            <Button size="sm" className="gap-1 text-xs">
              <FileSignature className="h-3 w-3" /> Enviar a Firma
            </Button>
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
        <SeccionComite comite={comite} />
        <SeccionRiesgos riesgos={riesgos} locked={locked} folioId={folio.id} />
        <SeccionDictamen folio={folio} riesgos={riesgos} locked={locked} onSaved={handleRefresh} />
        <div className="text-center pt-3 border-t">
          <p className="text-[10px] text-muted-foreground">FOR-SGC-11-01 (02)</p>
          <p className="text-[9px] text-muted-foreground">Documento confidencial propiedad de Diafra S.A. de C.V., queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.</p>
        </div>
      </div>
    </div>
  );
}
