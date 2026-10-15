// C4a · Armador único de prompts con skills versionadas en la base.
// Las funciones Edge NUNCA guardan texto de prompt en el código: lo leen
// de agent_prompts (estado 'vigente'). Si la skill no está vigente, la
// respuesta falla con error claro y queda registrado en la bitácora.

export type SkillUso = { clave: string; version: string; sha256: string };

export type SkillCargada = SkillUso & { texto: string };

/** Carga la versión vigente de una skill desde agent_prompts. */
export async function cargarSkill(admin: any, clave: string): Promise<SkillCargada & { id?: string }> {
  const { data, error } = await admin
    .from("agent_prompts")
    .select("id, nombre, system_prompt, version, sha256")
    .eq("nombre", clave)
    .eq("estado", "vigente")
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar la skill ${clave}: ${error.message}`);
  if (!data?.system_prompt) throw new Error(`Skill no vigente: ${clave}`);
  return {
    id: data.id,
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

// ═══════════════════════════════════════════════════════════════════
// C4b · Armador por bloques (Riesgos). No sustituye la composición
// monolítica (dm/farma): chat-asistente lo usa solo si la empresa está en
// 'bloques' (ia_config_org) y las piezas obligatorias tienen versión vigente.
// ═══════════════════════════════════════════════════════════════════

export type PiezaUsada = SkillUso & { id?: string; estado?: string };

/** Módulo comercial → fragmento de alcance. Capacitación acompaña a todo módulo. */
const ALCANCES: { clave: string; modulo: string | null; etiqueta: string }[] = [
  { clave: "alcance_riesgos", modulo: "riesgos", etiqueta: "Gestión de Riesgos (análisis AMEF, folios, matriz de riesgos)" },
  { clave: "alcance_cerebro", modulo: "institutional_brain", etiqueta: "Cerebro Institucional (Listado Maestro, conocimiento validado, entrevistas)" },
  { clave: "alcance_capacitacion", modulo: null, etiqueta: "Capacitación" },
];

export type OrgBloques = {
  id: string; nombre: string; norma_aplicable: string | null; metodologia: string | null;
  usar_detectabilidad: boolean | null; umbral_npr_alto: number | null; umbral_npr_medio: number | null;
};

export type ResultadoBloques =
  | {
      ok: true;
      /** Bloques 1–3, idénticos entre llamadas (se marcan para caché). */
      fijo: string;
      /** [CONTEXTO_EMPRESA] + [ALCANCE_TRACEA]. */
      variable: string;
      skills_usadas: PiezaUsada[];
      norma: "NOM-241" | "NOM-059";
    }
  | { ok: false; faltantes: string[] };

async function cargarPorId(admin: any, id: string): Promise<SkillCargada & { id: string; estado: string }> {
  const { data, error } = await admin
    .from("agent_prompts").select("id, nombre, system_prompt, version, sha256, estado")
    .eq("id", id).maybeSingle();
  if (error || !data) throw new Error(`Versión de skill no encontrada: ${id}`);
  return { id: data.id, estado: data.estado, clave: data.nombre, version: data.version, sha256: data.sha256, texto: data.system_prompt };
}

async function cargarVigenteOpcional(admin: any, clave: string) {
  try { return await cargarSkill(admin, clave); } catch { return null; }
}

/** Norma de bloques: folio manda; sin folio, la selección vigente (dm/farma). */
export function normaBloques(folioNorma: string | null, folioCategoria: string | null, agente: "dm" | "farma"): "NOM-241" | "NOM-059" {
  if (folioNorma === "NOM-059") return "NOM-059";
  if (folioNorma === "NOM-241") return "NOM-241";
  if (folioNorma === "MULTI") return folioCategoria === "medicamento" ? "NOM-059" : "NOM-241";
  return agente === "farma" ? "NOM-059" : "NOM-241";
}

/**
 * armarRiesgos({ org, norma }) — orden fijo:
 * plataforma · riesgos_amef · norma_nom241|norma_nom059 · [CONTEXTO_EMPRESA] · [ALCANCE_TRACEA]
 * El contexto del folio, la nota de continuidad y las reglas de herramientas
 * las añade quien llama, igual que hoy.
 * `versiones` (solo para pruebas) fija ids de agent_prompts por clave (vigente o borrador).
 */
export async function armarRiesgos(
  admin: any,
  args: { org: OrgBloques; norma: "NOM-241" | "NOM-059"; versiones?: Record<string, string> },
): Promise<ResultadoBloques> {
  const { org, norma, versiones = {} } = args;
  const claveNorma = norma === "NOM-059" ? "norma_nom059" : "norma_nom241";
  const obligatorias = ["plataforma", "riesgos_amef", claveNorma];

  const piezas: (SkillCargada & { id?: string; estado?: string })[] = [];
  const faltantes: string[] = [];
  for (const clave of obligatorias) {
    const s = versiones[clave]
      ? await cargarPorId(admin, versiones[clave]).catch(() => null)
      : await cargarVigenteOpcional(admin, clave);
    if (!s || s.clave !== clave || !s.texto?.trim()) faltantes.push(clave);
    else piezas.push(s);
  }
  if (faltantes.length) return { ok: false, faltantes };

  // [CONTEXTO_EMPRESA]
  const contexto =
    `[CONTEXTO_EMPRESA]\nNombre: ${org.nombre}\nNorma(s): ${org.norma_aplicable ?? "—"}` +
    `${org.norma_aplicable === "MULTI" ? ` (norma de esta conversación: ${norma})` : ""}\n` +
    `Metodología: ${org.metodologia ?? "—"}\nUsa detectabilidad: ${org.usar_detectabilidad}\n` +
    `Umbral NPR alto: ${org.umbral_npr_alto}\nUmbral NPR medio: ${org.umbral_npr_medio}`;

  // [ALCANCE_TRACEA]
  const fragmentos: string[] = [];
  const noEstan: string[] = [];
  const usadosAlcance: (SkillCargada & { id?: string; estado?: string })[] = [];
  for (const a of ALCANCES) {
    let activo = true;
    if (a.modulo) {
      const { data } = await admin.rpc("org_tiene_modulo", { _org: org.id, _modulo: a.modulo });
      activo = !!data;
    }
    if (!activo) { noEstan.push(a.etiqueta); continue; }
    const s = versiones[a.clave]
      ? await cargarPorId(admin, versiones[a.clave]).catch(() => null)
      : await cargarVigenteOpcional(admin, a.clave);
    if (s && s.clave === a.clave && s.texto?.trim()) { fragmentos.push(s.texto); usadosAlcance.push(s); }
  }
  const alcance =
    `[ALCANCE_TRACEA]\n${fragmentos.join("\n\n")}${fragmentos.length ? "\n\n" : ""}` +
    `Funciones que NO están en TRACEA para esta empresa: ${noEstan.length ? noEstan.join("; ") : "ninguna"}.`;

  const todas = [...piezas, ...usadosAlcance];
  return {
    ok: true,
    fijo: piezas.map((p) => p.texto).join("\n\n"),
    variable: `${contexto}\n\n${alcance}`,
    skills_usadas: todas.map((p) => ({ clave: p.clave, version: p.version, sha256: p.sha256, ...(p.id ? { id: p.id, estado: p.estado } : {}) })),
    norma,
  };
}
