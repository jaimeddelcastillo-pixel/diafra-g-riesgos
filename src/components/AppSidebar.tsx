import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNavigationItems } from "@/hooks/useNavigationItems";
import { NavGroup, NavLeaf, groupContainsActive } from "@/components/sidebar/NavGroup";
import { SECTION_LABELS, type NavItem } from "@/config/navigation";
import { getOrgLogoUrl } from "@/lib/orgLogo";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const STORAGE_KEY = "tracea_sidebar_open_group";

/** Punto verde en "Mis Folios" por 24h tras elegir crear el primer folio. */
function useBadgeFolios() {
  const at = typeof window !== "undefined"
    ? Number(localStorage.getItem("tracea_onboarding_first_folio_at") ?? 0)
    : 0;
  return at > 0 && Date.now() - at < 24 * 60 * 60 * 1000;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { org, isImpersonating, stopImpersonation } = useAuth();
  const { sections, isAdminNav } = useNavigationItems();
  const mostrarBadgeFolios = useBadgeFolios();

  const [openId, setOpenId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null),
  );

  // La ruta activa tiene prioridad absoluta sobre el estado persistido.
  const activeGroupId = useMemo(() => {
    for (const s of sections) {
      const g = s.items.find((i) => i.children && groupContainsActive(pathname, i));
      if (g) return g.id;
    }
    return null;
  }, [sections, pathname]);

  useEffect(() => {
    if (activeGroupId) setOpenId(activeGroupId);
  }, [activeGroupId]);

  const setOpen = (id: string, open: boolean) => {
    const next = open ? id : null;
    setOpenId(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const orgLogo = !isAdminNav ? getOrgLogoUrl(org?.logo_url) : null;

  const renderExtra = (child: NavItem) =>
    child.route === "/folios" && mostrarBadgeFolios ? (
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Nuevo" />
    ) : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
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
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight truncate max-w-[120px]">
                {isAdminNav ? "Panel TRACEA" : "Gestión de Riesgos"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map(({ section, items }) => (
          <SidebarGroup key={section}>
            <SidebarGroupLabel
              className={cn(
                "text-[10px] uppercase tracking-widest",
                section === "nucleo" ? "text-sidebar-primary/70" : "text-sidebar-foreground/50",
              )}
            >
              {!collapsed && SECTION_LABELS[section]}
            </SidebarGroupLabel>
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
