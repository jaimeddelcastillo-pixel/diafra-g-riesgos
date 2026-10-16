export type SkillTraza = { clave: string; version: string; estado?: string; sha256: string };
export type ContextoConocimiento = import("../../supabase/functions/_shared/conocimiento-contexto").ConocimientoContexto;
export type TrazaIA = { skills_usadas?: SkillTraza[] | null; modelo_ia?: string | null; mensaje_id?: string; contexto_usado?: ContextoConocimiento[] | null };

export function textoSkillParaGuardar(texto: string, restauracion: boolean): string {
  return restauracion ? texto : texto.trim();
}

export function grupoSkill(clave: string, ambito: string): "En producción" | "Bloques" | "Alcances" {
  if (ambito === "alcance") return "Alcances";
  if (["plataforma", "riesgos_amef", "uso_conocimiento_empresa"].includes(clave) || clave.startsWith("norma_")) return "Bloques";
  return "En producción";
}

export type EmpresaComposicion = { id: string; norma_aplicable: string | null };
export function contarEmpresasSkill(clave: string, empresas: EmpresaComposicion[], modos: Record<string, string>): number {
  const norma = clave === "dm" || clave === "norma_nom241" ? "NOM-241"
    : clave === "farma" || clave === "norma_nom059" ? "NOM-059" : null;
  const monolitica = clave === "dm" || clave === "farma";
  return empresas.filter((e) => {
    const modo = modos[e.id] ?? "monolitica";
    const coincide = monolitica ? modo === "monolitica" : ["bloques", "bloques_borrador"].includes(modo);
    return coincide && (!norma || e.norma_aplicable === norma || e.norma_aplicable === "MULTI");
  }).length;
}