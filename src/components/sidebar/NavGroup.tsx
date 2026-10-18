import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/navigation";

/** Coincidencia exacta cuando el ítem lo declara (rutas raíz: "/", "/cerebro", "/admin"). */
export function isRouteActive(pathname: string, item: NavItem): boolean {
  if (!item.route) return false;
  if (item.exact) return pathname === item.route;
  return pathname === item.route || pathname.startsWith(item.route + "/");
}

export function groupContainsActive(pathname: string, item: NavItem): boolean {
  if (isRouteActive(pathname, item)) return true;
  return (item.children ?? []).some((c) => groupContainsActive(pathname, c));
}

export function NavLeaf({
  item,
  pathname,
  sub,
  extra,
}: {
  item: NavItem;
  pathname: string;
  sub?: boolean;
  extra?: React.ReactNode;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const active = isRouteActive(pathname, item);
  const content = (
    <NavLink
      to={item.route!}
      end={item.exact}
      className="hover:bg-sidebar-accent/50"
      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
      data-onboarding={item.onboarding}
    >
      <item.icon className="mr-2 h-4 w-4" />
      {!collapsed && (
        <span className="flex items-center gap-2">
          {item.label}
          {extra}
        </span>
      )}
    </NavLink>
  );

  if (sub) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={active} className="h-auto min-h-7 py-1">
          {content}
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className="h-auto min-h-8 py-1.5">
        {content}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface NavGroupProps {
  item: NavItem;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderExtra?: (child: NavItem) => React.ReactNode;
}

export function NavGroup({ item, pathname, open, onOpenChange, renderExtra }: NavGroupProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const hasActive = groupContainsActive(pathname, item);

  const triggerButton = (
    <SidebarMenuButton
      className={cn(
        "h-auto min-h-8 py-1.5 hover:bg-sidebar-accent/50",
        hasActive && !open && "text-sidebar-primary",
      )}
    >
      <span
        className={cn(
          "mr-2 flex h-5 w-5 items-center justify-center rounded",
          item.highlight && "bg-sidebar-primary/15 text-sidebar-primary",
        )}
      >
        <item.icon className="h-4 w-4" />
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </>
      )}
    </SidebarMenuButton>
  );

  // Colapsado (modo iconos): los sub-items usan primitives con
  // `group-data-[collapsible=icon]:hidden`, así que el grupo abre un
  // flyout (DropdownMenu) con sus rutas para no perder navegación.
  if (collapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-52">
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {(item.children ?? []).map((child) => (
              <DropdownMenuItem key={child.id} asChild>
                <NavLink
                  to={child.route!}
                  end={child.exact}
                  className="flex w-full items-center gap-2"
                  activeClassName="bg-accent text-primary font-medium"
                  data-onboarding={child.onboarding}
                >
                  <child.icon className="h-4 w-4" />
                  <span>{child.label}</span>
                </NavLink>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>{triggerButton}</CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {(item.children ?? []).map((child) => (
              <NavLeaf
                key={child.id}
                item={child}
                pathname={pathname}
                sub
                extra={renderExtra?.(child)}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
