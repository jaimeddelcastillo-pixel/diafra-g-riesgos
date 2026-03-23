import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileSignature, Lock, Printer, Plus } from "lucide-react";
import { useFolioDetail, getNPRLevel, getEstadoStyle } from "@/hooks/useFolios";
import type { Folio, Riesgo, FolioComite } from "@/hooks/useFolios";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div className="text-sm mt-0.5">{value || <span className="text-muted-foreground/50">—</span>}</div>
    </div>
  );
}

function SeccionDescripcion({ folio }: { folio: Folio }) {
  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="I" title="DESCRIPCIÓN" />
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

function SeccionRiesgos({ riesgos, locked }: { riesgos: Riesgo[]; locked: boolean }) {
  return (
    <div className="border rounded-md overflow-hidden">
      <SectionHeader number="III" title="GESTIÓN DE RIESGOS" />
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border-b text-[10px]">
        <span>🔴 <strong>Crítico</strong> (&gt; 150 ó S ≥ 9)</span>
        <span>🟡 <strong>Mayor</strong> (60-149)</span>
        <span>🟢 <strong>Menor</strong> (&lt; 60)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[1200px]">
          <thead>
            <tr className="bg-muted/50">
              <th rowSpan={2} className="border-r border-b p-2 text-center font-bold w-10">ID</th>
              <th colSpan={4} className="border-r border-b p-2 text-center font-bold">1. IDENTIFICACIÓN DE PELIGRO Y FALLA</th>
              <th colSpan={4} className="border-r border-b p-2 text-center font-bold">2. EVALUACIÓN INICIAL</th>
              <th colSpan={4} className="border-r border-b p-2 text-center font-bold">3. CONTROLES Y GESTIÓN</th>
              <th colSpan={5} className="border-b p-2 text-center font-bold">4. EVALUACIÓN FINAL (RESIDUAL)</th>
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
              <th className="border-b p-1.5 text-center w-14">NPR'</th>
            </tr>
          </thead>
          <tbody>
            {riesgos.map((r) => {
              const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
              const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
              const needsAction = r.severidad >= 9 || npr > 150;
              const rowAlert = needsAction && !r.accion_propuesta;
              return (
                <tr key={r.id} className={`border-b last:border-0 ${rowAlert ? "bg-destructive/5" : ""}`}>
                  <td className="border-r p-1.5 text-center font-mono font-bold">{String(r.numero_id).padStart(2, "0")}</td>
                  <td className="border-r p-1.5">{r.etapa_proceso}</td>
                  <td className="border-r p-1.5 max-w-[160px]">{r.peligro_modo_falla}</td>
                  <td className="border-r p-1.5 max-w-[140px]">{r.causa_potencial}</td>
                  <td className="border-r p-1.5 max-w-[140px]">{r.efecto_dano}</td>
                  <td className={`border-r p-1.5 text-center font-bold ${r.severidad >= 9 ? "text-destructive bg-destructive/10" : ""}`}>{r.severidad}</td>
                  <td className="border-r p-1.5 text-center">{r.ocurrencia}</td>
                  <td className="border-r p-1.5 text-center">{r.deteccion}</td>
                  <td className="border-r p-1.5 text-center"><NPRBadge npr={npr} severidad={r.severidad} /></td>
                  <td className="border-r p-1.5 max-w-[130px]">{r.controles_actuales}</td>
                  <td className="border-r p-1.5 max-w-[160px]">
                    {r.accion_propuesta || (needsAction && <span className="text-destructive font-bold">⚠ REQUERIDO</span>)}
                  </td>
                  <td className="border-r p-1.5">{r.responsable}</td>
                  <td className="border-r p-1.5 text-[10px]">{r.fecha_compromiso}</td>
                  <td className="border-r p-1.5 max-w-[140px]">{r.accion_implementada || <span className="text-muted-foreground">—</span>}</td>
                  <td className="border-r p-1.5 text-center">{r.sev_residual}</td>
                  <td className="border-r p-1.5 text-center">{r.ocu_residual}</td>
                  <td className="border-r p-1.5 text-center">{r.det_residual}</td>
                  <td className="p-1.5 text-center"><NPRBadge npr={nprRes} severidad={r.sev_residual} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!locked && (
        <div className="p-3 border-t bg-muted/20">
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Plus className="h-3 w-3" /> Agregar Riesgo
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useFolioDetail(id);

  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Folio no encontrado</div>;
  }

  const { folio, riesgos, comite } = data;
  const locked = folio.estado !== "Borrador";

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
        <SeccionDescripcion folio={folio} />
        <SeccionComite comite={comite} />
        <SeccionRiesgos riesgos={riesgos} locked={locked} />
        <div className="text-center pt-3 border-t">
          <p className="text-[10px] text-muted-foreground">FOR-SGC-11-01 (02)</p>
          <p className="text-[9px] text-muted-foreground">Documento confidencial propiedad de Diafra S.A. de C.V., queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.</p>
        </div>
      </div>
    </div>
  );
}
