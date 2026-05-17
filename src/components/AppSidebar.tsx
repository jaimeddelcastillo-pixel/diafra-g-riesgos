import { LayoutDashboard, FolderOpen, Settings, BookOpen, ShieldCheck, LogOut, LifeBuoy, Ticket, Library, Sparkles, GraduationCap } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getOrgLogoUrl } from "@/lib/orgLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const adminNavItems = [
  { title: "Panel TRACEA", url: "/admin", icon: ShieldCheck },
  { title: "Tickets", url: "/admin/tickets", icon: Ticket },
  { title: "Agentes IA", url: "/admin/agentes-ia", icon: Sparkles },
];

const orgNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Mis Folios", url: "/folios", icon: FolderOpen },
  { title: "Catálogos", url: "/catalogos", icon: BookOpen },
  { title: "Recursos", url: "/recursos", icon: Library },
  { title: "Capacitación", url: "/capacitacion", icon: GraduationCap },
  { title: "Auditoría", url: "/auditoria", icon: Settings },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { org, isSuperAdmin, isImpersonating, stopImpersonation, hasRole } = useAuth();

  const showOrgNav = !isSuperAdmin() || isImpersonating;
  const showAdminNav = isSuperAdmin() && !isImpersonating;

  // Solo admin y responsable_sanitario ven "Ayuda"
  const puedeAyuda = hasRole("admin") || hasRole("responsable_sanitario");
  const navItems = showOrgNav
    ? [
        ...orgNavItems,
        ...(puedeAyuda ? [{ title: "Ayuda", url: "/soporte", icon: LifeBuoy }] : []),
      ]
    : adminNavItems;
  const orgLabel = isImpersonating ? org?.nombre : (showAdminNav ? "Panel TRACEA" : (org?.nombre ?? "Gestión de Riesgos"));
  const orgLogo = showOrgNav ? getOrgLogoUrl(org?.logo_url) : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {orgLogo ? (
            <img
              src={orgLogo}
              alt={org?.nombre ?? "Logo"}
              className="h-8 w-8 object-contain rounded bg-white/10 p-0.5 flex-shrink-0"
            />
          ) : (
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 flex-shrink-0">
              <rect x="1" y="1" width="17" height="17" rx="3" fill="white" fillOpacity="0.15"/>
              <rect x="22" y="1" width="17" height="17" rx="3" fill="#185FA5"/>
              <rect x="1" y="22" width="17" height="17" rx="3" fill="#185FA5"/>
              <rect x="22" y="22" width="17" height="17" rx="3" fill="#8587E8"/>
              <path d="M18 18L22 22" stroke="#8587E8" strokeWidth="2" strokeDasharray="2.5 2" strokeLinecap="round"/>
              <path d="M27 30.5L30.5 34L36 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide truncate">
                {showOrgNav ? (org?.nombre ?? "TRACEA") : "TRACEA"}
              </h1>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight truncate max-w-[120px]">
                {showOrgNav ? "Gestión de Riesgos" : orgLabel}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-widest">
            {!collapsed && "Navegación"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/" || item.url === "/admin"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Salir de la empresa impersonada */}
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
