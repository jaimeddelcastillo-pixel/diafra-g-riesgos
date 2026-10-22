import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useLocation } from "react-router-dom";
import { rolPresentacion } from '@/lib/rol-presentacion';

type AppRole = "admin" | "comite_tecnico" | "operador" | "lectura" | "responsable_sanitario" | "super_admin" | "aseguramiento_calidad";

export interface OrgInfo {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  activo: boolean;
  max_users: number;
  trial_expires_at: string | null;
  logo_url?: string | null;
  codigo_formato?: string | null;
  version_formato?: string | null;
  descripcion?: string | null;
  estado?: "pendiente" | "activo" | "suspendido" | "cancelado";
  pending_price_id?: string | null;
  norma_aplicable?: "NOM-241" | "NOM-059" | "MULTI" | null;
  metodologia?: "AMEF" | "ICH-Q9" | "MULTI" | null;
  usar_detectabilidad?: boolean | null;
  umbral_npr_alto?: number | null;
  umbral_npr_medio?: number | null;
  onboarding_completado?: boolean | null;
  onboarding_saltado?: boolean | null;
  tiene_curso_pagado?: boolean | null;
  curso_expira_en?: string | null;
  dc3_emitidos?: number | null;
  dc3_adicionales_disponibles?: number | null;
  subscription_status?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { nombre: string; email: string; cargo: string | null } | null;
  roles: AppRole[];
  puedeAdministrarUsuarios: boolean;
  orgId: string | null;
  org: OrgInfo | null;
  orgRole: AppRole | null;
  loading: boolean;
  isImpersonating: boolean;
  impersonatedOrg: OrgInfo | null;
  hasRole: (role: AppRole) => boolean;
  isSuperAdmin: () => boolean;
  startImpersonation: (org: OrgInfo, motivo: string, ticketId?: string | null) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshOrg: () => Promise<void>;
  cambiarEmpresa: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ORG_COLS = "id, nombre, slug, plan, activo, max_users, trial_expires_at, logo_url, codigo_formato, version_formato, descripcion, estado, pending_price_id, norma_aplicable, metodologia, usar_detectabilidad, umbral_npr_alto, umbral_npr_medio, onboarding_completado, onboarding_saltado, tiene_curso_pagado, curso_expira_en, dc3_emitidos, dc3_adicionales_disponibles, subscription_status, folio_prefijo, folio_formato_periodo, folio_digitos_consecutivo";
const SOPORTE_KEY = "tracea-soporte-log";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [puedeAdministrarUsuarios, setPuedeAdministrarUsuarios] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgRole, setOrgRole] = useState<AppRole | null>(null);
  const [soporteLogId, setSoporteLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastUserRef = useRef<string | null>(null);

  // Empresa, rol y modo soporte vienen SIEMPRE del servidor (contexto_org_actual).
  const isImpersonating = soporteLogId !== null;
  const impersonatedOrg = isImpersonating ? org : null;

  // Las demás pestañas adoptan el soporte vigente para no cerrarlo al recargar.
  const broadcast = (tipo: string) => {
    try {
      channelRef.current?.postMessage({ tipo, soporte: localStorage.getItem(SOPORTE_KEY) });
    } catch { /* noop */ }
  };

  const cargarContexto = useCallback(async (u: User) => {
    const { data: profileData } = await supabase
      .from("profiles").select("nombre, email, cargo").eq("id", u.id).maybeSingle();
    setProfile(profileData);

    let { data: ctxData } = await supabase.rpc("contexto_org_actual");
    let ctx: any = Array.isArray(ctxData) ? ctxData[0] : ctxData;

    // El servidor decide si el soporte sigue vigente (incluido el límite de 8 h).
    // La marca local solo sincroniza pestañas: su ausencia no cierra un soporte.
    try {
      if (ctx?.es_super_admin && ctx?.soporte_log_id) localStorage.setItem(SOPORTE_KEY, ctx.soporte_log_id);
      else localStorage.removeItem(SOPORTE_KEY);
    } catch { /* El contexto del servidor funciona incluso sin almacenamiento local. */ }

    const esSA = !!ctx?.es_super_admin;
    const rol = (ctx?.rol_en_org ?? null) as AppRole | null;
    setSoporteLogId(ctx?.soporte_log_id ?? null);
    setOrgId(ctx?.org_id ?? null);
    setOrgRole(ctx?.soporte_log_id ? null : rol);

    if (ctx?.org_id) {
      const { data: orgData } = await supabase
        .from("organizations").select(ORG_COLS).eq("id", ctx.org_id).maybeSingle();
      setOrg((orgData as any) ?? null);
    } else {
      setOrg(null);
    }

    if (ctx?.soporte_log_id || (!ctx?.org_id)) {
      // super_admin (soporte o sin empresa) o usuario legacy sin membresía
      setPuedeAdministrarUsuarios(false);
      const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
      setRoles((rolesData || []).map((r: any) => r.role as AppRole));
    } else {
      const [{ data: efectivos, error: rolesError }, { data: administrar, error: administrarError }] = await Promise.all([
        supabase.rpc('mis_roles_efectivos'), supabase.rpc('puede_administrar_usuarios'),
      ]);
      setRoles(rolesError ? [] : [...(efectivos ?? []), ...(esSA ? ['super_admin' as AppRole] : [])]);
      setPuedeAdministrarUsuarios(!administrarError && administrar === true);
    }
    setLoading(false);
  }, []);

  const limpiarEstado = () => {
    setPuedeAdministrarUsuarios(false);
    setProfile(null); setRoles([]); setOrgId(null); setOrg(null); setOrgRole(null);
    setSoporteLogId(null);
  };

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("tracea-org");
      ch.onmessage = (ev) => {
        const soporte = ev?.data?.soporte;
        if (ev?.data?.tipo !== "signout" && typeof soporte === "string" && soporte) {
          localStorage.setItem(SOPORTE_KEY, soporte);
        } else {
          localStorage.removeItem(SOPORTE_KEY);
        }
        window.location.reload();
      };
      channelRef.current = ch;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nuevoId = session?.user?.id ?? null;
      if (lastUserRef.current !== nuevoId) {
        // Cambio de usuario: nada de la sesión anterior puede quedar en caché.
        queryClient.clear();
        limpiarEstado();
        if (nuevoId) setLoading(true);
      }
      lastUserRef.current = nuevoId;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
          const u = session.user;
          setTimeout(() => { cargarContexto(u); }, 0);
        }
      } else {
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });
    return () => { subscription.unsubscribe(); channelRef.current?.close(); };
  }, [cargarContexto, queryClient]);

  const hasRole = (role: AppRole) =>
    roles.includes(role) || roles.includes("super_admin");

  const isSuperAdmin = () => roles.includes("super_admin");

  const refreshOrg = async () => {
    if (!user || !orgId) return;
    await cargarContexto(user);
  };

  const recargar = async () => {
    queryClient.clear();
    if (user) await cargarContexto(user);
    broadcast("org");
  };

  const startImpersonation = async (target: OrgInfo, motivo: string, ticketId?: string | null) => {
    if (!user) return;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    // Un solo soporte abierto a la vez
    await supabase.rpc("cerrar_mis_soportes", { _tipo: "usuario" });
    const { data, error } = await supabase
      .from("impersonation_logs")
      .insert({
        super_admin_id: user.id,
        super_admin_email: user.email ?? "",
        org_id: target.id,
        org_nombre: target.nombre,
        motivo: motivo.trim(),
        user_agent: ua,
        ticket_id: ticketId ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("Error registrando impersonación:", error);
      throw error;
    }
    localStorage.setItem(SOPORTE_KEY, data.id);
    await recargar();

    if (ticketId) {
      try {
        await supabase.from("ticket_mensajes").insert({
          ticket_id: ticketId,
          autor_id: user.id,
          autor_nombre: "Sistema TRACEA",
          autor_email: user.email ?? "",
          mensaje: `🔐 Soporte inició sesión de acceso a la organización "${target.nombre}" para atender este ticket.\nMotivo registrado: ${motivo.trim()}`,
          es_interno: true,
          es_soporte: true,
        });
      } catch (e) {
        console.error("No se pudo registrar nota de impersonación:", e);
      }
    }
  };

  // C2b-E: cambiar la empresa activa (consultores con varias membresías).
  const cambiarEmpresa = async (nuevaOrg: string) => {
    if (!user || isImpersonating || nuevaOrg === orgId) return;
    setLoading(true);
    const { error } = await supabase.rpc("set_org_activa", { _org: nuevaOrg });
    if (error) { setLoading(false); throw error; }
    queryClient.clear();
    limpiarEstado();
    await cargarContexto(user);
    broadcast("org");
    window.location.assign("/");
  };

  const stopImpersonation = async () => {
    await supabase.rpc("cerrar_mis_soportes", { _tipo: "usuario" });
    localStorage.removeItem(SOPORTE_KEY);
    await recargar();
  };

  const signOut = async () => {
    if (isSuperAdmin()) {
      try { await supabase.rpc("cerrar_mis_soportes", { _tipo: "cierre_sesion" }); } catch { /* noop */ }
    }
    localStorage.removeItem(SOPORTE_KEY);
    localStorage.removeItem("tracea-actuando-como");
    queryClient.clear();
    limpiarEstado();
    broadcast("signout");
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, puedeAdministrarUsuarios,
      orgId, org, orgRole: rolPresentacion(orgRole, pathname),
      loading,
      isImpersonating, impersonatedOrg,
      hasRole, isSuperAdmin,
      startImpersonation, stopImpersonation,
      signOut,
      refreshOrg,
      cambiarEmpresa,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
