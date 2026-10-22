import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), callback: undefined as undefined | ((event: string, session: any) => void) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    onAuthStateChange: (callback: typeof mocks.callback) => { mocks.callback = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    getSession: async () => ({ data: { session: { user: { id: "qa-sa" } } } }),
  },
  rpc: mocks.rpc,
  from: (table: string) => {
    const q = { select: () => q, eq: () => q,
      maybeSingle: async () => ({ data: table === "organizations" ? { id: "qa", nombre: "QA" } : { nombre: "QA soporte" } }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ role: "super_admin" }] }).then(resolve) };
    return q;
  },
} }));

function Probe() {
  const auth = useAuth();
  return <><output>{auth.loading ? "loading" : `${auth.orgId}:${auth.isImpersonating}`}</output><button onClick={auth.stopImpersonation}>Stop</button></>;
}
function mount() {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter></QueryClientProvider>);
  mocks.callback?.("INITIAL_SESSION", { user: { id: "qa-sa" } });
}
beforeEach(() => {
  localStorage.clear(); mocks.rpc.mockReset();
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "contexto_org_actual"
    ? [{ es_super_admin: true, soporte_log_id: "server-support", org_id: "qa", rol_en_org: null }] : null }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Support restoration", () => {
  it.each([null, "stale-support"])("reload adopts server support with local marker %s", async (marker) => {
    if (marker) localStorage.setItem("tracea-soporte-log", marker);
    mount();
    expect(await screen.findByText("qa:true")).toBeInTheDocument();
    expect(localStorage.getItem("tracea-soporte-log")).toBe("server-support");
    expect(mocks.rpc.mock.calls.some(([name]) => name === "cerrar_mis_soportes")).toBe(false);
  });
  it("unavailable storage does not close support", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    mount();
    expect(await screen.findByText("qa:true")).toBeInTheDocument();
    expect(mocks.rpc.mock.calls.some(([name]) => name === "cerrar_mis_soportes")).toBe(false);
  });
  it("expired or closed server support is not restored from local storage", async () => {
    localStorage.setItem("tracea-soporte-log", "old-support");
    mocks.rpc.mockResolvedValue({ data: [{ es_super_admin: true, soporte_log_id: null, org_id: null }] });
    mount();
    expect(await screen.findByText("null:false")).toBeInTheDocument();
    expect(localStorage.getItem("tracea-soporte-log")).toBeNull();
  });
  it("explicit termination still closes support", async () => {
    mount(); await screen.findByText("qa:true");
    fireEvent.click(screen.getByText("Stop"));
    expect(mocks.rpc).toHaveBeenCalledWith("cerrar_mis_soportes", { _tipo: "usuario" });
  });
});