import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useCurso } from "@/hooks/useCurso";

const mocks = vi.hoisted(() => ({ eq: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: mocks.eq }) }),
  rpc: () => Promise.resolve({ data: "completo", error: null }),
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
    expect(app).toContain('path="/mis-diplomas"');
    for (const path of ["/capacitacion", "/capacitacion/:cursoId/examen"]) {
      expect(module).toContain(`path: "${path}"`);
      expect(app).not.toContain(`path="${path}"`);
    }
    expect(app).toContain("ModuloGuard clave={m.clave}");
  });
  it("never hides diplomas by module (P1c.1): groups only", () => {
    const source = readFileSync("src/pages/MisDiplomas.tsx", "utf8");
    expect(source).toContain('rpc("mis_cursos_certificados")');
    expect(source).not.toContain("cursos_ids_modulo");
    expect(source).not.toContain('.in("curso_id"');
  });
  it("screens use only mi_acceso_curso (P1c.1)", () => {
    for (const f of ["src/pages/Capacitacion.tsx", "src/pages/ExamenFinal.tsx", "src/hooks/useCurso.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/plan\s*===\s*"trial"|tiene_curso_pagado|useIsTrial\(/);
    }
    expect(readFileSync("src/hooks/useCurso.ts", "utf8")).toContain('rpc("mi_acceso_curso"');
  });
  it("stops before reading attempts or starting another module's exam", () => {
    const source = readFileSync("src/pages/ExamenFinal.tsx", "utf8");
    expect(source).toContain('.eq("modulo_clave", "riesgos")');
    expect(source.indexOf("if (!c)")).toBeLessThan(source.indexOf('.from("curso_examen_intentos")'));
  });
});