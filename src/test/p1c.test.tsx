import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useCurso } from "@/hooks/useCurso";

const mocks = vi.hoisted(() => ({ eq: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: mocks.eq }) }),
} }));
beforeEach(() => {
  mocks.eq.mockReset();
  mocks.single.mockResolvedValue({ data: null });
  mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.single });
});
describe("P1c module-owned training", () => {
  it("filters the existing course by Risks without changing its norm", async () => {
    const { result } = renderHook(() => useCurso("NOM-241"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.eq).toHaveBeenCalledWith("norma", "NOM-241");
    expect(mocks.eq).toHaveBeenCalledWith("modulo_clave", "riesgos");
  });
  it("supports another owning module without exposing its courses in Risks", async () => {
    const { result } = renderHook(() => useCurso("NOM-059", "institutional_brain"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.eq).toHaveBeenCalledWith("modulo_clave", "institutional_brain");
  });
  it("registers all training routes under the existing module guard", () => {
    const module = readFileSync("src/modules/riesgos/module.ts", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");
    for (const path of ["/capacitacion", "/capacitacion/:cursoId/examen", "/mis-diplomas"]) {
      expect(module).toContain(`path: "${path}"`);
      expect(app).not.toContain(`path="${path}"`);
    }
    expect(app).toContain("ModuloGuard clave={m.clave}");
  });
  it("filters historical diplomas and attempts without requiring paid course content", () => {
    const source = readFileSync("src/pages/MisDiplomas.tsx", "utf8");
    expect(source).toContain('rpc("cursos_ids_modulo", { p_modulo: "riesgos" })');
    expect(source.match(/\.in\("curso_id", cursoIdsModulo\)/g)).toHaveLength(2);
  });
  it("stops before reading attempts or starting another module's exam", () => {
    const source = readFileSync("src/pages/ExamenFinal.tsx", "utf8");
    expect(source).toContain('.eq("modulo_clave", "riesgos")');
    expect(source.indexOf("if (!c)")).toBeLessThan(source.indexOf('.from("curso_examen_intentos")'));
  });
});