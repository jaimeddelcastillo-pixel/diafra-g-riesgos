import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { encabezadoModulo, moduloEnRuta } from "@/modules/contexto";
import type { ModuloDef } from "@/modules/tipos";
import { ModuloGuard } from "@/components/ModuloGuard";
import { isItemVisible, useNavigationItems } from "@/hooks/useNavigationItems";

const mocks = vi.hoisted(() => ({
  auth: { orgId: "qa", user: { id: "sa" }, roles: ["super_admin"], org: { plan: "starter" }, isImpersonating: false, loading: false, isSuperAdmin: () => true },
  catalogo: [{ clave: "riesgos", estado: "activo", tiene_acceso: true }, { clave: "institutional_brain", estado: "activo", tiene_acceso: false }],
  rpc: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useMisModulos", () => ({ useMisModulos: () => ({ data: mocks.catalogo, isLoading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
// Navigation fixtures avoid loading PDF/document pages in the DOM test runtime.
vi.mock("@/modules", () => {
  const registry = [
    { menu: { id: "riesgos", label: "Gestión de Riesgos", section: "modulos", feature: "riesgos", children: [
      { id: "cumplimiento", label: "Cumplimiento", section: "modulos", roles: ["admin", "responsable_sanitario"] },
      { id: "recursos", label: "Recursos", section: "modulos", route: "/recursos" },
    ] } },
    { menu: { id: "cerebro", label: "Cerebro Institucional", section: "modulos", feature: "institutional_brain", children: [
      { id: "cerebro-recursos", label: "Recursos", section: "modulos", route: "/recursos", soloSinModulo: "riesgos" },
    ] } },
  ];
  return { modulos: registry, ordenarModulos: () => registry };
});

const definition = (clave: string, nombre: string, path: string, children: ModuloDef["menu"]["children"]): ModuloDef => ({
  clave, nombre, descripcion: "", icono: Brain, rutaInicio: path, mensajeNoContratado: "", ordenPorDefecto: 10,
  menu: { id: clave, label: nombre, icon: Brain, section: "modulos", children },
  rutas: [{ path, Component: () => null }], tourClave: clave, tours: [], obtenerPendientes: async () => [], Tarjeta: () => null,
});
const riesgos = definition("riesgos", "Gestión de Riesgos", "/riesgos", [{ id: "recursos", label: "Recursos", icon: Brain, route: "/recursos", section: "modulos" }]);
riesgos.normaEnEncabezado = (norma) => norma === "NOM-241" || norma === "NOM-059" ? `${norma} / FEUM` : undefined;
const cerebro = definition("institutional_brain", "Cerebro Institucional", "/cerebro", [{ id: "cerebro-recursos", label: "Recursos", icon: Brain, route: "/recursos", soloSinModulo: "riesgos", section: "modulos" }]);

beforeEach(() => { mocks.auth.isImpersonating = false; mocks.rpc.mockReset(); mocks.rpc.mockResolvedValue({ data: true, error: null }); });
describe("P1b.1 registry headers", () => {
  it("uses the module name and its optional norm", () => {
    expect(encabezadoModulo(riesgos, "NOM-241")).toBe("Gestión de Riesgos · NOM-241 / FEUM");
    expect(encabezadoModulo(riesgos, "NOM-059")).toBe("Gestión de Riesgos · NOM-059 / FEUM");
    expect(encabezadoModulo(cerebro, "NOM-241")).toBe("Cerebro Institucional");
  });
  it("assigns shared Resources to one available module", () => {
    expect(moduloEnRuta("/recursos", [riesgos, cerebro], { riesgos: true, institutional_brain: true })?.clave).toBe("riesgos");
    expect(moduloEnRuta("/recursos", [riesgos, cerebro], { riesgos: false, institutional_brain: true })?.clave).toBe("institutional_brain");
  });
});
describe("P1b.1 support menu", () => {
  it("uses company commercial access and admin rules, not the super_admin bypass", () => {
    mocks.auth.isImpersonating = true;
    let result: ReturnType<typeof useNavigationItems> | undefined;
    function Probe() { result = useNavigationItems(); return null; }
    render(<Probe />);
    const items = result?.sections.flatMap((s) => s.items) ?? [];
    expect(items.some((i) => i.id === "riesgos")).toBe(true);
    expect(items.some((i) => i.id === "cerebro")).toBe(false);
    expect(items.some((i) => i.id === "soporte")).toBe(true);
    expect(items.find((i) => i.id === "riesgos")?.children?.some((i) => i.id === "cumplimiento")).toBe(true);
  });
  it("does not duplicate Resources", () => {
    const ctx = { roles: ["admin"], plan: "trial", isSuperAdmin: false, features: { riesgos: true, institutional_brain: true } };
    const resource = cerebro.menu.children?.[0];
    if (!resource) throw new Error("missing fixture");
    expect(isItemVisible(resource, ctx)).toBe(false);
    expect(isItemVisible(resource, { ...ctx, features: { riesgos: false, institutional_brain: true } })).toBe(true);
  });
});
describe("P1b.1 module guard", () => {
  it("redirects a super_admin outside support without querying module access", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/cerebro"]}><Routes>
      <Route path="/admin" element={<div>Panel TRACEA target</div>} />
      <Route element={<ModuloGuard clave="institutional_brain" mensaje="" />}><Route path="/cerebro" element={<div>Module content</div>} /></Route>
    </Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Panel TRACEA target")).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});