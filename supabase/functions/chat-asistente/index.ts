// Edge function: chat-asistente
// Stream Claude responses (Anthropic SSE) with org/plan/norma awareness + tool calling.
// 1 user message = 1 unit (incremented on the first user message of the request).

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
const CLAUDE_MODEL = "claude-sonnet-4-6";

const PLAN_LIMITS: Record<string, number> = {
  trial: 30,
  starter: 30,
  pro: 300,
  professional: 300,
  enterprise: -1,
};

const TOOLS = [
  {
    name: "buscar_folio",
    description:
      "Busca un folio por código (GR-YYYY-NNN), nombre del proceso/equipo o palabras clave. Devuelve folios candidatos con su ID, código, estado y proceso.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Texto a buscar" } },
      required: ["query"],
    },
  },
  {
    name: "proponer_riesgo",
    description:
      "Propone un nuevo riesgo para que el usuario lo revise. NO inserta directamente. Usar SIEMPRE antes de insertar. El frontend mostrará una tarjeta con botones Insertar/Modificar/Descartar.",
    input_schema: {
      type: "object",
      properties: {
        folio_id: { type: "string" },
        peligro: { type: "string" },
        situacion_peligrosa: { type: "string" },
        secuencia_eventos: { type: "string" },
        efecto_dano: { type: "string" },
        causa_potencial: { type: "string" },
        etapa_proceso: { type: "string" },
        controles_actuales: { type: "string" },
        severidad: { type: "integer", minimum: 1, maximum: 10 },
        ocurrencia: { type: "integer", minimum: 1, maximum: 10 },
        deteccion: { type: "integer", minimum: 1, maximum: 10 },
        justificacion: { type: "string" },
      },
      required: ["folio_id", "peligro", "situacion_peligrosa", "efecto_dano", "severidad", "ocurrencia", "deteccion"],
    },
  },
];

async function getOrgContext(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, nombre, plan, norma_aplicable, metodologia, usar_detectabilidad, umbral_npr_alto, umbral_npr_medio)")
    .eq("user_id", userId)
    .maybeSingle();
  return member;
}

async function getActivePrompt(supabase: any, nombre: "dm" | "farma") {
  const { data } = await supabase
    .from("agent_prompts")
    .select("system_prompt, version")
    .eq("nombre", nombre)
    .eq("activo", true)
    .maybeSingle();
  return data;
}

