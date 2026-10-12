import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { OnboardingController } from "@/components/onboarding/OnboardingController";
import { useMisModulos } from "@/hooks/useMisModulos";
import { modulos } from "@/modules";
import { encabezadoModulo, moduloEnRuta } from "@/modules/contexto";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  comite_tecnico: "Comité Técnico",
  operador: "Operador",
  lectura: "Lectura",
  responsable_sanitario: "Responsable Sanitario",
  super_admin: "Super Admin",
};

export function AppLayout() {
  const { user, profile, roles, org, signOut, isImpersonating, impersonatedOrg, stopImpersonation, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: catalogo } = useMisModulos();
  const accesos = Object.fromEntries((catalogo ?? []).map((m) => [m.clave, m.estado === "activo" && m.tiene_acceso]));
  const moduloActual = moduloEnRuta(pathname, modulos, accesos);
  // Include menu-only module pages (training) and shared platform pages.
  const rutaDeModulo = !!moduloActual || modulos.some((m) => m.menu.children?.some((i) => i.route === pathname));
  const actuandoComo = (() => {
    try {
      const v = JSON.parse(localStorage.getItem("tracea-actuando-como") ?? "null");
      return v && v.user_id === user?.id ? v as { nombre: string; email: string } : null;
    } catch { return null; }
  })();

  const initials = profile?.nombre
    ? profile.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const primaryRole = roles.find((r) => r === "super_admin") ?? roles[0];

  const headerLabel = pathname === "/"
    ? ["TRACEA", org?.nombre].filter(Boolean).join(" · ")
    : encabezadoModulo(moduloActual, org?.norma_aplicable);

  if (!loading && isSuperAdmin() && !isImpersonating && rutaDeModulo) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">

            {actuandoComo && (
              <div className="bg-destructive text-destructive-foreground px-4 py-1.5 text-xs font-medium shrink-0 sticky top-0 z-50">
                Sesión de prueba: estás actuando como {actuandoComo.nombre}{actuandoComo.email && actuandoComo.email !== actuandoComo.nombre ? ` (${actuandoComo.email})` : ""}. Lo que hagas queda a su nombre.
              </div>
            )}

            {/* Banner de impersonación */}
            {isImpersonating && (
              <div className="bg-accent text-accent-foreground flex items-center justify-between gap-3 px-4 py-1.5 text-xs shrink-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <Building2 className="h-3 w-3" />
                  Modo soporte — empresa: <strong>{impersonatedOrg?.nombre}</strong>
                </span>
                <Button variant="ghost" size="sm"
                  className="underline hover:no-underline text-xs shrink-0"
                  onClick={async () => { await stopImpersonation(); navigate("/admin"); }}
                >
                  Terminar soporte
                </Button>
              </div>
            )}

            <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger />
                <span className="text-xs text-muted-foreground font-medium truncate">
                  {headerLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground">{initials}</span>
                  </div>
                  <span className="text-muted-foreground hidden sm:inline">{profile?.nombre}</span>
                  {primaryRole && (
                    <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                      {roleLabels[primaryRole] ?? primaryRole}
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
          <FloatingAssistantButton />
          <OnboardingController />
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
