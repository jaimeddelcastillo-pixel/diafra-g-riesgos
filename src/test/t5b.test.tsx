import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/modules", () => ({ modulos: [] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ orgId: "o1", user: { id: "u1" }, isSuperAdmin: () => false, isImpersonating: false, loading: false }),
}));

import { cambiarModulo } from "@/components/admin/ModulosEmpresaCard";
import { guardarNorma } from "@/modules/tendencias/lib/persistencia";
import { ModuloGuard } from "@/components/ModuloGuard";
import { adminNavigationConfig } from "@/config/navigation";

beforeEach(() => rpc.mockReset());

describe("T5b módulos por empresa", () => {
  it("activa y desactiva con motivo", async () => {
    rpc.mockResolvedValue({ error: null });
    await cambiarModulo("o1", "tendencias", true, "Alta contratada");
    await cambiarModulo("o1", "tendencias", false, "Baja solicitada");
    expect(rpc).toHaveBeenNthCalledWith(1, "admin_set_modulo", { _org: "o1", _clave: "tendencias", _activo: true, _motivo: "Alta contratada" });
    expect(rpc).toHaveBeenNthCalledWith(2, "admin_set_modulo", { _org: "o1", _clave: "tendencias", _activo: false, _motivo: "Baja solicitada" });
  });
  it("rechaza sin motivo", async () => {
    await expect(cambiarModulo("o1", "tendencias", true, "  ")).rejects.toThrow(/Motivo obligatorio/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("empresa sin el módulo no entra a sus rutas", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/tendencias"]}>
          <Routes><Route element={<ModuloGuard clave="tendencias" mensaje="x" />}><Route path="/tendencias" element={<p>dentro</p>} /></Route></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Módulo no contratado")).toBeTruthy();
    expect(screen.queryByText("dentro")).toBeNull();
  });
});

describe("T5b normas en su pestaña", () => {
  it("pestaña Normas y especificaciones en el Panel", () => {
    expect(adminNavigationConfig.find((i) => i.route === "/admin/normas")?.label).toBe("Normas y especificaciones");
  });
  it("guarda con motivo vía RPC y rechaza sin motivo", async () => {
    rpc.mockResolvedValue({ error: null });
    await guardarNorma("n1", { lie: 5 }, "Ajuste revisado");
    expect(rpc).toHaveBeenCalledWith("tend_guardar_norma", { _id: "n1", _valores: { lie: 5 }, _motivo: "Ajuste revisado" });
    await expect(guardarNorma("n1", { lie: 5 }, "")).rejects.toThrow(/Motivo obligatorio/);
  });
});
