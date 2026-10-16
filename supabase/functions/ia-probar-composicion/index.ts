// C4b · «Probar composición» (solo super_admin, solo empresas es_prueba).
// Corre los casos SIN herramientas: nunca escribe datos de negocio; solo
// guarda las respuestas en ia_skill_pruebas. La IA no se califica a sí misma.
import { contextoFechaMexico } from "../_shared/fecha-mexico.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { armarRiesgos, cargarSkill } from "../_shared/skills.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// Mismo modelo que el asistente en producción (análisis).
const MODELO = "claude-sonnet-4-6";
const NOTA_PRUEBA =
  "\n\n[MODO PRUEBA] En esta conversación no hay herramientas disponibles ni folio activo. Responde solo con texto.";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Iniciar = z.object({
  accion: z.literal("iniciar"),
  norma: z.enum(["NOM-241", "NOM-059"]),
  org_id: z.string().uuid(),
  versiones: z.record(z.string().uuid()),
});
const Correr = z.object({ accion: z.literal("correr"), prueba_id: z.string().uuid() });

function contextoMonolitico(org: any): string {
  let ancla = "";
  if (org.norma_aplicable === "NOM-241") {
    ancla = "## NORMA APLICABLE FIJA\nEsta organización opera exclusivamente bajo NOM-241-SSA1-2025 y FEUM.\nNUNCA cites, sugieras ni mezcles NOM-059-SSA1-2015 salvo que el usuario pregunte explícitamente por comparación regulatoria.\n\n";
  } else if (org.norma_aplicable === "NOM-059") {
    ancla = "## NORMA APLICABLE FIJA\nEsta organización opera exclusivamente bajo NOM-059-SSA1-2015 y FEUM.\nNUNCA cites, sugieras ni mezcles NOM-241-SSA1-2025 salvo que el usuario pregunte explícitamente por comparación regulatoria.\n\n";
  }
  return ancla;
}
function orgCtx(org: any): string {
  return `\n\n## CONTEXTO DE LA ORGANIZACIÓN\n${contextoFechaMexico()}\nNombre: ${org.nombre}\nNorma aplicable: ${org.norma_aplicable}\nMetodología: ${org.metodologia}\nUsa detectabilidad: ${org.usar_detectabilidad}\nUmbral NPR Alto: ${org.umbral_npr_alto}\nUmbral NPR Medio: ${org.umbral_npr_medio}`;
}

async function preguntar(system: any[], entrada: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELO, max_tokens: 2048, system, messages: [{ role: "user", content: entrada }] }),
  });
  if (!res.ok) throw new Error(`Modelo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);
    const { data: esSA } = await userClient.rpc("is_super_admin");
    if (!esSA) return json({ error: "Solo super admin" }, 403);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();

    // ── iniciar: crea la corrida con todos los casos aplicables (pendiente) ──
    if (body?.accion === "iniciar") {
      const p = Iniciar.safeParse(body);
      if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400);
      const { norma, org_id, versiones } = p.data;
      const { data: org } = await admin.from("organizations")
        .select("id, nombre, es_prueba, norma_aplicable, metodologia, usar_detectabilidad, umbral_npr_alto, umbral_npr_medio")
        .eq("id", org_id).maybeSingle();
      if (!org) return json({ error: "Empresa no encontrada" }, 404);
      if (!org.es_prueba) return json({ error: "Solo se prueba con empresas QA (es_prueba)." }, 400);

      const r = await armarRiesgos(admin, { org, norma, versiones });
      if (!r.ok) return json({ error: `Faltan piezas con texto: ${r.faltantes.join(", ")}` }, 400);
      const refClave = norma === "NOM-059" ? "farma" : "dm";
      const ref = await cargarSkill(admin, refClave).catch(() => null);

      const { data: casos } = await admin.from("ia_skill_casos")
        .select("id, codigo").eq("activo", true).in("norma", ["ambas", norma]);
      const corrida_id = crypto.randomUUID();
      const composicion = { norma, org_id, piezas: r.skills_usadas };
      const referencia = ref ? { clave: ref.clave, version: ref.version, sha256: ref.sha256, id: ref.id } : null;
      const filas = (casos ?? []).map((c: any) => ({
        corrida_id, caso_id: c.id, norma, org_id, composicion, referencia, creado_por: user.id,
      }));
      const { error } = await admin.from("ia_skill_pruebas").insert(filas);
      if (error) return json({ error: error.message }, 500);
      await admin.from("audit_trail").insert({
        user_id: user.id, org_id, tabla: "ia_skill_pruebas", registro_id: corrida_id,
        accion: "SKILL_CORRIDA_INICIADA", valor_nuevo: { norma, piezas: r.skills_usadas, referencia, casos: filas.length },
      });
      return json({ corrida_id, casos: filas.length });
    }

    // ── correr: ejecuta un caso sin herramientas, nueva vs. dm/farma vigente ──
    if (body?.accion === "correr") {
      const p = Correr.safeParse(body);
      if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400);
      const { data: prueba } = await admin.from("ia_skill_pruebas")
        .select("id, norma, org_id, composicion, referencia, respuesta, caso:ia_skill_casos(entrada, requiere_herramientas)")
        .eq("id", p.data.prueba_id).maybeSingle();
      if (!prueba) return json({ error: "Prueba no encontrada" }, 404);
      const caso: any = (prueba as any).caso;
      if (caso?.requiere_herramientas) return json({ omitido: "Probar en un folio QA" });
      if (prueba.respuesta) return json({ ok: true, ya_corrida: true });

      const { data: org } = await admin.from("organizations")
        .select("id, nombre, es_prueba, norma_aplicable, metodologia, usar_detectabilidad, umbral_npr_alto, umbral_npr_medio")
        .eq("id", prueba.org_id).maybeSingle();
      if (!org?.es_prueba) return json({ error: "Solo empresas QA" }, 400);

      const versiones: Record<string, string> = {};
      for (const pz of (prueba.composicion as any).piezas ?? []) if (pz.id) versiones[pz.clave] = pz.id;
      const r = await armarRiesgos(admin, { org, norma: prueba.norma as any, versiones });
      if (!r.ok) return json({ error: `Faltan piezas: ${r.faltantes.join(", ")}` }, 400);
      const esperadas = ((prueba.composicion as any).piezas ?? []).map((x: any) => x.sha256).join("|");
      if (r.skills_usadas.map((x) => x.sha256).join("|") !== esperadas) {
        return json({ error: "La composición cambió desde que se inició la corrida; inicia otra." }, 409);
      }

      const tareas: Promise<string | null>[] = [
        preguntar([
          { type: "text", text: r.fijo, cache_control: { type: "ephemeral" } },
          { type: "text", text: r.variable + NOTA_PRUEBA },
        ], caso.entrada),
      ];
      const refInfo: any = prueba.referencia;
      if (refInfo?.id) {
        const { data: refRow } = await admin.from("agent_prompts").select("system_prompt").eq("id", refInfo.id).maybeSingle();
        tareas.push(refRow
          ? preguntar([{ type: "text", text: contextoMonolitico(org) + refRow.system_prompt + orgCtx(org) + NOTA_PRUEBA }], caso.entrada)
          : Promise.resolve(null));
      } else tareas.push(Promise.resolve(null));
      const [nueva, referencia] = await Promise.all(tareas);

      const { error } = await admin.from("ia_skill_pruebas")
        .update({ respuesta: nueva, respuesta_referencia: referencia, modelo_ia: MODELO })
        .eq("id", prueba.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "acción inválida" }, 400);
  } catch (e) {
    console.error("ia-probar-composicion", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