async function bumpUsage(supabase: any, orgId: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const { data: existing } = await supabase
    .from("chat_uso_mensual")
    .select("mensajes_consumidos")
    .eq("org_id", orgId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("chat_uso_mensual")
      .update({
        mensajes_consumidos: existing.mensajes_consumidos + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("year", year)
      .eq("month", month);
    return existing.mensajes_consumidos + 1;
  } else {
    await supabase.from("chat_uso_mensual").insert({
      org_id: orgId, year, month, mensajes_consumidos: 1,
    });
    return 1;
  }
}

async function getCurrentUsage(supabase: any, orgId: string) {
  const now = new Date();
  const { data } = await supabase
    .from("chat_uso_mensual")
    .select("mensajes_consumidos")
    .eq("org_id", orgId)
    .eq("year", now.getUTCFullYear())
    .eq("month", now.getUTCMonth() + 1)
    .maybeSingle();
  return data?.mensajes_consumidos ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "no autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "sesión inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const messages: Array<{ role: "user" | "assistant"; content: any }> = body.messages ?? [];
    const folio_id: string | null = body.folio_id ?? null;
    const agente_override: "dm" | "farma" | null = body.agente ?? null;

    const member = await getOrgContext(adminClient, user.id);
    if (!member) {
      return new Response(JSON.stringify({ error: "sin organización" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const org = member.organizations as any;

    // Determinar agente
    let agente: "dm" | "farma" = "dm";
    if (agente_override) agente = agente_override;
    else if (org.norma_aplicable === "NOM-059") agente = "farma";
    else if (org.norma_aplicable === "MULTI") {
      // Si MULTI y no se especifica, default DM
      agente = "dm";
    }

    // Verificar límite
    const limit = PLAN_LIMITS[org.plan] ?? 30;
    const usage = await getCurrentUsage(adminClient, org.id);
    if (limit !== -1 && usage >= limit) {
      return new Response(JSON.stringify({
        error: "limite_alcanzado",
        message: `Has alcanzado el límite mensual de ${limit} mensajes del plan ${org.plan}.`,
        usage, limit,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cargar system prompt
    const promptRow = await getActivePrompt(adminClient, agente);
    if (!promptRow) {
      return new Response(JSON.stringify({ error: "Agente no configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Folio context
    let folioCtx = "";
    if (folio_id) {
      const { data: folio } = await adminClient
        .from("folios")
        .select("codigo, proceso_equipo, estado, norma_folio, alcance, beneficio_clinico")
        .eq("id", folio_id)
        .maybeSingle();
      const { data: riesgos } = await adminClient
        .from("riesgos")
        .select("numero_id, peligro, situacion_peligrosa, severidad, ocurrencia, deteccion, npr, dictamen")
        .eq("folio_id", folio_id)
        .order("numero_id");
      if (folio) {
        folioCtx = `\n\n## CONTEXTO DEL FOLIO ACTIVO\nCódigo: ${folio.codigo}\nProceso/Equipo: ${folio.proceso_equipo}\nEstado: ${folio.estado}\nNorma: ${folio.norma_folio}\nAlcance: ${folio.alcance ?? "—"}\nFolio_id: ${folio_id}\n\nRiesgos actuales (${(riesgos ?? []).length}):\n${(riesgos ?? []).map((r: any) => `#${r.numero_id} S:${r.severidad} O:${r.ocurrencia} D:${r.deteccion} NPR:${r.npr} ${r.dictamen} — ${r.peligro}`).join("\n")}`;
      }
    }

    const orgCtx = `\n\n## CONTEXTO DE LA ORGANIZACIÓN\nNombre: ${org.nombre}\nNorma aplicable: ${org.norma_aplicable}\nMetodología: ${org.metodologia}\nUsa detectabilidad: ${org.usar_detectabilidad}\nUmbral NPR Alto: ${org.umbral_npr_alto}\nUmbral NPR Medio: ${org.umbral_npr_medio}`;

    const systemPrompt = (promptRow as any).system_prompt + orgCtx + folioCtx;

    // Persistir el último mensaje user + bump
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await adminClient.from("chat_mensajes").insert({
        org_id: org.id, folio_id, user_id: user.id,
        role: "user",
        contenido: typeof lastUser.content === "string" ? lastUser.content : JSON.stringify(lastUser.content),
        agente,
      });
      await bumpUsage(adminClient, org.id);
    }

    // Llamar a Claude con stream
    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages,
        stream: true,
      }),
    });

    if (!anthRes.ok) {
      const errText = await anthRes.text();
      console.error("Anthropic error:", anthRes.status, errText);
      return new Response(JSON.stringify({ error: "anthropic_error", detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture full assistant response to persist after stream ends
    let fullText = "";
    const toolUses: any[] = [];
    let tokensIn = 0, tokensOut = 0;

    const reader = anthRes.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        let currentToolInputJson = "";
        let currentToolBlock: any = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) {
                // forward also event lines untouched
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }
              const payload = line.slice(6);
              try {
                const evt = JSON.parse(payload);
                if (evt.type === "content_block_start" && evt.content_block?.type === "tool_use") {
                  currentToolBlock = { ...evt.content_block };
                  currentToolInputJson = "";
                }
                if (evt.type === "content_block_delta") {
                  if (evt.delta?.type === "text_delta") fullText += evt.delta.text ?? "";
                  if (evt.delta?.type === "input_json_delta") currentToolInputJson += evt.delta.partial_json ?? "";
                }
                if (evt.type === "content_block_stop" && currentToolBlock) {
                  try { currentToolBlock.input = JSON.parse(currentToolInputJson || "{}"); }
                  catch { currentToolBlock.input = {}; }
                  toolUses.push(currentToolBlock);
                  currentToolBlock = null;
                }
                if (evt.type === "message_delta" && evt.usage) {
                  tokensOut = evt.usage.output_tokens ?? tokensOut;
                }
                if (evt.type === "message_start" && evt.message?.usage) {
                  tokensIn = evt.message.usage.input_tokens ?? tokensIn;
                }
              } catch { /* ignore parse errors of partial */ }
              controller.enqueue(encoder.encode(line + "\n"));
            }
          }
        } catch (e) {
          console.error("stream error", e);
        } finally {
          // Persistir respuesta del asistente
          try {
            await adminClient.from("chat_mensajes").insert({
              org_id: org.id, folio_id, user_id: user.id,
              role: "assistant",
              contenido: fullText,
              tokens_usados: tokensIn + tokensOut,
              agente,
              documentos_adjuntos: toolUses.length ? { tool_uses: toolUses } : null,
            });
          } catch (e) { console.error("persist assistant fail", e); }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("chat-asistente error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});