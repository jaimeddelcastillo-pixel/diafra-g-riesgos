import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "comite_tecnico" | "operador" | "lectura" | "responsable_sanitario" | "super_admin";

interface OrgInfo {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  activo: boolean;
  max_users: number;
  trial_expires_at: string | null;
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
  hasRole: (role: AppRole) => boolean;
  isSuperAdmin: () => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgRole, setOrgRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

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

            // Org membership (nuevo sistema multi-tenant)
            const { data: memberData } = await supabase
              .from("org_members")
              .select("role, org_id, organizations(id, nombre, slug, plan, activo, max_users, trial_expires_at)")
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
              // Fallback legacy: leer user_roles si aún no migrado
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles,
      orgId, org, orgRole,
      loading, hasRole, isSuperAdmin, signOut,
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
