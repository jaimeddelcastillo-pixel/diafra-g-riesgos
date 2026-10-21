import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditTrail, useFolios, useAllRiesgos, getNPRLevel } from "@/hooks/useFolios";
import { useProfiles } from "@/hooks/useProfiles";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  AlertTriangle,
  FileSearch,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Activity,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function diasDesde(fecha: string) {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

function traducirAccion(tabla: string, accion: string): string {
  const acciones: Record<string, Record<string, string>> = {
    folios: {
      INSERT: "Folio creado",
      UPDATE: "Folio actualizado",
      DELETE: "Folio eliminado",
    },
    riesgos: {
      INSERT: "Riesgo agregado",
      UPDATE: "Riesgo modificado",
      DELETE: "Riesgo eliminado",
    },
    folio_comite: {
      INSERT: "Miembro agregado al comité",
      UPDATE: "Firma registrada",
      DELETE: "Miembro removido del comité",
    },
  };
  return acciones[tabla]?.[accion] || `${accion} en ${tabla}`;
}

function nivelBadge(label: string) {
  if (label === "Crítico") return "bg-red-100 text-red-700 border-red-200";
  if (label === "Mayor") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-green-100 text-green-700 border-green-200";
}

// ─── Tab 1: Resumen de cumplimiento NOM-241-SSA1-2025 ───────────────────────────────────
function TabCumplimiento() {
  const navigate = useNavigate();
  const { data: folios = [], isLoading: lf } = useFolios();
  const { data: risks = [], isLoading: lr } = useAllRiesgos();

  if (lf || lr) return <Skeleton className="h-64 w-full" />;

  const criticos = risks.filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9);
  const sinAccion = criticos.filter((r) => !r.accion_propuesta);
  const sinResponsable = criticos.filter((r) => r.accion_propuesta && !r.responsable);
  const sinEvidencia = criticos.filter(
    (r) => r.accion_propuesta && (!(r as any).anexos || (r as any).anexos.length === 0),
  );
  const sinFecha = criticos.filter((r) => r.accion_propuesta && !r.fecha_compromiso);
  const aprobados = folios.filter((f) => f.conclusion === "Aprobado");
  const enFirma = folios.filter((f) => f.estado === "En Firma");
  const borradores = folios.filter((f) => f.estado === "Borrador");

  const items = [
    {
      label: "Riesgos críticos con acción definida",
      ok: criticos.length - sinAccion.length,
      total: criticos.length,
      problema: sinAccion.length > 0 ? `${sinAccion.length} sin acción — No conformidad mayor` : null,
      nivel: sinAccion.length > 0 ? "critico" : "ok",
    },
    {
      label: "Acciones con responsable asignado",
      ok: criticos.filter((r) => r.accion_propuesta && r.responsable).length,
      total: criticos.filter((r) => r.accion_propuesta).length,
      problema: sinResponsable.length > 0 ? `${sinResponsable.length} sin responsable` : null,
      nivel: sinResponsable.length > 0 ? "mayor" : "ok",
    },
    {
      label: "Acciones con fecha compromiso",
      ok: criticos.filter((r) => r.accion_propuesta && r.fecha_compromiso).length,
      total: criticos.filter((r) => r.accion_propuesta).length,
      problema: sinFecha.length > 0 ? `${sinFecha.length} sin fecha` : null,
      nivel: sinFecha.length > 0 ? "mayor" : "ok",
    },
    {
      label: "Evidencias adjuntas (PDF)",
      ok: criticos.filter((r) => r.accion_propuesta && (r as any).anexos?.length > 0).length,
      total: criticos.filter((r) => r.accion_propuesta).length,
      problema: sinEvidencia.length > 0 ? `${sinEvidencia.length} sin evidencia — No conformidad mayor` : null,
      nivel: sinEvidencia.length > 0 ? "critico" : "ok",
    },
    {
      label: "Folios aprobados por Responsable Sanitario",
      ok: aprobados.length,
      total: folios.length,
      problema: borradores.length > 0 ? `${borradores.length} en borrador sin enviar` : null,
      nivel: borradores.length > folios.length * 0.3 ? "mayor" : "ok",
    },
  ];

  const puntaje = Math.round((items.filter((i) => i.nivel === "ok").length / items.length) * 100);

  return (
    <div className="space-y-4">
      {/* Índice general */}
      <div
        className={`flex items-center gap-4 p-4 rounded-lg border-2 ${
          puntaje === 100
            ? "border-green-400 bg-green-50"
            : puntaje >= 60
              ? "border-amber-400 bg-amber-50"
              : "border-red-400 bg-red-50"
        }`}
      >
        <ShieldCheck
          className={`h-10 w-10 ${
            puntaje === 100 ? "text-green-600" : puntaje >= 60 ? "text-amber-600" : "text-red-600"
          }`}
        />
        <div>
          <p
            className={`text-xl font-bold ${
              puntaje === 100 ? "text-green-800" : puntaje >= 60 ? "text-amber-800" : "text-red-800"
            }`}
          >
            Índice de cumplimiento: {puntaje}%
          </p>
          <p className="text-sm text-muted-foreground">
            {puntaje === 100
              ? "Sistema conforme — listo para auditoría"
              : puntaje >= 60
                ? "En proceso — resolver observaciones antes de auditoría"
                : "Atención requerida — no conformidades abiertas"}
          </p>
        </div>
      </div>

      {/* Lista de verificación */}
      <div className="space-y-2">
        {items.map((item, i) => {
          const pct = item.total > 0 ? Math.round((item.ok / item.total) * 100) : 100;
          return (
            <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
              {item.nivel === "ok" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              ) : item.nivel === "critico" ? (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.ok}/{item.total}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right">{pct}%</span>
                </div>
                {item.problema && (
                  <p
                    className={`text-xs mt-1 font-medium ${
                      item.nivel === "critico" ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    {item.problema}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab 2: Riesgos críticos — vista auditor ──────────────────────────────────
function TabRiesgosCriticos() {
  const navigate = useNavigate();
  const { data: risks = [], isLoading } = useAllRiesgos();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const criticos = [...risks]
    .filter((r) => (r.npr ?? 0) > 150 || r.severidad >= 9)
    .sort((a, b) => (b.npr ?? 0) - (a.npr ?? 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-semibold">Folio</th>
            <th className="text-left p-2 font-semibold">Peligro / Modo de falla</th>
            <th className="text-center p-2 font-semibold">S</th>
            <th className="text-center p-2 font-semibold">NPR</th>
            <th className="text-center p-2 font-semibold">NPR Res.</th>
            <th className="text-left p-2 font-semibold">Acción</th>
            <th className="text-left p-2 font-semibold">Responsable</th>
            <th className="text-center p-2 font-semibold">F. Compromiso</th>
            <th className="text-center p-2 font-semibold">Evidencia</th>
            <th className="text-center p-2 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {criticos.map((r) => {
            const npr = r.npr ?? 0;
            const nprRes = r.npr_residual ?? 0;
            const level = getNPRLevel(npr, r.severidad);
            const tieneAccion = !!r.accion_propuesta;
            const tieneResponsable = !!r.responsable;
            const tieneFecha = !!r.fecha_compromiso;
            const tieneEvidencia = (r as any).anexos?.length > 0;
            const completo = tieneAccion && tieneResponsable && tieneFecha && tieneEvidencia;

            return (
              <tr
                key={r.id}
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/folios/${r.folio_id}`)}
              >
                <td className="p-2 font-mono font-bold text-primary">{(r as any).folios?.codigo || "—"}</td>
                <td className="p-2 max-w-[160px] truncate">{r.peligro_modo_falla}</td>
                <td className={`p-2 text-center font-bold ${r.severidad >= 9 ? "text-red-600" : ""}`}>{r.severidad}</td>
                <td className="p-2 text-center">
                  <Badge className={`text-[9px] ${nivelBadge(level.label)}`}>{npr}</Badge>
                </td>
                <td className="p-2 text-center text-muted-foreground">{nprRes}</td>
                <td className="p-2 max-w-[140px] truncate">
                  {r.accion_propuesta || <span className="text-red-600 font-medium">SIN ACCION</span>}
                </td>
                <td className="p-2">{r.responsable || <span className="text-amber-600">—</span>}</td>
                <td className="p-2 text-center">{r.fecha_compromiso || <span className="text-amber-600">—</span>}</td>
                <td className="p-2 text-center">
                  {tieneEvidencia ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                  )}
                </td>
                <td className="p-2 text-center">
                  {completo ? (
                    <Badge className="text-[9px] bg-green-100 text-green-700">Completo</Badge>
                  ) : (
                    <Badge className="text-[9px] bg-red-100 text-red-700">Incompleto</Badge>
                  )}
                </td>
              </tr>
            );
          })}
          {criticos.length === 0 && (
            <tr>
              <td colSpan={10} className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                Sin riesgos críticos
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground p-2 border-t">
        {criticos.length} riesgos críticos · Haz clic en cualquier fila para ir al folio
      </p>
    </div>
  );
}

// ─── Tab 3: Log de actividad (lo que antes era "Auditoría") ──────────────────
function TabLog() {
  const { data: entries = [], isLoading } = useAuditTrail();
  const { data: profiles = [] } = useProfiles();

  const getNombre = (userId: string | null) => {
    if (!userId) return "Sistema";
    const p = profiles.find((p: any) => p.id === userId);
    return p ? p.nombre : "Usuario desconocido";
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-semibold">Fecha y hora</th>
            <th className="text-left p-2 font-semibold">Usuario</th>
            <th className="text-left p-2 font-semibold">Acción</th>
            <th className="text-left p-2 font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const accionLegible = traducirAccion(entry.tabla, entry.accion);
            const detalle = entry.valor_nuevo
              ? (entry.valor_nuevo as any).codigo ||
                (entry.valor_nuevo as any).peligro_modo_falla ||
                (entry.valor_nuevo as any).nombre ||
                entry.registro_id.slice(0, 12) + "..."
              : entry.registro_id.slice(0, 12) + "...";

            return (
              <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="p-2 font-mono text-muted-foreground whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {(entry as any).origen === "sistema" ? "Sistema / migración" : getNombre(entry.user_id)}
                  </div>
                  {Array.isArray(entry.suplencias) && entry.suplencias.map((s: any, i: number) => <div key={i} className="text-xs text-muted-foreground">por suplencia de {s?.titular_nombre}</div>)}
                  {((entry as any).motivo || (entry as any).autorizado_por) && (
                    <div className="text-[10px] text-muted-foreground">
                      {(entry as any).motivo}{(entry as any).autorizado_por ? ` · Autorizó: ${(entry as any).autorizado_por}` : ""}
                    </div>
                  )}
                </td>
                <td className="p-2">
                  <Badge variant="outline" className="text-[9px]">
                    {accionLegible}
                  </Badge>
                </td>
                <td className="p-2 text-muted-foreground max-w-[200px] truncate">{detalle}</td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-muted-foreground">
                Sin actividad registrada
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground p-2 border-t">
        Mostrando últimas {entries.length} acciones · Registro inalterable del sistema
      </p>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Auditoria() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Cumplimiento · Trazabilidad
        </p>
      </div>

      <Tabs defaultValue="cumplimiento">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="cumplimiento" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cumplimiento
          </TabsTrigger>
          <TabsTrigger value="criticos" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            Riesgos críticos
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Log de actividad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cumplimiento">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Lista de verificación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TabCumplimiento />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="criticos">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Vista completa de riesgos críticos — Para auditor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TabRiesgosCriticos />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Log de actividad del sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TabLog />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
