import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-xs text-muted-foreground font-medium tracking-wide">
                ISO 14971 · NOM-241
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">AG</span>
                </div>
                <span className="text-muted-foreground hidden sm:inline">Admin</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
