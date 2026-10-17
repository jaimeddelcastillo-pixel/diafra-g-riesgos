import { describe, expect, it } from "vitest";
import { armarRiesgos } from "../../supabase/functions/_shared/skills";
import { trazaConocimiento, textoBusquedaCerebro, type ConocimientoContexto } from "../../supabase/functions/_shared/conocimiento-contexto";

const item: ConocimientoContexto = { id: "k1", codigo: "K-0012", tipo: "regla_pno", contenido: "Limpieza validada", area: "Calidad", proceso: "Limpieza", fuente: { codigo: "PNO-CAL-003", revision: "04", pagina: 5 }, validado_por: "Validador", validado_en: "2026-10-16T20:00:00Z" };
const org = { id: "qa", nombre: "QA", norma_aplicable: "NOM-241", metodologia: "AMEF", usar_detectabilidad: true, umbral_npr_alto: 100, umbral_npr_medio: 50 };
function cliente(items: ConocimientoContexto[], missing = false) {
  const calls: string[] = [];
  return { calls, from: () => {
    let clave = ""; let estado = "vigente";
    const q = { select: () => q, eq: (k: string, v: string) => { if (k === "nombre") clave = v; if (k === "estado") estado = v; return q; },
      maybeSingle: async () => ({ data: missing && clave === "uso_conocimiento_empresa" ? null : { id: clave, nombre: clave, system_prompt: clave, version: "1.0", sha256: "hash", estado } }) };
    return q;
  }, rpc: async (name: string) => { calls.push(name); return { data: name === "contexto_cerebro" ? items : true }; } };
}
describe("C4c", () => {
  it("apagado por defecto no consulta ni agrega conocimiento", async () => {
    const c = cliente([item]); const r = await armarRiesgos(c, { org, norma: "NOM-241" });
    expect(c.calls).not.toContain("contexto_cerebro");
    if (!r.ok) throw Error("incompleto");
    expect(r.contexto_usado).toEqual([]);
    expect(r.fijo).toBe("plataforma\n\nriesgos_amef\n\nnorma_nom241");
  });
  it("contexto vacío no agrega bloque ni skill", async () => {
    const r = await armarRiesgos(cliente([]), { org, norma: "NOM-241", usarConocimiento: true });
    if (!r.ok) throw Error("incompleto");
    expect(r.variable).not.toContain("[CONOCIMIENTO_EMPRESA]");
    expect(r.skills_usadas.map(s => s.clave)).not.toContain("uso_conocimiento_empresa");
  });
  it("skill después de plataforma y contexto después del alcance, con borradores", async () => {
    const r = await armarRiesgos(cliente([item]), { org, norma: "NOM-241", usarConocimiento: true, usarBorradores: true });
    if (!r.ok) throw Error("incompleto");
    expect(r.skills_usadas.slice(0, 3).map(s => s.clave)).toEqual(["plataforma", "uso_conocimiento_empresa", "riesgos_amef"]);
    expect(r.skills_usadas[1].estado).toBe("borrador");
    expect(r.variable.indexOf("[CONOCIMIENTO_EMPRESA]")).toBeGreaterThan(r.variable.indexOf("[ALCANCE_TRACEA]"));
    expect(r.contexto_usado.map(k => k.codigo)).toEqual(["K-0012"]);
  });
  it("traza persiste solo id, código y fecha de validación", () => {
    expect(trazaConocimiento([item])).toEqual([{ id: "k1", codigo: "K-0012", validado_en: "2026-10-16T20:00:00Z" }]);
  });
  it("no envía conocimiento sin la skill controlada", async () => {
    expect(await armarRiesgos(cliente([item], true), { org, norma: "NOM-241", usarConocimiento: true })).toEqual({ ok: false, faltantes: ["uso_conocimiento_empresa"], contexto_cerebro: { elementos: 0, codigos: [], motivo: "skill_sin_version" } });
  });
  it("incluye proceso, etapa y mensaje actual sin todo el formulario", () => {
    expect(textoBusquedaCerebro("Recepción", "• Etapa: Cuarentena\n• Peligro: Otro", "¿Qué dice K-0008?"))
      .toBe("Recepción Cuarentena ¿Qué dice K-0008?");
  });
  it("diagnostica conocimiento enviado", async () => {
    const r = await armarRiesgos(cliente([item]), { org, norma: "NOM-241", usarConocimiento: true });
    if (!r.ok) throw Error("incompleto");
    expect(r.contexto_cerebro).toEqual({ elementos: 1, codigos: ["K-0012"] });
  });
  it("sin módulo no consulta conocimiento", async () => {
    const c = cliente([item]);
    c.rpc = async (name: string) => { c.calls.push(name); return { data: false }; };
    const r = await armarRiesgos(c, { org, norma: "NOM-241", usarConocimiento: true });
    if (!r.ok) throw Error("incompleto");
    expect(c.calls).not.toContain("contexto_cerebro");
    expect(r.contexto_cerebro.motivo).toBe("sin_modulo");
  });
});