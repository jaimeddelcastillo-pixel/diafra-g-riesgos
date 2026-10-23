import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMisModulos } from "@/hooks/useMisModulos";
import { ordenarModulos } from "@/modules";
import {
  construirNavegacion,
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
  // Página compartida: no duplicarla si la empresa ya la ve desde otro módulo.
  if (item.soloSinModulo && ctx.features[item.soloSinModulo]) return false;
  if (ctx.isSuperAdmin) return true;
  if (item.requiereAlgunModulo && !Object.values(ctx.features).some(Boolean)) return false;
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

  // Catálogo con orden (modulos.orden) y acceso de la empresa activa.
  const { data: catalogo, isLoading: loading } = useMisModulos();
  const ordenDb = useMemo(
    () => (catalogo ? Object.fromEntries(catalogo.map((m) => [m.clave, m.orden ?? 999])) : undefined),
    [catalogo],
  );
  const accesos = useMemo(
    () => Object.fromEntries((catalogo ?? []).map((m) => [m.clave, ["activo", "beta"].includes(m.estado) && m.tiene_acceso])),
    [catalogo],
  );

  const superAdmin = isSuperAdmin();
  const isAdminNav = superAdmin && !isImpersonating;

  const ctx: NavContext = useMemo(
    () => ({
      plan: org?.plan ?? null,
      // Support presents the supported company's admin UX, not the global bypass.
      roles: isImpersonating ? ["admin"] : roles as string[],
      isSuperAdmin: superAdmin && !isImpersonating,
      features: accesos,
    }),
    [org?.plan, roles, superAdmin, isImpersonating, accesos],
  );

  const sections = useMemo(() => {
    const source = isAdminNav
      ? adminNavigationConfig
      : construirNavegacion(ordenarModulos(ordenDb).map((m) => m.menu));
    const visible = filterTree(source, ctx);
    return SECTION_ORDER.map((section) => ({
      section,
      items: visible.filter((i) => i.section === section),
    })).filter((g) => g.items.length > 0);
  }, [ctx, isAdminNav, ordenDb]);

  return { sections, isAdminNav, loading };
}
