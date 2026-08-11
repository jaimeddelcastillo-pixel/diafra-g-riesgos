// Edge function: brain-interview
// Motor de entrevista del Cerebro Institucional (TRACEA).
// Fase 3 — commit 1: esqueleto + herramienta obtener_contexto_cerebro.
//
// Contrato: POST { session_id, messages: [{role, content}] }
// Respuesta: SSE con eventos { type: "content_block_delta" | "tool_use" | "sesion" | "error" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "claude-sonnet-4-6";
const MAX_HISTORY = 24;
const MAX_TOOL_CALLS_PER_TURN = 6;

const TIPOS_CONOCIMIENTO = [
  "identidad_organizacional",
  "producto_proceso",
  "rol_responsabilidad",
  "requisito_regulatorio",
  "arquitectura_sgc",
  "criterio_documental",
  "conocimiento_operativo",
  "riesgo_control",
  "validacion_calificacion",
  "desviacion_capa",
  "auditoria_aprendizaje",
  "regla_pno",
];
const TIPOS_FUENTE = [
  "entrevista",
  "documento",
  "persona",
  "registro",
  "requisito_regulatorio",
  "observacion",
];

// ──────────────────────────── Herramientas ────────────────────────────
const TOOLS: any[] = [
  {
    name: "obtener_contexto_cerebro",
    description:
      "Devuelve el estado actual del Cerebro Institucional de la organización leído desde la base de datos: conocimiento capturado (por tipo), brechas abiertas, contradicciones abiertas, procesos y áreas. Úsala al inicio del turno cuando necesites refrescar contexto o cuando la sesión sea larga. NUNCA reconstruyas el contexto desde el historial del chat. Máximo 1 llamada por turno.",
    input_schema: {
      type: "object",
      properties: {
        incluir_items: {
          type: "boolean",
          description: "Si true, incluye una muestra del contenido de los conocimientos capturados (default true).",
        },
      },
      required: [],
    },
  },
];

TOOLS.push({
  name: "guardar_conocimiento",
  description:
    "Persiste conocimiento institucional extraído de la entrevista en brain_knowledge_items (y sus fuentes en brain_knowledge_sources). Llamar SIEMPRE antes de avanzar cuando la respuesta del entrevistado revele conocimiento relevante. El estado inicial es siempre 'capturado' o 'por_validar' — NUNCA 'validado' (eso es humano). Un ítem puede tener varias fuentes. Máximo 1 llamada por turno con todos los ítems del turno en el arreglo.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "Ítems de conocimiento a guardar en este turno (1 a 8).",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: TIPOS_CONOCIMIENTO, description: "Tipo de conocimiento según el mapeo a BD." },
            contenido: {
              type: "string",
              description:
                "Enunciado completo y autocontenido del conocimiento, redactado de forma que sea comprensible sin el historial del chat. Sin inventar datos.",
            },
            estado: {
              type: "string",
              enum: ["capturado", "por_validar"],
              description: "capturado = dicho expresamente por el entrevistado. por_validar = inferencia razonable pendiente de confirmación.",
            },
            proceso_id: { type: "string", description: "UUID del proceso relacionado, si aplica." },
            area_id: { type: "string", description: "UUID del área relacionada, si aplica." },
            afecta_cumplimiento: { type: "boolean", description: "true si el conocimiento tiene impacto regulatorio o de cumplimiento." },
            contexto: {
              type: "object",
              description: "Metadatos libres: bloque de entrevista, documentos mencionados, roles, condiciones, excepciones.",
            },
            sources: {
              type: "array",
              description: "Fuentes que respaldan el conocimiento. Al menos una.",
              items: {
                type: "object",
                properties: {
                  tipo_fuente: { type: "string", enum: TIPOS_FUENTE },
                  nombre_fuente: { type: "string", description: "Nombre de la persona, documento o registro." },
                  descripcion: { type: "string" },
                  cita_textual: { type: "string", description: "Frase textual del entrevistado que respalda el conocimiento." },
                },
                required: ["tipo_fuente"],
              },
            },
          },
          required: ["tipo", "contenido", "sources"],
        },
      },
    },
    required: ["items"],
  },
});

