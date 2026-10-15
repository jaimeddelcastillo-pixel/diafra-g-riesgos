// C4a · Armador único de prompts con skills versionadas en la base.
// Las funciones Edge NUNCA guardan texto de prompt en el código: lo leen
// de agent_prompts (estado 'vigente'). Si la skill no está vigente, la
// respuesta falla con error claro y queda registrado en la bitácora.

export type SkillUso = { clave: string; version: string; sha256: string };

export type SkillCargada = SkillUso & { texto: string };

/** Carga la versión vigente de una skill desde agent_prompts. */
export async function cargarSkill(admin: any, clave: string): Promise<SkillCargada> {
  const { data, error } = await admin
    .from("agent_prompts")
    .select("nombre, system_prompt, version, sha256")
    .eq("nombre", clave)
    .eq("estado", "vigente")
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar la skill ${clave}: ${error.message}`);
  if (!data?.system_prompt) throw new Error(`Skill no vigente: ${clave}`);
  return {
    clave: data.nombre,
    version: data.version,
    sha256: data.sha256,
    texto: data.system_prompt,
  };
}

/** Sustituye {{placeholders}} en el texto de la skill. */
export function interpolar(texto: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [clave, valor]) => acc.split(`{{${clave}}}`).join(valor),
    texto,
  );
}

export type Parte = { texto: string; skill?: SkillUso };

/** Arma el prompt final y la lista trazable de skills usadas, en orden. */
export function armarPrompt(
  partes: Parte[],
): { prompt: string; skills_usadas: SkillUso[] } {
  const prompt = partes.map((p) => p.texto).filter(Boolean).join("\n\n");
  const skills_usadas = partes.flatMap((p) => (p.skill ? [p.skill] : []));
  return { prompt, skills_usadas };
}

/** Registra en la bitácora que la skill faltaba y devuelve el error para responder. */
export async function registrarSkillFaltante(
  admin: any,
  orgId: string | null,
  clave: string,
  contexto: string,
): Promise<Error> {
  try {
    await admin.from("audit_trail").insert({
      org_id: orgId,
      tabla: "agent_prompts",
      registro_id: clave,
      accion: "SKILL_NO_VIGENTE",
      valor_nuevo: { contexto },
    });
  } catch (e) {
    console.error("audit SKILL_NO_VIGENTE", e);
  }
  return new Error(
    `Skill no vigente: ${clave}. Publica una versión en el panel Skills de IA (contexto: ${contexto}).`,
  );
}
