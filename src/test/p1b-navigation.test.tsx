import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { contarPendientes, plazoPendiente, SEMAFORO_DEFECTO, type Pendiente } from "@/lib/pendientes";
import { readSidebarPreference, saveSidebarPreference } from "@/lib/sidebar-preference";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { NavLeaf } from "@/components/sidebar/NavGroup";
import { useNavigationItems } from "@/hooks/useNavigationItems";

const mocks = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.mobile }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ org: { plan: "starter" }, roles: ["admin"], isSuperAdmin: () => false, isImpersonating: false }) }));
vi.mock("@/hooks/useMisModulos", () => ({ useMisModulos: () => ({ data: [{ clave: "riesgos", estado: "activo", tiene_acceso: true }], isLoading: false }) }));
vi.mock("@/modules", () => {
  const modulos = [{ menu: { id: "riesgos", label: "Riesgos", section: "modulos", children: [{ id: "folios", route: "/folios", section: "modulos" }] } }];
  return { modulos, ordenarModulos: () => modulos };
});

beforeEach(() => { localStorage.clear(); mocks.mobile = false; });
const p = (extra: Partial<Pendiente> = {}): Pendiente => ({ modulo: "tendencias", tipo: "semana_sin_captura", registro: "qa", titulo: "QA", ruta: "/pendientes", nace_en: "2026-10-01T06:00:00Z", fecha_limite: null, perfil: "operativo", dias: 7, color: "rojo", ...extra });
const hoy = new Date("2026-10-21T23:36:00Z");

describe("P1-b presentación del semáforo", () => {
  it("cuenta colores del servidor sin cambiar clasificación", () => {
    expect(contarPendientes([p(), p(), p({ color: "naranja" }), p({ color: "verde" })])).toEqual({ rojo: 2, naranja: 1, verde: 1 });
  });
  it("operativo vence a los 7 días y gestión a los 20", () => {
    expect(plazoPendiente(p({ dias: 10 }), SEMAFORO_DEFECTO, hoy).dias).toBe(3);
    expect(plazoPendiente(p({ perfil: "gestion", dias: 23 }), SEMAFORO_DEFECTO, hoy).dias).toBe(3);
  });
  it("usa umbrales configurados por empresa", () => {
    expect(plazoPendiente(p({ color: "naranja", dias: 6 }), { ...SEMAFORO_DEFECTO, operativo_rojo: 12 }, hoy)).toEqual({ estado: "naranja", dias: 6 });
  });
  it("fecha compromiso anterior manda para el plazo mostrado", () => {
    expect(plazoPendiente(p({ perfil: "gestion", dias: 2, fecha_limite: "2026-10-19" }), SEMAFORO_DEFECTO, hoy).dias).toBe(2);
  });
  it("días naturales conservan fecha de México aunque UTC ya cambió", () => {
    expect(plazoPendiente(p({ color: "naranja", dias: 3, fecha_limite: "2026-10-22" }), SEMAFORO_DEFECTO, new Date("2026-10-22T02:00:00Z")).dias).toBe(1);
  });
});

describe("P1-b navegación", () => {
  it("recuerda preferencia individual sin compartirla entre usuarios", () => {
    saveSidebarPreference("qa-uno", false);
    expect(readSidebarPreference("qa-uno")).toBe(false);
    expect(readSidebarPreference("qa-dos")).toBe(true);
    saveSidebarPreference("qa-uno", true);
    expect(readSidebarPreference("qa-uno")).toBe(true);
  });
  it("ubica pendientes antes de los módulos visibles", () => {
    const { result } = renderHook(() => useNavigationItems());
    const ids = result.current.sections.flatMap(s => s.items.map(i => i.id));
    expect(ids.indexOf("pendientes")).toBeGreaterThan(ids.indexOf("inicio"));
    expect(ids.indexOf("pendientes")).toBeLessThan(ids.indexOf("riesgos"));
  });
  it("el botón contrae y expande el menú", () => {
    let contexto: ReturnType<typeof useSidebar> | undefined;
    function Probe() { contexto = useSidebar(); return <SidebarTrigger />; }
    render(<SidebarProvider><Probe /></SidebarProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Contraer menú" }));
    expect(contexto?.state).toBe("collapsed");
    fireEvent.click(screen.getByRole("button", { name: "Expandir menú" }));
    expect(contexto?.state).toBe("expanded");
  });
  it("móvil abre cajón sin alterar preferencia y lo cierra al navegar", () => {
    mocks.mobile = true;
    let contexto: ReturnType<typeof useSidebar> | undefined;
    function Probe() {
      contexto = useSidebar();
      return <><SidebarTrigger /><NavLeaf pathname="/" item={{ id: "pendientes", label: "Mis pendientes", route: "/pendientes", icon: ClipboardCheck, section: "inicio" }} /></>;
    }
    render(<MemoryRouter><SidebarProvider defaultOpen={false}><Probe /></SidebarProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(contexto?.openMobile).toBe(true);
    expect(contexto?.state).toBe("collapsed");
    act(() => { fireEvent.click(screen.getByRole("link", { name: "Mis pendientes" })); });
    expect(contexto?.openMobile).toBe(false);
  });
});