import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, FileText, CheckCircle2, Clock, PenLine, Archive, Gift, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PanelGestionFirmas from "@/components/admin/PanelGestionFirmas";
import ComposicionIACard from "@/components/admin/ComposicionIACard";
import ModulosEmpresaCard from "@/components/admin/ModulosEmpresaCard";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OrgDetail {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  activo: boolean;
  max_users: number;
  trial_expires_at: string | null;
  estado?: "pendiente" | "activo" | "suspendido" | "cancelado";
  user_count: number;
  folio_count: number;
  folios_por_estado: {
    borrador: number;
    en_firma: number;
    aprobado: number;
    cerrado: number;
  };
  ultimo_folio_at: string | null;
  usuarios: Array<{
    id: string;
    nombre: string;
    email: string;
    cargo: string | null;
    role: string;
  }>;
  folios: Array<{
    id: string;
    codigo: string;
    proceso_equipo: string;
    estado: string;
    updated_at: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const planLabels: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const planBadgeStyles: Record<string, string> = {
  trial: "bg-yellow-100 text-yellow-800",
  starter: "bg-sky-100 text-sky-800",
  professional: "bg-blue-100 text-blue-800",
  enterprise: "bg-purple-100 text-purple-800",
};

const roleLabels: Record<string, string> = {
  aseguramiento_calidad: "Aseguramiento de Calidad",
  admin: "Administrador",
  comite_tecnico: "Comité Técnico",
  operador: "Operador",
  lectura: "Lectura",
  responsable_sanitario: "Resp. Sanitario",
};

const estadoConfig: Record<string, { label: string; icon: any; color: string }> = {
  Borrador:  { label: "Borrador",  icon: PenLine,       color: "text-muted-foreground" },
  "En Firma": { label: "En Firma", icon: Clock,         color: "text-amber-600" },
  Aprobado:  { label: "Aprobado",  icon: CheckCircle2,  color: "text-green-600" },
  Cerrado:   { label: "Cerrado",   icon: Archive,       color: "text-slate-500" },
};

function tiempoDesde(fecha: string): string {
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60_000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

// ─── Mini stat ────────────────────────────────────────────────────────────────

function StatBadge({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-3 rounded-lg bg-muted/40 min-w-[80px]">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-xl font-bold">{value}</span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminOrg() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activando, setActivando] = useState(false);
  const [reseteando, setReseteando] = useState(false);

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const { data, isLoading, error } = useQuery<{ org: OrgDetail }>({
    queryKey: ["admin-org", id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-stats", {
        body: { org_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { org: OrgDetail };
    },
    enabled: !!id,
  });

  const org = data?.org;

  const activarGratis = async () => {
    if (!id) return;
    if (!confirm("¿Activar esta organización en modo trial gratuito por 14 días?")) return;
    setActivando(true);
    try {
      const trialExp = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("organizations")
        .update({
          estado: "activo",
          activo: true,
          plan: "trial",
          trial_expires_at: trialExp,
          pending_price_id: null,
        })
        .eq("id", id);
      if (error) throw error;
      toast({
        title: "Cuenta activada",
        description: `${org?.nombre} ahora puede acceder en modo trial por 14 días.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-org", id] });
    } catch (err) {
      toast({
        title: "Error al activar",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setActivando(false);
    }
  };

  const resetearOnboarding = async () => {
    if (!id) return;
    if (!confirm("¿Resetear el onboarding de esta organización? La próxima vez que cualquier miembro entre verá nuevamente la bienvenida guiada.")) return;
    setReseteando(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          onboarding_completado: false,
          onboarding_saltado: false,
          onboarding_completado_at: null,
          onboarding_completado_por: null,
        })
        .eq("id", id);
      if (error) throw error;
      toast({
        title: "Onboarding reseteado",
        description: `${org?.nombre} verá nuevamente el flujo de bienvenida en el próximo login.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-org", id] });
    } catch (err) {
      toast({
        title: "Error al resetear",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setReseteando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="h-6 w-48 animate-pulse bg-muted rounded" />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{org?.nombre}</h1>
              <Badge variant="outline" className="font-mono text-xs">{org?.slug}</Badge>
              {org && (
                <Badge className={`text-[10px] ${planBadgeStyles[org.plan] ?? "bg-muted text-foreground"}`}>
                  {planLabels[org.plan] ?? org.plan}
                </Badge>
              )}
              {org?.estado === "pendiente" && (
                <Badge className="text-[10px] bg-amber-100 text-amber-800">Pendiente de pago</Badge>
              )}
              {org?.estado === "suspendido" && (
                <Badge variant="destructive" className="text-[10px]">Suspendida</Badge>
              )}
              {org?.estado === "cancelado" && (
                <Badge variant="destructive" className="text-[10px]">Cancelada</Badge>
              )}
              {org && !org.activo && (
                <Badge variant="destructive" className="text-[10px]">Suspendida</Badge>
              )}
            </div>
          )}
        </div>
        {org && org.estado !== "activo" && (
          <Button onClick={activarGratis} disabled={activando} size="sm" variant="outline">
            {activando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Gift className="h-4 w-4 mr-1.5" /> Activar gratis (trial 14d)
              </>
            )}
          </Button>
        )}
        {org && (
          <Button onClick={resetearOnboarding} disabled={reseteando} size="sm" variant="outline">
            {reseteando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Resetear onboarding
              </>
            )}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">Error cargando datos: {(error as any).message}</p>
      )}

      {/* ── Stats por estado ── */}
      {isLoading ? (
        <div className="flex gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 w-24 animate-pulse bg-muted rounded-lg" />)}
        </div>
      ) : org && (
        <div className="flex flex-wrap gap-3">
          <StatBadge label="Usuarios" value={org.user_count} icon={Users} color="text-blue-600" />
          <StatBadge label="Total folios" value={org.folio_count} icon={FileText} color="text-slate-600" />
          <StatBadge label="Borrador" value={org.folios_por_estado.borrador} icon={PenLine} color="text-muted-foreground" />
          <StatBadge label="En Firma" value={org.folios_por_estado.en_firma} icon={Clock} color="text-amber-600" />
          <StatBadge label="Aprobados" value={org.folios_por_estado.aprobado} icon={CheckCircle2} color="text-green-600" />
        </div>
      )}

      {id && <ComposicionIACard orgId={id} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Usuarios ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Usuarios ({org?.user_count ?? 0} / {org?.max_users ?? "?"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-muted rounded" />)}</div>
            ) : !org?.usuarios.length ? (
              <p className="text-sm text-muted-foreground">Sin usuarios registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Nombre</th>
                    <th className="text-left pb-2 font-medium">Rol</th>
                    <th className="text-left pb-2 font-medium">Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {org.usuarios.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2">
                        <span className="font-medium">{u.nombre}</span>
                        <span className="block text-[10px] text-muted-foreground">{u.email}</span>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {roleLabels[u.role] ?? u.role}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{u.cargo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── Folios recientes ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Folios recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-muted rounded" />)}</div>
            ) : !org?.folios.length ? (
              <p className="text-sm text-muted-foreground">Sin folios registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Código</th>
                    <th className="text-left pb-2 font-medium">Proceso</th>
                    <th className="text-left pb-2 font-medium">Estado</th>
                    <th className="text-left pb-2 font-medium">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {org.folios.map((f) => {
                    const cfg = estadoConfig[f.estado] ?? estadoConfig["Borrador"];
                    const Ic = cfg.icon;
                    return (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{f.codigo}</td>
                        <td className="py-2 text-xs truncate max-w-[140px]">{f.proceso_equipo}</td>
                        <td className="py-2">
                          <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                            <Ic className="h-3 w-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{tiempoDesde(f.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Gestión de firmas (solo super_admin) ── */}
      {org && <ModulosEmpresaCard orgId={org.id} />}
      {org && <PanelGestionFirmas orgId={org.id} />}
    </div>
  );
}
