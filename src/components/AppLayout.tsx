import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  comite_tecnico: "Comité Técnico",
  operador: "Operador",
  lectura: "Lectura",
  responsable_sanitario: "Responsable Sanitario",
  super_admin: "Super Admin",
};

export function AppLayout() {
  const { profile, roles, signOut, isImpersonating, impersonatedOrg, stopImpersonation } = useAuth();
  const navigate = useNavigate();

  const initials = profile?.nombre
    ? profile.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const primaryRole = roles.find((r) => r === "super_admin") ?? roles[0];

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">

            {/* Banner de impersonación */}
            {isImpersonating && (
              <div className="bg-amber-500 text-white flex items-center justify-between px-4 py-1.5 text-xs shrink-0">
                <span className="flex items-center gap-1.5 font-medium">
                  <Building2 className="h-3 w-3" />
                  Viendo empresa: <strong>{impersonatedOrg?.nombre}</strong>
                </span>
                <button
                  className="underline hover:no-underline text-white font-medium"
                  onClick={() => { stopImpersonation(); navigate("/admin"); }}
                >
                  ← Volver a Panel TRACEA
                </button>
              </div>
            )}

            <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <span className="text-xs text-muted-foreground font-medium tracking-wide">
                  GESTIÓN DE RIESGOS
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
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
