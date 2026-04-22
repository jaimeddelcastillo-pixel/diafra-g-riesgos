import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "comite_tecnico" | "operador" | "lectura" | "responsable_sanitario" | "super_admin";

export interface OrgInfo {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  activo: boolean;
  max_users: number;
  trial_expires_at: string | null;
  logo_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { nombre: string; email: string; cargo: string | null } | null;
  roles: AppRole[];
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [_orgId, setOrgId] = useState<string | null>(null);
  const [_org, setOrg] = useState<OrgInfo | null>(null);
  const [orgRole, setOrgRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedOrg, setImpersonatedOrg] = useState<OrgInfo | null>(null);
  const [impersonationLogId, setImpersonationLogId] = useState<string | null>(null);

  // Cuando impersona, orgId y org reflejan la org del cliente transparentemente
  const orgId = impersonatedOrg?.id ?? _orgId;
  const org = impersonatedOrg ?? _org;
  const isImpersonating = impersonatedOrg !== null;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            // Perfil
            const { data: profileData } = await supabase
              .from("profiles")
              .select("nombre, email, cargo")
              .eq("id", session.user.id)
              .single();
            setProfile(profileData);

            // Org membership (sistema multi-tenant)
            const { data: memberData } = await supabase
              .from("org_members")
              .select("role, org_id, organizations(id, nombre, slug, plan, activo, max_users, trial_expires_at, logo_url)")
              .eq("user_id", session.user.id)
              .single();

            if (memberData) {
              const role = memberData.role as AppRole;
              setOrgRole(role);
              setOrgId(memberData.org_id);
              const orgData = memberData.organizations as any;
              if (orgData) setOrg(orgData);

              // super_admin vive en user_roles aunque el usuario tenga org_members
              const { data: saData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id)
                .eq("role", "super_admin")
                .maybeSingle();
              setRoles(saData ? [role, "super_admin"] : [role]);
            } else {
              // Fallback: leer user_roles si no tiene org_members (super_admin sin org propia)
              const { data: rolesData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id);
              setRoles((rolesData || []).map((r: any) => r.role as AppRole));
              setOrgRole(null);
              setOrgId(null);
              setOrg(null);
            }

            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setOrgId(null);
          setOrg(null);
          setOrgRole(null);
          setImpersonatedOrg(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) =>
    roles.includes(role) || roles.includes("super_admin");

  const isSuperAdmin = () => roles.includes("super_admin");

  const startImpersonation = async (org: OrgInfo, motivo: string, ticketId?: string | null) => {
    if (!user) return;
    // Registrar inicio de impersonación (auditoría ISO 27001)
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const { data, error } = await supabase
      .from("impersonation_logs")
      .insert({
        super_admin_id: user.id,
        super_admin_email: user.email ?? "",
        org_id: org.id,
        org_nombre: org.nombre,
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
    setImpersonationLogId(data.id);
    setImpersonatedOrg(org);

    // Si hay ticket vinculado, agregar nota interna automática
    if (ticketId) {
      try {
        await supabase.from("ticket_mensajes").insert({
          ticket_id: ticketId,
          autor_id: user.id,
          autor_nombre: "Sistema TRACEA",
          autor_email: user.email ?? "",
          mensaje: `🔐 Soporte inició sesión de acceso a la organización "${org.nombre}" para atender este ticket.\nMotivo registrado: ${motivo.trim()}`,
          es_interno: true,
          es_soporte: true,
        });
      } catch (e) {
        console.error("No se pudo registrar nota de impersonación:", e);
      }
    }
  };

  const stopImpersonation = async () => {
    if (impersonationLogId) {
      await supabase
        .from("impersonation_logs")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", impersonationLogId);
    }
    setImpersonationLogId(null);
    setImpersonatedOrg(null);
  };

  const signOut = async () => {
    if (impersonationLogId) {
      await supabase
        .from("impersonation_logs")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", impersonationLogId);
      setImpersonationLogId(null);
    }
    setImpersonatedOrg(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles,
      orgId, org, orgRole,
      loading,
      isImpersonating, impersonatedOrg,
      hasRole, isSuperAdmin,
      startImpersonation, stopImpersonation,
      signOut,
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
