import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCerebroAcceso } from "@/hooks/useCerebroAcceso";
import {
  navigationConfig,
  adminNavigationConfig,
  SECTION_ORDER,
  type NavItem,
  type NavSection,
} from "@/config/navigation";

export interface NavContext {
  plan: string | null;
  roles: string[];
  isSuperAdmin: boolean;
  /** feature_key -> activa */
  features: Record<string, boolean>;
}

/**
 * Filtro genérico y declarativo: cada criterio presente en el ítem debe cumplirse.
 * Solo UX — el enforcement real vive en RLS y edge functions.
 */
export function isItemVisible(item: NavItem, ctx: NavContext): boolean {
  if (item.status === "proximamente") return false;
  if (ctx.isSuperAdmin) return true;
  if (item.feature && !ctx.features[item.feature]) return false;
  if (item.roles && !item.roles.some((r) => ctx.roles.includes(r))) return false;
  if (item.plans && !item.plans.includes(ctx.plan ?? "")) return false;
  return true;
}

function filterTree(items: NavItem[], ctx: NavContext): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    if (!isItemVisible(item, ctx)) return acc;
    if (item.children) {
      const children = filterTree(item.children, ctx);
      if (children.length === 0) return acc;
      acc.push({ ...item, children });
      return acc;
    }
    acc.push(item);
    return acc;
  }, []);
}

export interface NavSectionGroup {
  section: NavSection;
  items: NavItem[];
}

export function useNavigationItems(): {
  sections: NavSectionGroup[];
  isAdminNav: boolean;
  loading: boolean;
} {
  const { org, roles, isSuperAdmin, isImpersonating } = useAuth();
  const { tieneCerebro, loading } = useCerebroAcceso();

  const superAdmin = isSuperAdmin();
  const isAdminNav = superAdmin && !isImpersonating;

  const ctx: NavContext = useMemo(
    () => ({
      plan: org?.plan ?? null,
      roles: roles as string[],
      isSuperAdmin: superAdmin,
      // Mapa de features: ampliable sin tocar la lógica de filtrado.
      features: { institutional_brain: tieneCerebro },
    }),
    [org?.plan, roles, superAdmin, tieneCerebro],
  );

  const sections = useMemo(() => {
    const source = isAdminNav ? adminNavigationConfig : navigationConfig;
    const visible = filterTree(source, ctx);
    return SECTION_ORDER.map((section) => ({
      section,
      items: visible.filter((i) => i.section === section),
    })).filter((g) => g.items.length > 0);
  }, [ctx, isAdminNav]);

  return { sections, isAdminNav, loading };
}
