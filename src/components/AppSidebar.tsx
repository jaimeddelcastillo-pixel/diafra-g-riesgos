import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useNavigationItems } from "@/hooks/useNavigationItems";
import { usePendientes } from "@/hooks/usePendientes";
import { NavGroup, NavLeaf, groupContainsActive } from "@/components/sidebar/NavGroup";
import { SECTION_LABELS, type NavItem } from "@/config/navigation";
import { getOrgLogoUrl } from "@/lib/orgLogo";
import { cn } from "@/lib/utils";
import { contarPendientes } from "@/lib/pendientes";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

/** Evento para abrir el grupo que contiene un ítem con cierto data-onboarding (tour). */
export const EVENTO_ABRIR_GRUPO = "tracea:abrir-grupo-menu";

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador", responsable_sanitario: "Resp. Sanitario", comite_tecnico: "Comité Técnico",
  operador: "Operador", lectura: "Lectura", super_admin: "Super admin",
};

/** Punto verde en "Mis Folios" por 24h tras elegir crear el primer folio. */
function useBadgeFolios() {
  const at = typeof window !== "undefined"
    ? Number(localStorage.getItem("tracea_onboarding_first_folio_at") ?? 0)
    : 0;
  return at > 0 && Date.now() - at < 24 * 60 * 60 * 1000;
}

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { org, orgId, orgRole, user, isImpersonating, stopImpersonation, cambiarEmpresa } = useAuth();
  const { data: misOrgs = [] } = useQuery({
    queryKey: ["mis-organizaciones", user?.id],
    enabled: !!user && !isImpersonating,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mis_organizaciones");
      if (error) throw error;
      return (data ?? []) as { org_id: string; nombre: string; rol: string; es_activa: boolean }[];
    },
  });
  const mostrarSelector = !isImpersonating && misOrgs.length > 1;
  const { sections, isAdminNav } = useNavigationItems();
  const mostrarBadgeFolios = useBadgeFolios();
  const pendientes = usePendientes("mio", !isAdminNav);
  const conteo = contarPendientes(pendientes.data ?? []);

  // Solo se abre el grupo del módulo donde está la persona (en Inicio, ninguno).
  const [openId, setOpenId] = useState<string | null>(null);

  // La ruta activa tiene prioridad absoluta sobre el estado persistido.
  const activeGroupId = useMemo(() => {
    for (const s of sections) {
      const g = s.items.find((i) => i.children && groupContainsActive(pathname, i));
      if (g) return g.id;
    }
    return null;
  }, [sections, pathname]);

  useEffect(() => {
    setOpenId(activeGroupId);
  }, [activeGroupId]);

  // Tour: abrir el grupo que contiene el elemento a resaltar.
  useEffect(() => {
    const handler = (e: Event) => {
      const clave = (e as CustomEvent<string>).detail;
      for (const s of sections) {
        const g = s.items.find((i) => i.children?.some((c) => c.onboarding === clave));
        if (g) { setOpenId(g.id); return; }
      }
    };
    window.addEventListener(EVENTO_ABRIR_GRUPO, handler);
    return () => window.removeEventListener(EVENTO_ABRIR_GRUPO, handler);
  }, [sections]);

  const setOpen = (id: string, open: boolean) => setOpenId(open ? id : null);

  const orgLogo = !isAdminNav ? getOrgLogoUrl(org?.logo_url) : null;

  const renderExtra = (child: NavItem) =>
    child.route === "/pendientes" && pendientes.data?.length ? (
      <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", conteo.rojo ? "bg-destructive text-destructive-foreground" : conteo.naranja ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground")} aria-label={`${pendientes.data.length} pendientes, ${conteo.rojo} vencidos`}>{pendientes.data.length}</span>
    ) : child.route === "/folios" && mostrarBadgeFolios ? (
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Nuevo" />
    ) : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("p-4", collapsed && "p-2")}>
        <div className="flex items-center gap-3">
          {orgLogo ? (
            <img src={orgLogo} alt={org?.nombre ?? "Logo"} className="h-8 w-8 object-contain rounded bg-white/10 p-0.5 flex-shrink-0" />
          ) : (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 flex-shrink-0">
              <rect x="1" y="1" width="17" height="17" rx="3" fill="white" fillOpacity="0.15" />
              <rect x="22" y="1" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="1" y="22" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="22" y="22" width="17" height="17" rx="3" fill="#8587E8" />
              <path d="M18 18L22 22" stroke="#8587E8" strokeWidth="2" strokeDasharray="2.5 2" strokeLinecap="round" />
              <path d="M27 30.5L30.5 34L36 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide truncate">
                {isAdminNav ? "TRACEA" : (org?.nombre ?? "TRACEA")}
              </h1>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight truncate max-w-[140px]">
                {isAdminNav ? "Panel TRACEA" : orgRole ? `Rol: ${ROL_LABEL[orgRole] ?? orgRole}` : "Gestión de Riesgos"}
              </p>
            </div>
          )}
        </div>
        {mostrarSelector && !collapsed && !isAdminNav && (
          <div className="mt-3">
            <Select
              value={orgId ?? undefined}
              onValueChange={async (v) => {
                try { await cambiarEmpresa(v); }
                catch (e: any) { toast.error(e?.message ?? "No se pudo cambiar de empresa"); }
              }}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Cambiar de empresa" data-onboarding="selector-empresa">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {misOrgs.map((o) => (
                  <SelectItem key={o.org_id} value={o.org_id} className="text-xs">
                    {o.nombre} · {ROL_LABEL[o.rol] ?? o.rol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent data-onboarding="menu-modulos">
        {sections.map(({ section, items }) => (
          <SidebarGroup key={section}>
            {SECTION_LABELS[section] && (
              <SidebarGroupLabel className={cn("text-[10px] uppercase tracking-widest text-sidebar-foreground/50")}>
                {!collapsed && SECTION_LABELS[section]}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) =>
                  item.children ? (
                    <NavGroup
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      open={openId === item.id}
                      onOpenChange={(o) => setOpen(item.id, o)}
                      renderExtra={renderExtra}
                    />
                  ) : (
                    <NavLeaf key={item.id} item={item} pathname={pathname} extra={renderExtra(item)} />
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {isImpersonating && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Salir de empresa"
                    aria-label="Salir de empresa"
                    className="hover:bg-sidebar-accent/50 text-amber-400 hover:text-amber-300 cursor-pointer"
                    onClick={() => { stopImpersonation(); navigate("/admin"); }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Salir de empresa</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
