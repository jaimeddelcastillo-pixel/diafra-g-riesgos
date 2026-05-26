import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2, Pencil, LogIn, AlertTriangle, Clock,
  Users, FileText, CheckCircle2, ChevronDown, ChevronUp,
  UserPlus, KeyRound, ShieldCheck, Trash2, Mail,
  MoreHorizontal, Pause, Play, RefreshCw, Send, ArrowUpDown,
  Sparkles, CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";

interface TraceaUser {
  id: string;
  nombre: string;
  email: string;
  cargo: string | null;
  role: string;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OrgStats {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  activo: boolean;
  max_users: number;
  trial_expires_at: string | null;
  created_at: string;
  user_count: number;
  folio_count: number;
  folios_mes: number;
  ultimo_folio_at: string | null;
  estado?: string;
}

interface Metrics {
  orgs_activas: number;
  orgs_trial: number;
  usuarios_totales: number;
  folios_mes: number;
}

interface AdminData {
  metrics: Metrics;
  orgs: OrgStats[];
  alertas: {
    trials_por_vencer: OrgStats[];
    sin_actividad: OrgStats[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const planLabels: Record<string, string> = { trial: "Trial", pro: "Pro", enterprise: "Enterprise" };
const planStyles: Record<string, string> = {
  trial: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pro: "bg-blue-100 text-blue-800 border-blue-200",
  enterprise: "bg-purple-100 text-purple-800 border-purple-200",
};

function diasParaVencer(fecha: string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000);
}

function tiempoDesde(fecha: string | null): string {
  if (!fecha) return "Sin actividad";
  const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60_000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days}d`;
  return `hace ${Math.floor(days / 30)}m`;
}

// ─── Tarjeta KPI ──────────────────────────────────────────────────────────────

function KPI({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`h-11 w-11 rounded-full flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Admin() {
  const { isSuperAdmin, startImpersonation } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal de motivo de impersonación (Modelo B - ISO 27001)
  const [imperOrg, setImperOrg] = useState<OrgStats | null>(null);
  const [imperMotivo, setImperMotivo] = useState("");
  const [imperLoading, setImperLoading] = useState(false);
  const [imperTicketId, setImperTicketId] = useState<string>("");

  // Tickets abiertos de la org seleccionada (para vincular)
  const { data: ticketsOrg = [] } = useQuery({
    queryKey: ["tickets-org", imperOrg?.id],
    enabled: !!imperOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, codigo, asunto, prioridad, estado")
        .eq("org_id", imperOrg!.id)
        .neq("estado", "Cerrado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const confirmImpersonation = async () => {
    if (!imperOrg) return;
    if (imperMotivo.trim().length < 10) {
      toast.error("Describe el motivo (mínimo 10 caracteres)");
      return;
    }
    setImperLoading(true);
    try {
      await startImpersonation(
        {
          id: imperOrg.id,
          nombre: imperOrg.nombre,
          slug: imperOrg.slug,
          plan: imperOrg.plan,
          activo: imperOrg.activo,
          max_users: imperOrg.max_users,
          trial_expires_at: imperOrg.trial_expires_at,
          logo_url: (imperOrg as any).logo_url ?? null,
        },
        imperMotivo,
        imperTicketId || null,
      );
      setImperOrg(null);
      setImperMotivo("");
      setImperTicketId("");
      navigate("/");
    } catch (e: any) {
      toast.error("No se pudo registrar la impersonación: " + (e?.message ?? "error"));
    } finally {
      setImperLoading(false);
    }
  };

  const [alertasOpen, setAlertasOpen] = useState(true);
  const [editOrg, setEditOrg] = useState<OrgStats | null>(null);
  const [editForm, setEditForm] = useState({ plan: "", trial_expires_at: "", max_users: 5 });
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Nuevas acciones sobre orgs ──
  const [changePlanOrg, setChangePlanOrg] = useState<OrgStats | null>(null);
  const [changePlanValue, setChangePlanValue] = useState<string>("");
  const [reminderOrg, setReminderOrg] = useState<OrgStats | null>(null);
  const [reminderMotivo, setReminderMotivo] = useState("");
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<OrgStats | null>(null);
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState("");
  const [reactivationOrg, setReactivationOrg] = useState<{ id: string; nombre: string; dias?: number } | null>(null);
  const [reactivationMotivo, setReactivationMotivo] = useState("");

  // ── Equipo TRACEA ──
  const [newTraceaOpen, setNewTraceaOpen] = useState(false);
  const [newTraceaForm, setNewTraceaForm] = useState({ nombre: "", email: "", password: "", cargo: "" });
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<TraceaUser | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<TraceaUser | null>(null);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState<TraceaUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ nombre: "", cargo: "" });

  // ── Nueva organización (super_admin) ──
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({
    org_nombre: "",
    org_slug: "",
    norma_aplicable: "NOM-241",
    plan: "trial",
    trial_dias: 14,
    max_users: 5,
    admin_nombre: "",
    admin_email: "",
    admin_password: "",
    admin_cargo: "",
  });

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const { data, isLoading } = useQuery<AdminData>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-stats");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as AdminData;
    },
    staleTime: 60_000,
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("organizations").update({ activo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Estado actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const orgActionMutation = useMutation({
    mutationFn: async (payload: {
      action: "suspender" | "reactivar" | "cambiar-plan" | "eliminar" | "recordatorio-pago" | "enviar-reactivacion";
      org_id: string;
      plan?: string;
      motivo?: string;
      confirm_nombre?: string;
      dias_inactividad?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("org-action", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(data?.message || "Acción ejecutada");
      setChangePlanOrg(null);
      setReminderOrg(null);
      setReminderMotivo("");
      setDeleteOrgTarget(null);
      setDeleteOrgConfirm("");
      setReactivationOrg(null);
      setReactivationMotivo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, plan, trial_expires_at, max_users }: {
      id: string; plan: string; trial_expires_at: string | null; max_users: number;
    }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ plan, trial_expires_at, max_users })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Organización actualizada");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (org: OrgStats) => {
    setEditOrg(org);
    setEditForm({
      plan: org.plan,
      trial_expires_at: org.trial_expires_at ? org.trial_expires_at.slice(0, 10) : "",
      max_users: org.max_users,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editOrg) return;
    updateOrgMutation.mutate({
      id: editOrg.id,
      plan: editForm.plan,
      trial_expires_at: editForm.trial_expires_at
        ? new Date(editForm.trial_expires_at + "T23:59:59").toISOString()
        : null,
      max_users: Math.max(1, Number(editForm.max_users)),
    });
  };

  // Query usuarios TRACEA (en user_roles, no tienen org)
  const { data: traceaUsers = [], refetch: refetchTracea } = useQuery<TraceaUser[]>({
    queryKey: ["tracea-users"],
    queryFn: async () => {
      // Equipo TRACEA = solo super_admins (acceso global, sin org_member o en org 'tracea')
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "super_admin");
      if (rErr) throw rErr;

      const userIds = (roles ?? []).map((r) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, nombre, email, cargo")
        .in("id", userIds);
      if (pErr) throw pErr;

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      return (roles || []).map((r) => {
        const p = profileMap.get(r.user_id);
        return {
          id: r.user_id,
          nombre: p?.nombre ?? "Sin nombre",
          email: p?.email ?? "",
          cargo: p?.cargo ?? null,
          role: r.role,
        };
      });
    },
  });

  const createTraceaMutation = useMutation({
    mutationFn: async (form: typeof newTraceaForm) => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: form.email, password: form.password, nombre: form.nombre, cargo: form.cargo, role: "super_admin", org_id: null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      refetchTracea();
      toast.success("Usuario TRACEA creado.");
      setNewTraceaOpen(false);
      setNewTraceaForm({ nombre: "", email: "", password: "", cargo: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetTraceaPwMutation = useMutation({
    mutationFn: async ({ user_id, new_password }: { user_id: string; new_password: string }) => {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id, new_password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada.");
      setResetPwOpen(false);
      setResetPwValue("");
      setResetPwUser(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTraceaMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      refetchTracea();
      toast.success("Usuario eliminado.");
      setDeleteUserOpen(false);
      setDeleteUserTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTraceaMutation = useMutation({
    mutationFn: async ({ id, nombre, cargo }: { id: string; nombre: string; cargo: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ nombre, cargo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTracea();
      toast.success("Usuario actualizado.");
      setEditUserOpen(false);
      setEditUserTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createOrgMutation = useMutation({
    mutationFn: async (form: typeof newOrgForm) => {
      const { data, error } = await supabase.functions.invoke("admin-create-org", {
        body: form,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Organización creada con su administrador.");
      setNewOrgOpen(false);
      setNewOrgForm({
        org_nombre: "",
        org_slug: "",
        norma_aplicable: "NOM-241",
        plan: "trial",
        trial_dias: 14,
        max_users: 5,
        admin_nombre: "",
        admin_email: "",
        admin_password: "",
        admin_cargo: "",
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const metrics = data?.metrics;
  const orgs = data?.orgs ?? [];
  const alertas = data?.alertas;
  const totalAlertas = (alertas?.trials_por_vencer.length ?? 0) + (alertas?.sin_actividad.length ?? 0);

  const now = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel TRACEA</h1>
          <p className="text-sm text-muted-foreground capitalize">{now}</p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1 border-primary/40 text-primary">
          Super Admin
        </Badge>
      </div>

      {/* ── KPIs ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-5 pb-4 h-24 animate-pulse bg-muted/30 rounded-lg" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Empresas activas"  value={metrics?.orgs_activas ?? 0}    icon={Building2}    color="bg-blue-50 text-blue-600" />
          <KPI label="En trial"          value={metrics?.orgs_trial ?? 0}       icon={Clock}        color="bg-yellow-50 text-yellow-600" />
          <KPI label="Usuarios totales"  value={metrics?.usuarios_totales ?? 0} icon={Users}        color="bg-green-50 text-green-600" />
          <KPI label="Folios este mes"   value={metrics?.folios_mes ?? 0}       icon={FileText}     color="bg-purple-50 text-purple-600" />
        </div>
      )}

      {/* ── Alertas ── */}
      {!isLoading && totalAlertas > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setAlertasOpen((v) => !v)}
            >
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Alertas ({totalAlertas})
              </CardTitle>
              {alertasOpen ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
            </button>
          </CardHeader>
          {alertasOpen && (
            <CardContent className="px-4 pb-4 space-y-3">
              {(alertas?.trials_por_vencer ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5 uppercase tracking-wide">
                    Trials por vencer
                  </p>
                  <div className="space-y-1.5">
                    {alertas!.trials_por_vencer.map((org) => {
                      const dias = diasParaVencer(org.trial_expires_at!);
                      return (
                        <div key={org.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{org.nombre}</span>
                            <span className="text-xs text-muted-foreground">— {org.user_count} usuarios</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] ${dias <= 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              {dias === 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `${dias} días`}
                            </Badge>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/admin/org/${org.id}`)}>
                              Ver
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {(alertas?.sin_actividad ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5 uppercase tracking-wide">
                    Sin actividad +30 días
                  </p>
                  <div className="space-y-1.5">
                    {alertas!.sin_actividad.map((org) => {
                      const dias = org.ultimo_folio_at
                        ? Math.max(0, Math.floor((Date.now() - new Date(org.ultimo_folio_at).getTime()) / 86400000))
                        : undefined;
                      return (
                        <div key={org.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{org.nombre}</span>
                            <span className="text-xs text-muted-foreground">
                              {org.ultimo_folio_at ? `Último: ${tiempoDesde(org.ultimo_folio_at)}` : "Sin folios"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={orgActionMutation.isPending}
                              onClick={() =>
                                setReactivationOrg({ id: org.id, nombre: org.nombre, dias })
                              }
                            >
                              <Mail className="h-3.5 w-3.5 mr-1" />
                              Enviar reactivación
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/admin/org/${org.id}`)}>
                              Ver
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Tabla de organizaciones ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizaciones ({orgs.length})
            </CardTitle>
            <Button size="sm" className="gap-1 h-8" onClick={() => setNewOrgOpen(true)}>
              <Building2 className="h-3.5 w-3.5" /> Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-muted/30 rounded" />
              ))}
            </div>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay organizaciones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Organización</th>
                    <th className="text-left pb-2 font-medium">Plan</th>
                    <th className="text-left pb-2 font-medium">Usuarios</th>
                    <th className="text-left pb-2 font-medium">Folios</th>
                    <th className="text-left pb-2 font-medium">Último folio</th>
                    <th className="text-left pb-2 font-medium">Estado</th>
                    <th className="text-left pb-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => {
                    const trialVencido =
                      org.plan === "trial" &&
                      org.trial_expires_at !== null &&
                      new Date(org.trial_expires_at) < new Date();
                    const trialsProximo =
                      org.plan === "trial" &&
                      org.trial_expires_at !== null &&
                      !trialVencido &&
                      diasParaVencer(org.trial_expires_at!) <= 7;

                    return (
                      <tr key={org.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3">
                          <div>
                            <span className="font-medium">{org.nombre}</span>
                            <span className="block text-[10px] font-mono text-muted-foreground">{org.slug}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge className={`text-[10px] w-fit ${planStyles[org.plan] ?? "bg-muted"}`}>
                              {planLabels[org.plan] ?? org.plan}
                            </Badge>
                            {trialVencido && (
                              <span className="text-[10px] text-destructive font-medium">⚠ Vencido</span>
                            )}
                            {trialsProximo && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                {diasParaVencer(org.trial_expires_at!)}d restantes
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={org.user_count >= org.max_users ? "text-destructive font-medium" : ""}>
                            {org.user_count}
                          </span>
                          <span className="text-muted-foreground text-xs">/{org.max_users}</span>
                        </td>
                        <td className="py-3 text-center text-muted-foreground">{org.folio_count}</td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {tiempoDesde(org.ultimo_folio_at)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const estado = (org as any).estado as string | undefined;
                              const label =
                                estado === "cancelado" ? "Cancelado" :
                                estado === "suspendido" ? "Suspendido" :
                                estado === "pendiente" ? "Pendiente" :
                                org.activo ? "Activo" : "Inactivo";
                              const cls =
                                estado === "cancelado" ? "bg-gray-100 text-gray-600 border-gray-200" :
                                estado === "suspendido" ? "bg-orange-100 text-orange-700 border-orange-200" :
                                estado === "pendiente" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                                org.activo ? "bg-green-100 text-green-700 border-green-200" :
                                "bg-gray-100 text-gray-600 border-gray-200";
                              return (
                                <Badge variant="outline" className={`text-[10px] ${cls}`}>{label}</Badge>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => { setImperOrg(org); setImperMotivo(""); }}
                            >
                              <LogIn className="h-3 w-3" /> Entrar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(org)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {((org as any).estado === "suspendido" || !org.activo) ? (
                                  <DropdownMenuItem
                                    onClick={() => orgActionMutation.mutate({ action: "reactivar", org_id: org.id })}
                                  >
                                    <Play className="h-3.5 w-3.5 mr-2" /> Reactivar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => orgActionMutation.mutate({ action: "suspender", org_id: org.id })}
                                  >
                                    <Pause className="h-3.5 w-3.5 mr-2" /> Suspender
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setChangePlanOrg(org);
                                    setChangePlanValue(org.plan);
                                  }}
                                >
                                  <ArrowUpDown className="h-3.5 w-3.5 mr-2" /> Cambiar plan
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => { setReminderOrg(org); setReminderMotivo(""); }}
                                >
                                  <Send className="h-3.5 w-3.5 mr-2" /> Enviar recordatorio de pago
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { setDeleteOrgTarget(org); setDeleteOrgConfirm(""); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancelar organización
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Equipo TRACEA ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Equipo TRACEA
            </CardTitle>
            <Button size="sm" className="gap-1 h-8" onClick={() => setNewTraceaOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {traceaUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin usuarios registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Nombre</th>
                  <th className="text-left pb-2 font-medium">Correo</th>
                  <th className="text-left pb-2 font-medium">Cargo</th>
                  <th className="text-left pb-2 font-medium">Rol</th>
                  <th className="text-left pb-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {traceaUsers.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{u.nombre}</td>
                    <td className="py-2 text-xs text-muted-foreground">{u.email}</td>
                    <td className="py-2 text-xs text-muted-foreground">{u.cargo || "—"}</td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                    </td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Editar usuario"
                        onClick={() => {
                          setEditUserTarget(u);
                          setEditUserForm({ nombre: u.nombre, cargo: u.cargo ?? "" });
                          setEditUserOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Resetear contraseña"
                        onClick={() => { setResetPwUser(u); setResetPwValue(""); setResetPwOpen(true); }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Reenviar correo de bienvenida"
                        onClick={async () => {
                          const t = toast.loading(`Enviando bienvenida a ${u.email}…`);
                          try {
                            const { data, error } = await supabase.functions.invoke("send-welcome-email", {
                              body: { target_user_id: u.id },
                            });
                            if (error) throw error;
                            if ((data as any)?.error) throw new Error((data as any).error);
                            toast.success(`Correo enviado a ${u.email}`, { id: t });
                          } catch (e: any) {
                            toast.error(e?.message || "No se pudo enviar el correo", { id: t });
                          }
                        }}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Eliminar usuario"
                        onClick={() => { setDeleteUserTarget(u); setDeleteUserOpen(true); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog nueva organización ── */}
      <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva organización (cliente)</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Nombre empresa *</Label>
                <Input
                  value={newOrgForm.org_nombre}
                  onChange={(e) => setNewOrgForm((f) => ({ ...f, org_nombre: e.target.value }))}
                  placeholder="Acme S.A. de C.V."
                />
              </div>
              <div>
                <Label className="text-sm">Identificador (slug) *</Label>
                <Input
                  value={newOrgForm.org_slug}
                  onChange={(e) =>
                    setNewOrgForm((f) => ({
                      ...f,
                      org_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    }))
                  }
                  placeholder="acme"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm">Norma</Label>
                <Select
                  value={newOrgForm.norma_aplicable}
                  onValueChange={(v) => setNewOrgForm((f) => ({ ...f, norma_aplicable: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOM-241">NOM-241 (dispositivos)</SelectItem>
                    <SelectItem value="NOM-059">NOM-059 (medicamentos)</SelectItem>
                    <SelectItem value="MULTI">Multi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Plan</Label>
                <Select
                  value={newOrgForm.plan}
                  onValueChange={(v) => setNewOrgForm((f) => ({ ...f, plan: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Días trial</Label>
                <Input
                  type="number"
                  min={1}
                  value={newOrgForm.trial_dias}
                  onChange={(e) => setNewOrgForm((f) => ({ ...f, trial_dias: Number(e.target.value) }))}
                  disabled={newOrgForm.plan !== "trial"}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Máx. usuarios</Label>
              <Input
                type="number"
                min={1}
                value={newOrgForm.max_users}
                onChange={(e) => setNewOrgForm((f) => ({ ...f, max_users: Number(e.target.value) }))}
              />
            </div>
            <div className="border-t pt-3 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Administrador inicial
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Nombre *</Label>
                  <Input
                    value={newOrgForm.admin_nombre}
                    onChange={(e) => setNewOrgForm((f) => ({ ...f, admin_nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Cargo</Label>
                  <Input
                    value={newOrgForm.admin_cargo}
                    onChange={(e) => setNewOrgForm((f) => ({ ...f, admin_cargo: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Email *</Label>
                  <Input
                    type="email"
                    value={newOrgForm.admin_email}
                    onChange={(e) => setNewOrgForm((f) => ({ ...f, admin_email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Contraseña *</Label>
                  <Input
                    type="text"
                    value={newOrgForm.admin_password}
                    onChange={(e) => setNewOrgForm((f) => ({ ...f, admin_password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrgOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createOrgMutation.mutate(newOrgForm)}
              disabled={
                createOrgMutation.isPending ||
                !newOrgForm.org_nombre.trim() ||
                !newOrgForm.org_slug.trim() ||
                !newOrgForm.admin_nombre.trim() ||
                !newOrgForm.admin_email.trim() ||
                newOrgForm.admin_password.length < 6
              }
            >
              {createOrgMutation.isPending ? "Creando…" : "Crear organización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog nuevo usuario TRACEA ── */}
      <Dialog open={newTraceaOpen} onOpenChange={setNewTraceaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo usuario TRACEA</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Nombre completo *</label>
              <Input value={newTraceaForm.nombre} onChange={(e) => setNewTraceaForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del colaborador" />
            </div>
            <div>
              <label className="text-sm font-medium">Correo electrónico *</label>
              <Input type="email" value={newTraceaForm.email} onChange={(e) => setNewTraceaForm((f) => ({ ...f, email: e.target.value }))} placeholder="colaborador@tracea.com.mx" />
            </div>
            <div>
              <label className="text-sm font-medium">Contraseña temporal *</label>
              <Input type="password" value={newTraceaForm.password} onChange={(e) => setNewTraceaForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="text-sm font-medium">Cargo</label>
              <Input value={newTraceaForm.cargo} onChange={(e) => setNewTraceaForm((f) => ({ ...f, cargo: e.target.value }))} placeholder="Consultor, Asesor…" />
            </div>
            <p className="text-xs text-muted-foreground">Se creará con rol <strong>super_admin</strong>. Podrá acceder a todas las empresas.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTraceaOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!newTraceaForm.nombre || !newTraceaForm.email || !newTraceaForm.password) { toast.error("Completa los campos obligatorios"); return; }
              if (newTraceaForm.password.length < 6) { toast.error("Contraseña mínimo 6 caracteres"); return; }
              createTraceaMutation.mutate(newTraceaForm);
            }} disabled={createTraceaMutation.isPending}>
              {createTraceaMutation.isPending ? "Creando…" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog resetear contraseña TRACEA ── */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resetear Contraseña</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Nueva contraseña para <strong>{resetPwUser?.nombre}</strong> ({resetPwUser?.email})
            </p>
            <div>
              <label className="text-sm font-medium">Nueva contraseña *</label>
              <Input type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!resetPwUser || resetPwValue.length < 6) { toast.error("Contraseña mínimo 6 caracteres"); return; }
              resetTraceaPwMutation.mutate({ user_id: resetPwUser.id, new_password: resetPwValue });
            }} disabled={resetTraceaPwMutation.isPending}>
              {resetTraceaPwMutation.isPending ? "Guardando…" : "Resetear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog eliminar usuario TRACEA ── */}
      <Dialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar usuario</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              ¿Confirmas eliminar a <strong>{deleteUserTarget?.nombre}</strong> ({deleteUserTarget?.email})?
            </p>
            <p className="text-xs text-destructive">
              Esta acción es irreversible. Se eliminarán su cuenta de acceso, perfil y rol.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserTarget && deleteTraceaMutation.mutate(deleteUserTarget.id)}
              disabled={deleteTraceaMutation.isPending}
            >
              {deleteTraceaMutation.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog editar usuario TRACEA ── */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar usuario TRACEA</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {editUserTarget?.email}
            </p>
            <div>
              <label className="text-sm font-medium">Nombre completo *</label>
              <Input
                value={editUserForm.nombre}
                onChange={(e) => setEditUserForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cargo</label>
              <Input
                value={editUserForm.cargo}
                onChange={(e) => setEditUserForm((f) => ({ ...f, cargo: e.target.value }))}
                placeholder="Consultor, Asesor…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editUserTarget) return;
                if (!editUserForm.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
                updateTraceaMutation.mutate({
                  id: editUserTarget.id,
                  nombre: editUserForm.nombre.trim(),
                  cargo: editUserForm.cargo.trim(),
                });
              }}
              disabled={updateTraceaMutation.isPending}
            >
              {updateTraceaMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog editar ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar — {editOrg?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan</label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm((f) => ({ ...f, plan: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(planLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Trial expira</label>
              <Input
                type="date"
                value={editForm.trial_expires_at}
                onChange={(e) => setEditForm((f) => ({ ...f, trial_expires_at: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Solo aplica si el plan es Trial. Vacío = sin vencimiento.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Límite de usuarios</label>
              <Input
                type="number"
                min={1}
                value={editForm.max_users}
                onChange={(e) => setEditForm((f) => ({ ...f, max_users: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateOrgMutation.isPending}>
              {updateOrgMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Motivo de Impersonación (Modelo B - ISO 27001) ── */}
      <Dialog open={!!imperOrg} onOpenChange={(open) => { if (!open) { setImperOrg(null); setImperMotivo(""); setImperTicketId(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Acceso a {imperOrg?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-foreground">
              <strong>Acceso auditado.</strong> Esta acción quedará registrada de forma permanente
              con tu identidad, hora de inicio y de fin. El administrador de la organización
              podrá ver este acceso.
            </div>
            {ticketsOrg.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="ticket">Vincular a un ticket abierto (recomendado)</Label>
                <Select
                  value={imperTicketId || "none"}
                  onValueChange={(v) => {
                    if (v === "none") {
                      setImperTicketId("");
                    } else {
                      setImperTicketId(v);
                      const t = ticketsOrg.find((x: any) => x.id === v);
                      if (t) setImperMotivo(`${t.codigo} — ${t.asunto}`);
                    }
                  }}
                >
                  <SelectTrigger id="ticket">
                    <SelectValue placeholder="Selecciona un ticket…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin ticket — motivo manual</SelectItem>
                    {ticketsOrg.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.codigo} • {t.prioridad} — {t.asunto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Vincular el acceso al ticket cierra el círculo de trazabilidad ISO 27001 y deja una nota interna automática.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo del acceso *</Label>
              <Textarea
                id="motivo"
                placeholder="Ej: Ticket #123 — error al firmar folio GR-2026-005"
                value={imperMotivo}
                onChange={(e) => setImperMotivo(e.target.value)}
                rows={3}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Mínimo 10 caracteres. Sé específico (ticket, folio, problema).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImperOrg(null); setImperMotivo(""); setImperTicketId(""); }}>
              Cancelar
            </Button>
            <Button onClick={confirmImpersonation} disabled={imperLoading || imperMotivo.trim().length < 10}>
              {imperLoading ? "Registrando…" : "Acceder y registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Cambiar Plan ── */}
      <Dialog open={!!changePlanOrg} onOpenChange={(open) => !open && setChangePlanOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar plan — {changePlanOrg?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Override manual: este cambio actualiza solo el campo en TRACEA. <strong>No</strong> sincroniza con la suscripción de Stripe.
              Úsalo para ajustes comerciales o correcciones puntuales.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nuevo plan</label>
              <Select value={changePlanValue} onValueChange={setChangePlanValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Plan actual: <strong>{changePlanOrg?.plan}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOrg(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!changePlanOrg) return;
                if (!changePlanValue || changePlanValue === changePlanOrg.plan) {
                  toast.error("Selecciona un plan distinto al actual");
                  return;
                }
                orgActionMutation.mutate({
                  action: "cambiar-plan",
                  org_id: changePlanOrg.id,
                  plan: changePlanValue,
                });
              }}
              disabled={orgActionMutation.isPending}
            >
              {orgActionMutation.isPending ? "Aplicando…" : "Cambiar plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Recordatorio de Pago ── */}
      <Dialog open={!!reminderOrg} onOpenChange={(open) => !open && setReminderOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar recordatorio de pago — {reminderOrg?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Se enviará un correo a todos los administradores de esta organización con un enlace para completar el pago.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje personalizado (opcional)</label>
              <Textarea
                value={reminderMotivo}
                onChange={(e) => setReminderMotivo(e.target.value)}
                placeholder="Si lo dejas vacío, se enviará el mensaje estándar."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderOrg(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!reminderOrg) return;
                orgActionMutation.mutate({
                  action: "recordatorio-pago",
                  org_id: reminderOrg.id,
                  motivo: reminderMotivo,
                });
              }}
              disabled={orgActionMutation.isPending}
            >
              {orgActionMutation.isPending ? "Enviando…" : "Enviar recordatorio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Enviar Reactivación ── */}
      <Dialog open={!!reactivationOrg} onOpenChange={(open) => !open && setReactivationOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar email de reactivación — {reactivationOrg?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Se enviará un correo a todos los administradores de esta organización animándolos a volver a TRACEA.
              {reactivationOrg?.dias ? ` Inactividad detectada: ${reactivationOrg.dias} días.` : ""}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje personalizado (opcional)</label>
              <Textarea
                value={reactivationMotivo}
                onChange={(e) => setReactivationMotivo(e.target.value)}
                placeholder="Si lo dejas vacío, se enviará el mensaje estándar de reactivación."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivationOrg(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!reactivationOrg) return;
                orgActionMutation.mutate({
                  action: "enviar-reactivacion",
                  org_id: reactivationOrg.id,
                  motivo: reactivationMotivo,
                  dias_inactividad: reactivationOrg.dias,
                });
              }}
              disabled={orgActionMutation.isPending}
            >
              {orgActionMutation.isPending ? "Enviando…" : "Enviar reactivación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Cancelar Organización ── */}
      <Dialog open={!!deleteOrgTarget} onOpenChange={(open) => !open && setDeleteOrgTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Cancelar organización</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm">
              Vas a cancelar la organización <strong>{deleteOrgTarget?.nombre}</strong>.
            </p>
            <p className="text-xs text-muted-foreground bg-muted/40 rounded p-3 border">
              <strong>Soft-delete:</strong> el estado pasa a <code>cancelado</code> y los usuarios pierden el acceso.
              Los datos (folios, riesgos, documentos, audit trail) se conservan por temas legales y de cumplimiento.
              No es una eliminación física.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Para confirmar, escribe el nombre exacto: <code className="text-destructive">{deleteOrgTarget?.nombre}</code>
              </label>
              <Input
                value={deleteOrgConfirm}
                onChange={(e) => setDeleteOrgConfirm(e.target.value)}
                placeholder={deleteOrgTarget?.nombre}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOrgTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteOrgTarget) return;
                if (deleteOrgConfirm.trim() !== deleteOrgTarget.nombre) {
                  toast.error("El nombre no coincide");
                  return;
                }
                orgActionMutation.mutate({
                  action: "eliminar",
                  org_id: deleteOrgTarget.id,
                  confirm_nombre: deleteOrgConfirm.trim(),
                });
              }}
              disabled={orgActionMutation.isPending || deleteOrgConfirm.trim() !== deleteOrgTarget?.nombre}
            >
              {orgActionMutation.isPending ? "Cancelando…" : "Cancelar organización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