// ─────────────────── guardar_conocimiento ───────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function execGuardarConocimiento(
  admin: any,
  orgId: string,
  sessionId: string | null,
  userId: string,
  input: any,
) {
  const raw: any[] = Array.isArray(input?.items) ? input.items : [];
  if (!raw.length) return { ok: false, error: "No se recibieron ítems para guardar." };
  if (raw.length > 8) raw.length = 8;

  // IDs válidos de la organización (evita FK inválidas inventadas por el modelo)
  const [{ data: procs }, { data: areas }] = await Promise.all([
    admin.from("brain_processes").select("id").eq("org_id", orgId),
    admin.from("brain_areas").select("id").eq("org_id", orgId),
  ]);
  const procIds = new Set((procs ?? []).map((p: any) => p.id));
  const areaIds = new Set((areas ?? []).map((a: any) => a.id));

  const guardados: any[] = [];
  const rechazados: any[] = [];

  for (const it of raw) {
    const tipo = String(it?.tipo ?? "");
    const contenido = String(it?.contenido ?? "").trim();
    if (!TIPOS_CONOCIMIENTO.includes(tipo)) {
      rechazados.push({ contenido: contenido.slice(0, 80), motivo: `tipo inválido: ${tipo}` });
      continue;
    }
    if (contenido.length < 15) {
      rechazados.push({ contenido, motivo: "contenido demasiado breve — profundiza antes de guardar" });
      continue;
    }
    const estado = it?.estado === "por_validar" ? "por_validar" : "capturado";
    const procesoId = UUID_RE.test(it?.proceso_id ?? "") && procIds.has(it.proceso_id) ? it.proceso_id : null;
    const areaId = UUID_RE.test(it?.area_id ?? "") && areaIds.has(it.area_id) ? it.area_id : null;

    const { data: row, error } = await admin
      .from("brain_knowledge_items")
      .insert({
        org_id: orgId,
        tipo,
        contenido,
        estado,
        proceso_id: procesoId,
        area_id: areaId,
        afecta_cumplimiento: it?.afecta_cumplimiento === true,
        marco_validado: false,
        contexto: {
          ...(typeof it?.contexto === "object" && it.contexto ? it.contexto : {}),
          session_id: sessionId,
          capturado_por: userId,
          capturado_en: new Date().toISOString(),
        },
      })
      .select("id, tipo, estado")
      .single();

    if (error || !row) {
      rechazados.push({ contenido: contenido.slice(0, 80), motivo: error?.message ?? "error al insertar" });
      continue;
    }

    const fuentes = (Array.isArray(it?.sources) ? it.sources : []).filter((s: any) =>
      TIPOS_FUENTE.includes(String(s?.tipo_fuente ?? "")),
    );
    if (!fuentes.length) fuentes.push({ tipo_fuente: "entrevista" });

    const { error: srcErr } = await admin.from("brain_knowledge_sources").insert(
      fuentes.slice(0, 5).map((s: any) => ({
        org_id: orgId,
        knowledge_item_id: row.id,
        tipo_fuente: s.tipo_fuente,
        session_id: sessionId,
        nombre_fuente: s.nombre_fuente ?? null,
        descripcion: s.descripcion ?? null,
        cita_textual: s.cita_textual ?? null,
      })),
    );
    if (srcErr) console.error("brain_knowledge_sources insert", srcErr);

    guardados.push({ id: row.id, tipo: row.tipo, estado: row.estado, fuentes: fuentes.length });
  }

  if (sessionId && guardados.length) {
    const { data: s } = await admin
      .from("brain_interview_sessions")
      .select("items_capturados")
      .eq("id", sessionId)
      .maybeSingle();
    await admin
      .from("brain_interview_sessions")
      .update({ items_capturados: ((s as any)?.items_capturados ?? 0) + guardados.length })
      .eq("id", sessionId)
      .eq("org_id", orgId);
  }

  return {
    ok: guardados.length > 0,
    guardados_count: guardados.length,
    guardados,
    rechazados,
    nota: "Estado inicial capturado/por_validar. La validación es exclusivamente humana desde /cerebro/validacion.",
  };
}
// ──────────────────────── Ejecución de herramientas ────────────────────
async function execObtenerContextoCerebro(
  admin: any,
  orgId: string,
  sessionId: string | null,
  incluirItems = true,
) {
  const [itemsRes, gapsRes, contraRes, procRes, areaRes] = await Promise.all([
    admin
      .from("brain_knowledge_items")
      .select("id, tipo, estado, contenido, proceso_id, area_id, marco_validado, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(120),
    admin
      .from("brain_gaps")
      .select("id, descripcion, tipo_conocimiento, prioridad, estado, rol_sugerido, proceso_id, area_id")
      .eq("org_id", orgId)
      .in("estado", ["abierta", "asignada"])
      .order("prioridad"),
    admin
      .from("brain_contradictions")
      .select("id, afirmacion_a, afirmacion_b, fuente_a, fuente_b, estado, afecta_cumplimiento")
      .eq("org_id", orgId)
      .in("estado", ["abierta", "en_analisis"]),
    admin.from("brain_processes").select("id, nombre, owner_area_id, activo").eq("org_id", orgId).eq("activo", true),
    admin.from("brain_areas").select("id, nombre, activo").eq("org_id", orgId).eq("activo", true),
  ]);

  const items = itemsRes.data ?? [];
  const porTipo: Record<string, number> = {};
  for (const it of items) porTipo[it.tipo] = (porTipo[it.tipo] ?? 0) + 1;

  let sesion: any = null;
  if (sessionId) {
    const { data } = await admin
      .from("brain_interview_sessions")
      .select("id, estado, objetivo_actual, preguntas_realizadas, items_capturados, entrevistado_nombre, assignment_id")
      .eq("id", sessionId)
      .eq("org_id", orgId)
      .maybeSingle();
    sesion = data ?? null;
  }

  return {
    ok: true,
    resumen: {
      conocimientos_totales: items.length,
      por_tipo: porTipo,
      brechas_abiertas: (gapsRes.data ?? []).length,
      contradicciones_abiertas: (contraRes.data ?? []).length,
    },
    sesion,
    conocimientos: incluirItems
      ? items.slice(0, 60).map((i: any) => ({
          id: i.id,
          tipo: i.tipo,
          estado: i.estado,
          marco_validado: i.marco_validado,
          contenido: String(i.contenido ?? "").slice(0, 400),
        }))
      : [],
    brechas: gapsRes.data ?? [],
    contradicciones: contraRes.data ?? [],
    procesos: procRes.data ?? [],
    areas: areaRes.data ?? [],
  };
}

// ──────────────────────────── Contexto de sesión ────────────────────────
async function construirContextoSesion(admin: any, orgId: string, sessionId: string | null, org: any) {
  const ctx = await execObtenerContextoCerebro(admin, orgId, sessionId, true);

  let entrevistado = "No especificado";
  let capa = "vision";
  let nivelAutoridad = "no especificado";
  let procesosAsignados: string[] = [];
  let gapsFiltrados = ctx.brechas;

  if (ctx.sesion?.assignment_id) {
    const { data: asg } = await admin
      .from("brain_interview_assignments")
      .select("id, nombre_externo, puesto, capa, nivel_autoridad, dominios_conocimiento, area_id")
      .eq("id", ctx.sesion.assignment_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (asg) {
      entrevistado = `${asg.nombre_externo ?? ctx.sesion.entrevistado_nombre ?? "—"} — ${asg.puesto ?? "—"}`;
      capa = asg.capa ?? capa;
      nivelAutoridad = asg.nivel_autoridad ?? nivelAutoridad;
      const dominios: string[] = asg.dominios_conocimiento ?? [];
      if (dominios.length) {
        gapsFiltrados = ctx.brechas.filter(
          (g: any) => !g.tipo_conocimiento || dominios.includes(g.tipo_conocimiento),
        );
      }
      const { data: aps } = await admin
        .from("brain_assignment_processes")
        .select("process_id")
        .eq("assignment_id", asg.id)
        .eq("org_id", orgId);
      const ids = (aps ?? []).map((a: any) => a.process_id);
      procesosAsignados = ctx.procesos.filter((p: any) => ids.includes(p.id)).map((p: any) => `${p.nombre} (${p.id})`);
    }
  } else if (ctx.sesion?.entrevistado_nombre) {
    entrevistado = ctx.sesion.entrevistado_nombre;
  }

  const esPrimeraSesion = ctx.resumen.conocimientos_totales === 0;

  const bloque = `

## CONTEXTO DE SESIÓN (fuente: base de datos, NO el historial del chat)
[EMPRESA]: ${org.nombre}
[MARCO REGULATORIO DECLARADO]: ${org.norma_aplicable ?? "no declarado"}
[ESTADO DEL MARCO]: por_validar
[ENTREVISTADO]: ${entrevistado}
[CAPA]: ${capa}
[NIVEL DE AUTORIDAD]: ${nivelAutoridad}
[TIPO DE SESIÓN]: ${esPrimeraSesion ? "primera sesión de la organización" : "sesión de continuación"}
[CONOCIMIENTO PREVIO]: ${ctx.resumen.conocimientos_totales} ítems — ${JSON.stringify(ctx.resumen.por_tipo)}
${ctx.conocimientos.slice(0, 25).map((i: any) => `- (${i.tipo}/${i.estado}) ${i.contenido}`).join("\n") || "- (sin conocimiento previo)"}
[GAPS ACTIVOS PARA ESTE ENTREVISTADO]: ${gapsFiltrados.length}
${gapsFiltrados.slice(0, 20).map((g: any) => `- [${g.prioridad}] ${g.descripcion} (id: ${g.id})`).join("\n") || "- (sin brechas registradas)"}
[CONTRADICCIONES ABIERTAS]: ${ctx.resumen.contradicciones_abiertas}
[PROCESOS ASIGNADOS]: ${procesosAsignados.join(" | ") || "ninguno"}
[AREAS REGISTRADAS]: ${ctx.areas.map((a: any) => `${a.nombre} (${a.id})`).join(" | ") || "ninguna"}
[SESSION_ID]: ${sessionId ?? "—"}
[ORG_ID]: ${orgId}
`;
  return { bloque, ctx };
}

// ──────────────────────────────── Handler ───────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: member } = await admin
      .from("org_members")
      .select("org_id, role, organizations(id, nombre, norma_aplicable, plan)")
      .eq("user_id", user.id)
      .maybeSingle();
    const org: any = (member as any)?.organizations;
    if (!org) return json({ error: "Usuario sin organización" }, 403);

    const body = await req.json();
    const messages: any[] = Array.isArray(body?.messages) ? body.messages : [];
    let sessionId: string | null = body?.session_id ?? null;

    if (sessionId) {
      const { data: s } = await admin
        .from("brain_interview_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("org_id", org.id)
        .maybeSingle();
      if (!s) sessionId = null;
    }

    const promptRow = await admin
      .from("agent_prompts")
      .select("system_prompt, version")
      .eq("nombre", "cerebro_institucional")
      .eq("activo", true)
      .maybeSingle();
    if (!promptRow.data) return json({ error: "Agente Cerebro no configurado" }, 500);

    const { bloque } = await construirContextoSesion(admin, org.id, sessionId, org);
    const systemPrompt = (promptRow.data as any).system_prompt + bloque;

    const trimmed = messages.length > MAX_HISTORY ? messages.slice(-MAX_HISTORY) : messages;
    const turnMessages: any[] = trimmed.length ? [...trimmed] : [{ role: "user", content: "Inicia la sesión." }];

    const encoder = new TextEncoder();
    let executedToolCalls = 0;
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`));
        send({ type: "sesion", session_id: sessionId });
        try {
          for (let round = 0; round < 6; round++) {
            const limitReached = executedToolCalls >= MAX_TOOL_CALLS_PER_TURN;
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: MODEL,
                max_tokens: 3000,
                system: [
                  {
                    type: "text",
                    text: limitReached
                      ? systemPrompt + "\n\n[AVISO INTERNO] Límite de herramientas alcanzado en este turno. Formula UNA pregunta con la información disponible."
                      : systemPrompt,
                    cache_control: { type: "ephemeral" },
                  },
                ],
                tools: limitReached ? [] : TOOLS,
                messages: turnMessages,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              console.error("Anthropic error", res.status, errText);
              send({ type: "error", message: errText.slice(0, 300) });
              break;
            }

            const data = await res.json();
            const blocks = data.content ?? [];
            const toolUses: any[] = [];

            for (const b of blocks) {
              if (b.type === "text") {
                fullText += b.text;
                send({ type: "content_block_delta", delta: { type: "text_delta", text: b.text } });
              } else if (b.type === "tool_use") {
                toolUses.push(b);
                send({ type: "tool_use", name: b.name, input: b.input ?? {} });
              }
            }

            if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

            turnMessages.push({ role: "assistant", content: blocks });
            const toolResults: any[] = [];
            for (const tb of toolUses) {
              if (executedToolCalls >= MAX_TOOL_CALLS_PER_TURN) {
                toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: "Límite de herramientas alcanzado en este turno.", is_error: true });
                continue;
              }
              executedToolCalls++;
              let result: unknown;
              if (tb.name === "obtener_contexto_cerebro") {
                result = await execObtenerContextoCerebro(admin, org.id, sessionId, tb.input?.incluir_items !== false);
              } else if (tb.name === "guardar_conocimiento") {
                result = await execGuardarConocimiento(admin, org.id, sessionId, user.id, tb.input ?? {});
              } else {
                result = { ok: false, error: "Herramienta no disponible todavía." };
              }
              toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(result) });
            }
            turnMessages.push({ role: "user", content: toolResults });
          }
        } catch (e) {
          console.error("brain-interview loop error", e);
          send({ type: "error", message: String(e) });
        } finally {
          try {
            if (sessionId && fullText) {
              const { data: s } = await admin
                .from("brain_interview_sessions")
                .select("preguntas_realizadas")
                .eq("id", sessionId)
                .maybeSingle();
              await admin
                .from("brain_interview_sessions")
                .update({ preguntas_realizadas: ((s as any)?.preguntas_realizadas ?? 0) + 1 })
                .eq("id", sessionId)
                .eq("org_id", org.id);
            }
          } catch (e) { console.error("persist session fail", e); }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (e) {
    console.error("brain-interview error", e);
    return json({ error: String(e) }, 500);
  }
});
