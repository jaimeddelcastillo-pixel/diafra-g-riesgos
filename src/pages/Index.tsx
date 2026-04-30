import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeatMap } from "@/components/HeatMap";
import { NPRControlTable } from "@/components/NPRControlTable";
import { useFolios, useAllRiesgos, getNPRLevel } from "@/hooks/useFolios";
import {
  AlertTriangle,
  FileCheck,
  FileX2,
  ClipboardList,
  ShieldAlert,
  TrendingDown,
  Clock,
  UserX,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getNormaConfig } from "@/config/normas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

function semaforo(pct: number) {
  if (pct >= 80)
    return { color: "text-green-600", bg: "bg-green-50 border-green-200", label: "Conforme", icon: CheckCircle2 };
  if (pct >= 50)
    return { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "En proceso", icon: AlertCircle };
  return { color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Atención requerida", icon: AlertTriangle };
}

// ─── Componente KPI Card ───────────────────────────────────────────────────────
function KPICard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: any;
  color: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={onClick}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className={`h-9 w-9 ${color} opacity-60 mt-1`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Barra de progreso ────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { isSuperAdmin, isImpersonating, loading, org } = useAuth();
  const normaConfig = getNormaConfig(org?.norma_aplicable);
  const metodLabel = normaConfig.metodologia === "MULTI" ? "AMEF/ICH-Q9" : normaConfig.metodologia;

  const { data: folios, isLoading: loadingFolios } = useFolios();
  const { data: allRisks, isLoading: loadingRisks } = useAllRiesgos();

  if (!loading && isSuperAdmin() && !isImpersonating) return <Navigate to="/admin" replace />;

  const risks = allRisks || [];
  const fols = folios || [];
  const isLoading = loadingFolios || loadingRisks;

  // ── Cálculos SGC ────────────────────────────────────────────────────────────
  const foliosActivos = fols.filter((f) => f.estado !== "Cerrado");
  const critical = risks.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9);
  const aprobados = fols.filter((f) => f.conclusion === "Aprobado");
  const rechazados = fols.filter((f) => f.conclusion === "Rechazado");
  const enFirma = fols.filter((f) => f.estado === "En Firma");
  const borradores = fols.filter((f) => f.estado === "Borrador");

  // Acciones pendientes: riesgos críticos sin acción propuesta
  const accionesPendientes = risks.filter((r) => ((r.npr ?? 0) > 150 || r.severidad >= 9) && !r.accion_propuesta);

  // Acciones sin responsable: tienen acción propuesta pero sin responsable
  const sinResponsable = risks.filter((r) => r.accion_propuesta && !r.responsable);

  // Folios en borrador hace más de 30 días (vencidos)
  const foliosVencidos = borradores.filter((f) => diasDesde(f.fecha_inicio) > 30);

  // Críticos sin evidencia — NO CONFORMIDAD MAYOR NOM-241
  // Riesgo crítico con acción propuesta pero sin PDF adjunto
  const criticosSinEvidencia = risks.filter((r) => {
    const esCritico = (r.npr ?? 0) > 150 || r.severidad >= 9;
    const tieneAccion = !!r.accion_propuesta;
    const tieneEvidencia = (r as any).anexos && ((r as any).anexos as any[]).length > 0;
    return esCritico && tieneAccion && !tieneEvidencia;
  });

  // Folios con al menos 1 crítico sin evidencia
  const foliosSinEvidencia = fols.filter((f) => criticosSinEvidencia.some((r) => r.folio_id === f.id));

  // % reducción de riesgos críticos (inicial → residual)
  const criticalResidual = risks.filter((r) => (r.npr_residual ?? 0) > 150 || r.sev_residual >= 9);
  const riesgosMejoraron = risks.filter((r) => {
    const inicial = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
    const residual = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
    return residual < inicial;
  });
  const riesgosSinMitigacionEfectiva = risks.filter((r) => {
    const inicial = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
    const residual = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
    return residual >= inicial;
  });
  const reduccionCriticos =
    critical.length > 0 ? Math.round(((critical.length - criticalResidual.length) / critical.length) * 100) : 0;

  // Avance captura AMEF ponderado por estado del folio
  // Aprobado = 100%, En Firma = 75%, Borrador con riesgos = 50%, Rechazado = 0%, Sin riesgos = 0%
  const foliosConRiesgo = fols.filter((f) => risks.some((r) => r.folio_id === f.id));
  const puntosAMEF = fols.reduce((sum, f) => {
    const tieneRiesgos = risks.some((r) => r.folio_id === f.id);
    if (!tieneRiesgos) return sum + 0;
    if (f.conclusion === "Aprobado") return sum + 100;
    if (f.conclusion === "Rechazado") return sum + 0;
    if (f.estado === "En Firma") return sum + 75;
    return sum + 50; // Borrador con riesgos capturados
  }, 0);
  const avanceAMEF = fols.length > 0 ? Math.round(puntosAMEF / fols.length) : 0;

  // % aprobados sobre folios activos (excluye borradores sin riesgos)
  const foliosConActividad = fols.filter((f) => f.estado !== "Borrador" || risks.some((r) => r.folio_id === f.id));
  const pctAprobados =
    foliosConActividad.length > 0 ? Math.round((aprobados.length / foliosConActividad.length) * 100) : 0;

  // Semáforo general SGC
  const puntajeSGC = Math.round(
    (aprobados.length / Math.max(fols.length, 1)) * 40 + // 40% peso aprobados
      (avanceAMEF / 100) * 30 + // 30% peso avance AMEF
      ((critical.length === 0 ? 100 : reduccionCriticos) / 100) * 30, // 30% reducción riesgos
  );
  const sgc = semaforo(puntajeSGC);
  const SgcIcon = sgc.icon;

  // Todos los riesgos críticos ordenados por NPR descendente
  // Un auditor NOM-241-SSA1-2025 necesita ver TODOS, no solo los primeros
  const topRiesgos = [...risks]
    .filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9)
    .sort((a, b) => (b.npr ?? 0) - (a.npr ?? 0));

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Panorama general
          </p>
        </div>
        {/* Semáforo SGC */}
        {!isLoading && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${sgc.bg}`}>
            <SgcIcon className={`h-5 w-5 ${sgc.color}`} />
            <div>
              <p className={`text-sm font-bold ${sgc.color}`}>SGC {sgc.label}</p>
              <p className="text-[10px] text-muted-foreground">Índice: {puntajeSGC}/100</p>
            </div>
          </div>
        )}
      </div>

      {/* KPIs principales — fila 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Folios Activos"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : foliosActivos.length}
          icon={ClipboardList}
          color="text-primary"
          sub={`${borradores.length} en borrador`}
          onClick={() => navigate("/folios")}
        />
        <KPICard
          label="Riesgos Totales"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : risks.length}
          icon={ShieldAlert}
          color="text-accent"
          sub={`${foliosConRiesgo.length} folios con ${metodLabel}`}
        />
        <KPICard
          label="Riesgos Críticos"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : critical.length}
          icon={AlertTriangle}
          color={critical.length > 0 ? "text-destructive" : "text-success"}
          sub={`${criticalResidual.length} residuales`}
        />
        <KPICard
          label="Reducción NPR"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : `${reduccionCriticos}%`}
          icon={TrendingDown}
          color={reduccionCriticos >= 50 ? "text-success" : "text-amber-600"}
          sub="críticos → residual"
        />
        <KPICard
          label="Aprobados"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : aprobados.length}
          icon={FileCheck}
          color="text-success"
          sub={`${enFirma.length} en firma`}
          onClick={() => navigate("/folios")}
        />
        <KPICard
          label="Rechazados"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : rechazados.length}
          icon={FileX2}
          color={rechazados.length > 0 ? "text-destructive" : "text-muted-foreground"}
          sub="requieren corrección"
        />
      </div>

      {/* Resumen ejecutivo regulatorio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KPICard
          label="Riesgos críticos iniciales"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : critical.length}
          icon={AlertTriangle}
          color={critical.length > 0 ? "text-destructive" : "text-success"}
          sub="NPR >150 o S≥9"
        />
        <KPICard
          label="Riesgos críticos residuales"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : criticalResidual.length}
          icon={ShieldAlert}
          color={criticalResidual.length > 0 ? "text-destructive" : "text-success"}
          sub="persisten tras mitigación"
        />
        <KPICard
          label="Riesgos que mejoraron"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : riesgosMejoraron.length}
          icon={TrendingDown}
          color="text-success"
          sub="NPR residual < inicial"
        />
        <KPICard
          label="Sin mitigación efectiva"
          value={isLoading ? <Skeleton className="h-8 w-12" /> : riesgosSinMitigacionEfectiva.length}
          icon={AlertCircle}
          color={riesgosSinMitigacionEfectiva.length > 0 ? "text-destructive" : "text-success"}
          sub="NPR residual ≥ inicial"
        />
      </div>

      {/* Alertas operativas NOM-241-SSA1-2025 */}
      {!isLoading &&
        (accionesPendientes.length > 0 ||
          sinResponsable.length > 0 ||
          foliosVencidos.length > 0 ||
          criticosSinEvidencia.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* ALERTA MÁXIMA — No conformidad mayor */}
            {criticosSinEvidencia.length > 0 && (
              <div
                className="flex items-start gap-3 p-3 rounded-lg border-2 border-red-400 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => navigate("/folios")}
              >
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-800">
                    ⛔ {criticosSinEvidencia.length} crítico{criticosSinEvidencia.length > 1 ? "s" : ""} sin evidencia
                  </p>
                  <p className="text-xs text-red-700 font-medium">No conformidad mayor</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {foliosSinEvidencia.length} folio{foliosSinEvidencia.length > 1 ? "s" : ""} afectado
                    {foliosSinEvidencia.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}

            {accionesPendientes.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    {accionesPendientes.length} acción{accionesPendientes.length > 1 ? "es" : ""} sin definir
                  </p>
                  <p className="text-xs text-red-600">Riesgos críticos sin acción propuesta</p>
                </div>
              </div>
            )}
            {sinResponsable.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <UserX className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {sinResponsable.length} acción{sinResponsable.length > 1 ? "es" : ""} sin responsable
                  </p>
                  <p className="text-xs text-amber-600">Asignar responsable y fecha compromiso</p>
                </div>
              </div>
            )}
            {foliosVencidos.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {foliosVencidos.length} folio{foliosVencidos.length > 1 ? "s" : ""} en borrador +30 días
                  </p>
                  <p className="text-xs text-amber-600">Enviar a firma o cerrar</p>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Avance AMEF y estado por folio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avance captura AMEF */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Avance captura {metodLabel}
              <span
                className={`text-sm font-bold ${avanceAMEF >= 80 ? "text-green-600" : avanceAMEF >= 50 ? "text-amber-600" : "text-red-600"}`}
              >
                {avanceAMEF}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar
              value={foliosConRiesgo.length}
              max={fols.length}
              color={avanceAMEF >= 80 ? "bg-green-500" : avanceAMEF >= 50 ? "bg-amber-500" : "bg-red-500"}
            />
            <p className="text-xs text-muted-foreground">
              {foliosConRiesgo.length} de {fols.length} folios con riesgos capturados · Aprobado=100% · En Firma=75% ·
              Borrador=50% · Rechazado=0%
            </p>

            {/* Lista folios sin riesgos */}
            {fols
              .filter((f) => !risks.some((r) => r.folio_id === f.id))
              .slice(0, 4)
              .map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between text-xs py-1 border-t cursor-pointer hover:text-primary"
                  onClick={() => navigate(`/folios/${f.id}`)}
                >
                  <span className="font-mono text-primary">{f.codigo}</span>
                  <span className="text-muted-foreground truncate max-w-[140px]">{f.proceso_equipo}</span>
                  <Badge variant="outline" className="text-[9px]">
                    Sin {metodLabel}
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Estado de folios */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estado de folios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                label: "Aprobados",
                count: aprobados.length,
                color: "bg-green-500",
                text: "text-green-700",
                pct: pctAprobados,
              },
              {
                label: "En Firma",
                count: enFirma.length,
                color: "bg-blue-500",
                text: "text-blue-700",
                pct: fols.length > 0 ? Math.round((enFirma.length / fols.length) * 100) : 0,
              },
              {
                label: "Borrador",
                count: borradores.length,
                color: "bg-gray-400",
                text: "text-gray-600",
                pct: fols.length > 0 ? Math.round((borradores.length / fols.length) * 100) : 0,
              },
              {
                label: "Rechazados",
                count: rechazados.length,
                color: "bg-red-500",
                text: "text-red-700",
                pct: fols.length > 0 ? Math.round((rechazados.length / fols.length) * 100) : 0,
              },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={`font-medium ${item.text}`}>{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.count} folio{item.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${item.color}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right text-muted-foreground">{item.pct}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Folios en firma */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">En proceso de firma</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : enFirma.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                {criticosSinEvidencia.length > 0 ? (
                  <>
                    <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                    <p className="text-sm font-medium text-red-700">No se puede enviar a firma</p>
                    <p className="text-xs text-red-500 mt-1 max-w-[180px]">
                      {criticosSinEvidencia.length} riesgo{criticosSinEvidencia.length > 1 ? "s" : ""} crítico
                      {criticosSinEvidencia.length > 1 ? "s" : ""} sin evidencia adjunta
                    </p>
                    <button
                      className="text-xs text-primary underline mt-2 hover:opacity-70"
                      onClick={() => navigate("/folios")}
                    >
                      Ir a folios →
                    </button>
                  </>
                ) : accionesPendientes.length > 0 ? (
                  <>
                    <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
                    <p className="text-sm font-medium text-amber-700">Acciones pendientes por definir</p>
                    <p className="text-xs text-amber-500 mt-1 max-w-[180px]">
                      Completa las acciones de los riesgos críticos para poder enviar a firma
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm text-muted-foreground">Sin folios pendientes de firma</p>
                    <p className="text-xs text-muted-foreground mt-1">Todos los folios están al día</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {enFirma.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 cursor-pointer text-xs"
                    onClick={() => navigate(`/folios/${f.id}`)}
                  >
                    <div>
                      <p className="font-mono font-bold text-primary">{f.codigo}</p>
                      <p className="text-muted-foreground truncate max-w-[140px]">{f.proceso_equipo}</p>
                    </div>
                    <div className="text-right">
                      <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200">En Firma</Badge>
                      <p className="text-[9px] text-muted-foreground mt-1">{diasDesde(f.fecha_inicio)}d desde inicio</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Control NPR y matriz regulatoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabla de Control NPR</CardTitle>
        </CardHeader>
        <CardContent>
          <NPRControlTable risks={risks} onRiskClick={(folioId) => navigate(`/folios/${folioId}`)} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matriz de Calor regulatoria</CardTitle>
          </CardHeader>
          <CardContent>
            <HeatMap risks={risks} />
          </CardContent>
        </Card>
      </div>

      {/* Top 5 riesgos por NPR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Riesgos Críticos ({critical.length}) — Requieren acción documentada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Folio</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Peligro / Modo de falla</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs text-center">NPR</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs text-center">NPR Residual</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Nivel</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Responsable</th>
                  <th className="pb-2 font-medium text-muted-foreground text-xs">Acción</th>
                </tr>
              </thead>
              <tbody>
                {topRiesgos.map((r) => {
                  const npr = r.npr ?? r.severidad * r.ocurrencia * r.deteccion;
                  const nprRes = r.npr_residual ?? r.sev_residual * r.ocu_residual * r.det_residual;
                  const level = getNPRLevel(npr, r.severidad);
                  const mejoró = nprRes < npr;
                  return (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/folios/${r.folio_id}`)}
                    >
                      <td className="py-2 font-mono text-xs text-primary">{(r as any).folios?.codigo || "—"}</td>
                      <td className="py-2 max-w-[200px] truncate text-xs">{r.peligro_modo_falla}</td>
                      <td className="py-2 font-bold text-center">
                        <span
                          className={
                            level.label === "Crítico"
                              ? "text-destructive"
                              : level.label === "Mayor"
                                ? "text-amber-600"
                                : "text-green-600"
                          }
                        >
                          {level.dot} {npr}
                        </span>
                      </td>
                      <td className="py-2 text-center text-xs">
                        <span className={mejoró ? "text-green-600 font-medium" : "text-muted-foreground"}>
                          {mejoró ? "↓ " : ""}
                          {nprRes}
                        </span>
                      </td>
                      <td className="py-2">
                        <Badge variant={level.label === "Crítico" ? "destructive" : "secondary"} className="text-[9px]">
                          {level.label}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs">
                        {r.responsable || (
                          <span className="text-amber-600 font-medium flex items-center gap-1">
                            <UserX className="h-3 w-3" /> Sin asignar
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-xs max-w-[180px] truncate">
                        {r.accion_propuesta || <span className="text-destructive font-medium">⚠ Requerido</span>}
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && topRiesgos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground text-sm">
                      <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-1" />
                      Sin riesgos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
