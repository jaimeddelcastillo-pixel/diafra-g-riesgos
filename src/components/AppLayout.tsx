import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { OnboardingController } from "@/components/onboarding/OnboardingController";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  comite_tecnico: "Comité Técnico",
  operador: "Operador",
  lectura: "Lectura",
  responsable_sanitario: "Responsable Sanitario",
  super_admin: "Super Admin",
};

export function AppLayout() {
  const { profile, roles, org, signOut, isImpersonating, impersonatedOrg, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const actuandoComo = (() => {
    try {
      const v = JSON.parse(localStorage.getItem("tracea-actuando-como") ?? "null");
      return v && v.user_id === profile?.id ? v as { nombre: string; email: string } : null;
    } catch { return null; }
  })();

  const initials = profile?.nombre
    ? profile.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const primaryRole = roles.find((r) => r === "super_admin") ?? roles[0];

  const norma = org?.norma_aplicable;
  const headerLabel =
    norma === "NOM-241"
      ? "GESTIÓN DE RIESGOS / NOM-241 / FEUM"
      : norma === "NOM-059"
      ? "GESTIÓN DE RIESGOS / NOM-059 / FEUM"
      : "GESTIÓN DE RIESGOS";

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
              <div className="bg-amber-500 text-white flex items-center justify-between px-4 py-1.5 text-xs shrink-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <Building2 className="h-3 w-3" />
                  Modo soporte — empresa: <strong>{impersonatedOrg?.nombre}</strong>
                </span>
                <button
                  className="underline hover:no-underline text-white font-medium"
                  onClick={async () => { await stopImpersonation(); navigate("/admin"); }}
                >
                  Terminar soporte
                </button>
              </div>
            )}

            <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <span className="text-xs text-muted-foreground font-medium tracking-wide">
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
