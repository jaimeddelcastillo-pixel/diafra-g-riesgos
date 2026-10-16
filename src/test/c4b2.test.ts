import { describe, it, expect, vi, afterEach } from "vitest";
import { contextoFechaMexico, fechaMexico } from "../../supabase/functions/_shared/fecha-mexico";
import { armarRiesgos } from "../../supabase/functions/_shared/skills";
import { contarEmpresasSkill, grupoSkill, textoSkillParaGuardar } from "@/lib/skills-presentacion";

afterEach(() => vi.useRealTimers());

describe("C4b.2", () => {
  it("usa el día de México, no el día UTC", () => {
    expect(fechaMexico(new Date("2026-10-17T05:59:59Z"))).toBe("2026-10-16");
    expect(fechaMexico(new Date("2026-10-17T06:00:00Z"))).toBe("2026-10-17");
    expect(contextoFechaMexico(new Date("2026-10-16T23:11:00Z"))).toBe("Fecha de hoy: 2026-10-16 (hora de México)");
  });

  it("agrega la fecha solo al contexto variable, manteniendo los bloques fijos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T23:11:00Z"));
    const admin = {
      from: () => {
        let clave = "";
        const q = {
          select: () => q,
          eq: (campo: string, valor: string) => { if (campo === "nombre") clave = valor; return q; },
          maybeSingle: async () => ({ data: { id: clave, nombre: clave, system_prompt: clave, version: "1.0", sha256: "abc" } }),
        };
        return q;
      },
      rpc: async () => ({ data: true }),
    };
    const r = await armarRiesgos(admin, { norma: "NOM-241", org: {
      id: "qa", nombre: "QA", norma_aplicable: "NOM-241", metodologia: "AMEF",
      usar_detectabilidad: true, umbral_npr_alto: 100, umbral_npr_medio: 50,
    } });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("Composición incompleta");
    expect(r.fijo).toBe("plataforma\n\nriesgos_amef\n\nnorma_nom241");
    expect(r.variable).toContain("[CONTEXTO_EMPRESA]\nFecha de hoy: 2026-10-16 (hora de México)");
  });

  it("restaura bytes y saltos finales exactos; solo recorta textos nuevos", () => {
    const original = "  Instrucción\r\nTexto\n\n";
    expect(new TextEncoder().encode(textoSkillParaGuardar(original, true))).toEqual(new TextEncoder().encode(original));
    expect(textoSkillParaGuardar(original, false)).toBe("Instrucción\r\nTexto");
  });

  it("separa producción, bloques y alcances", () => {
    expect(grupoSkill("dm", "norma")).toBe("En producción");
    expect(grupoSkill("farma", "norma")).toBe("En producción");
    expect(grupoSkill("cerebro_institucional", "modulo")).toBe("En producción");
    expect(grupoSkill("causa_raiz_ishikawa", "tarea")).toBe("En producción");
    expect(grupoSkill("riesgos_amef", "modulo")).toBe("Bloques");
    expect(grupoSkill("norma_nom059", "norma")).toBe("Bloques");
    expect(grupoSkill("alcance_riesgos", "alcance")).toBe("Alcances");
  });

  it("cuenta monolíticas por norma y bloques incluyendo borradores y MULTI", () => {
    const empresas = [
      { id: "a", norma_aplicable: "NOM-241" }, { id: "b", norma_aplicable: "NOM-059" },
      { id: "c", norma_aplicable: "MULTI" }, { id: "d", norma_aplicable: "NOM-059" },
      { id: "e", norma_aplicable: "NOM-241" },
    ];
    const modos = { b: "bloques", d: "bloques_borrador", e: "bloques" };
    expect(contarEmpresasSkill("dm", empresas, modos)).toBe(2);
    expect(contarEmpresasSkill("farma", empresas, modos)).toBe(1);
    expect(contarEmpresasSkill("plataforma", empresas, modos)).toBe(3);
    expect(contarEmpresasSkill("riesgos_amef", empresas, modos)).toBe(3);
    expect(contarEmpresasSkill("norma_nom059", empresas, modos)).toBe(2);
    expect(contarEmpresasSkill("norma_nom241", empresas, modos)).toBe(1);
  });
});