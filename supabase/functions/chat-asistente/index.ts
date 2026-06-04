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
const CLAUDE_MODEL_SONNET = "claude-sonnet-4-6";
const CLAUDE_MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MAX_HISTORY = 20;
const HAIKU_TRIGGERS = ["/consulta", "/ayuda", "/resumen", "/estado"];
const SONNET_TRIGGERS = ["/nuevo", "/folio", "/id", "/etapa", "/migrar", "/cerrar"];
const HINT_SENTINEL = "[HINT_LARGA]";
const HINT_TEXT = "_💡 Conversación larga detectada — escribe `/estado` para que el Asistente recupere el contexto del análisis._\n\n";

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
      "Busca un folio existente por código (GR-YYYY-NNN), nombre del proceso/equipo o palabras clave. Devuelve { found, folios } o { found: false, message } si no existe. NO repetir si ya devolvió found:false.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Texto a buscar" } },
      required: ["query"],
    },
  },
  {
    name: "crear_folio",
    description:
      "Crea un nuevo folio de gestión de riesgos en estado Borrador para la organización del usuario. Úsalo cuando el usuario pida explícitamente crear un folio nuevo, o cuando buscar_folio devuelva found:false y el usuario confirme que quiere crearlo. Devuelve { folio_id, codigo }.",
    input_schema: {
      type: "object",
      properties: {
        proceso_equipo: { type: "string", description: "Nombre del proceso / producto / equipo / sistema. Obligatorio." },
        origen: {
          type: "string",
          description: "Origen del análisis (texto libre del catálogo agrupado, ej: 'Diseño y Desarrollo', 'Desviación', 'Tecnovigilancia', 'Farmacovigilancia', 'OOS / OOT', 'Control de Cambios'). Default: 'Diseño y Desarrollo'.",
        },
        alcance: { type: "string", description: "Alcance del análisis (opcional)." },
        tipo: { type: "string", enum: ["SGC", "FAB", "SIS", "CAL", "PRD", "PMS", "FV"], description: "Tipo de folio. Si no viene, el sistema usa SGC." },
      },
      required: ["proceso_equipo"],
    },
  },
  {
    name: "consultar_config_org",
    description:
      "Devuelve la configuración de la organización (umbrales NPR, norma, metodología, uso de detectabilidad). Úsalo UNA VEZ al inicio de un análisis para alinear escalas y vocabulario. No lo repitas en el mismo turno.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "listar_riesgos_folio",
    description:
      "Lista los riesgos ya registrados en un folio (id, numero, peligro, S/O/D, NPR, dictamen). Úsalo antes de proponer nuevos riesgos para evitar duplicados o cuando el usuario pregunte qué lleva el folio.",
    input_schema: {
      type: "object",
      properties: { folio_id: { type: "string" } },
      required: ["folio_id"],
    },
  },
  {
    name: "actualizar_folio",
    description:
      "Actualiza metadatos del folio (Sección I/V/VI): alcance, número de modelo/lote, clase de dispositivo, beneficio clínico, riesgo residual global, justificación técnica, conclusión y normas aplicables. Solo se permite si el folio está en Borrador. Pasa únicamente los campos que vas a cambiar.",
    input_schema: {
      type: "object",
      properties: {
        folio_id: { type: "string" },
        alcance: { type: "string" },
        numero_modelo: { type: "string" },
        numero_lote: { type: "string" },
        clase_dispositivo: { type: "string" },
        beneficio_clinico: { type: "string" },
        riesgo_residual_global: { type: "string" },
        justificacion_tecnica: { type: "string" },
        conclusion: { type: "string", enum: ["Aprobado", "Aprobado con condiciones", "No aprobado"] },
        normas_aplicables: { type: "array", items: { type: "string" } },
        // ── Clasificación adaptable según norma ──
        clasificacion_categoria: { type: "string", enum: ["dispositivo", "medicamento"], description: "Solo orgs MULTI: define si el folio se clasifica como DM o medicamento." },
        clasificacion_tipo: { type: "string", description: "Solo medicamentos: Alopático, Biológico/biotecnológico, Genérico intercambiable, OTC, Homeopático, Herbolario." },
        clasificacion_condicion_venta: { type: "string", description: "Solo medicamentos: Prescripción obligatoria, OTC, OTC con leyenda." },
        clasificacion_riesgo_sanitario: { type: "string", description: "Solo medicamentos: Alto, Moderado, Bajo." },
      },
      required: ["folio_id"],
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
        modo_falla: {
          type: "string",
          description: "Modo de falla asociado al peligro (cómo falla el proceso/producto). Mapea a la columna peligro_modo_falla.",
        },
        situacion_peligrosa: { type: "string" },
        secuencia_eventos: { type: "string" },
        efecto_dano: { type: "string" },
        causa_potencial: { type: "string" },
        etapa_proceso: { type: "string" },
        controles_existentes: {
          type: "string",
          description: "Controles ya implementados por la organización (preguntar al usuario antes de proponer controles nuevos). Mapea a controles_actuales.",
        },
        controles_actuales: { type: "string" },
        controles_prevencion: { type: "string" },
        controles_deteccion: { type: "string" },
        severidad: { type: "integer", minimum: 1, maximum: 10 },
        ocurrencia: { type: "integer", minimum: 1, maximum: 10 },
        deteccion: { type: "integer", minimum: 1, maximum: 10 },
        justificacion: { type: "string" },
        requiere_accion: { type: "boolean" },
        accion_propuesta: { type: "string" },
        responsable: { type: "string" },
        fecha_compromiso: { type: "string", description: "Fecha YYYY-MM-DD" },
        sev_residual: { type: "integer", minimum: 1, maximum: 10 },
        ocu_residual: { type: "integer", minimum: 1, maximum: 10 },
        det_residual: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["folio_id", "peligro", "modo_falla", "situacion_peligrosa", "efecto_dano", "severidad", "ocurrencia", "deteccion"],
    },
  },
];

const MAX_TOOL_CALLS_PER_TURN = 8;

async function execBuscarFolio(adminClient: any, orgId: string, query: string) {
  const q = String(query ?? "").trim();
  if (!q) return { found: false, message: "Consulta vacía." };
  const { data, error } = await adminClient
    .from("folios")
    .select("id, codigo, proceso_equipo, estado, norma_folio, fecha_inicio")
    .eq("org_id", orgId)
    .or(`codigo.ilike.%${q}%,proceso_equipo.ilike.%${q}%,alcance.ilike.%${q}%`)
    .order("fecha_inicio", { ascending: false })
    .limit(10);
  if (error) return { found: false, message: `Error de búsqueda: ${error.message}` };
  if (!data || data.length === 0) {
    return { found: false, message: "Folio no encontrado. Puede crearse como nuevo usando la herramienta crear_folio." };
  }
  return { found: true, folios: data };
}

async function execCrearFolio(
  adminClient: any,
  orgId: string,
  userId: string,
  input: any,
) {
  const proceso_equipo = String(input?.proceso_equipo ?? "").trim();
  if (!proceso_equipo) return { ok: false, error: "proceso_equipo es obligatorio." };
  const origen = input?.origen ?? "Diseño y Desarrollo";
  const alcance = String(input?.alcance ?? "").trim();

  // Validar/normalizar tipo (default SGC silencioso para no interrumpir el flujo del agente)
  const TIPOS_VALIDOS = ["SGC", "FAB", "SIS", "CAL", "PRD", "PMS", "FV"];
  const tipoInput = String(input?.tipo ?? "").trim().toUpperCase();
  const tipo = TIPOS_VALIDOS.includes(tipoInput) ? tipoInput : "SGC";
  const tipoAdvertencia =
    tipoInput && !TIPOS_VALIDOS.includes(tipoInput)
      ? `Tipo "${tipoInput}" no válido — se usó SGC por defecto.`
      : null;

  // Reservar siguiente número con la nueva función (secuencia por org/año/tipo)
  const year = new Date().getUTCFullYear();
  let codigo: string;
  const { data: codigoData, error: codigoErr } = await adminClient.rpc(
    "next_folio_code",
    { p_tipo: tipo },
  );
  if (codigoErr || !codigoData) {
    // Fallback manual ante fallo de RPC (mantiene resiliencia del agente)
    const { data: seq } = await adminClient
      .from("folio_sequence")
      .select("last_number")
      .eq("org_id", orgId).eq("year", year).eq("tipo", tipo).maybeSingle();
    const nextNumber = (seq?.last_number ?? 0) + 1;
    if (seq) {
      await adminClient.from("folio_sequence")
        .update({ last_number: nextNumber })
        .eq("org_id", orgId).eq("year", year).eq("tipo", tipo);
    } else {
      await adminClient.from("folio_sequence")
        .insert({ org_id: orgId, year, tipo, last_number: nextNumber });
    }
    codigo = `GR-${tipo}-${year}-${String(nextNumber).padStart(3, "0")}`;
  } else {
    codigo = codigoData as string;
  }

  const { data: folio, error } = await adminClient
    .from("folios")
    .insert({
      codigo,
      tipo_folio: tipo,
      proceso_equipo,
      origen,
      alcance,
      org_id: orgId,
      created_by: userId,
      estado: "Borrador",
    })
    .select("id, codigo, tipo_folio, proceso_equipo, estado")
    .single();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    folio_id: folio.id,
    codigo: folio.codigo,
    tipo: folio.tipo_folio,
    proceso_equipo: folio.proceso_equipo,
    estado: folio.estado,
    ...(tipoAdvertencia ? { advertencia: tipoAdvertencia } : {}),
  };
}

async function execConsultarConfigOrg(org: any) {
  return {
    nombre: org.nombre,
    norma_aplicable: org.norma_aplicable,
    metodologia: org.metodologia,
    usar_detectabilidad: org.usar_detectabilidad,
    umbral_npr_medio: org.umbral_npr_medio,
    umbral_npr_alto: org.umbral_npr_alto,
    clasificacion: {
      bajo: `NPR < ${org.umbral_npr_medio}`,
      medio: `${org.umbral_npr_medio} ≤ NPR < ${org.umbral_npr_alto}`,
      alto: `NPR ≥ ${org.umbral_npr_alto}`,
    },
  };
}

async function execListarRiesgosFolio(adminClient: any, orgId: string, folioId: string) {
  if (!folioId) return { ok: false, error: "folio_id requerido" };
  const { data: folio } = await adminClient
    .from("folios").select("id, org_id, codigo").eq("id", folioId).maybeSingle();
  if (!folio || folio.org_id !== orgId) return { ok: false, error: "Folio no pertenece a la organización." };
  const { data, error } = await adminClient
    .from("riesgos")
    .select("id, numero_id, peligro, situacion_peligrosa, severidad, ocurrencia, deteccion, npr, sev_residual, ocu_residual, det_residual, npr_residual, dictamen, requiere_accion")
    .eq("folio_id", folioId).order("numero_id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, codigo: folio.codigo, total: data?.length ?? 0, riesgos: data ?? [] };
}

async function execActualizarFolio(adminClient: any, orgId: string, input: any) {
  const folioId = input?.folio_id;
  if (!folioId) return { ok: false, error: "folio_id requerido" };
  const { data: folio } = await adminClient
    .from("folios").select("id, org_id, estado").eq("id", folioId).maybeSingle();
  if (!folio || folio.org_id !== orgId) return { ok: false, error: "Folio no pertenece a la organización." };
  if (folio.estado !== "Borrador") return { ok: false, error: `Folio en estado "${folio.estado}", solo editable en Borrador.` };

  const allowed = [
    "alcance","numero_modelo","numero_lote","clase_dispositivo","beneficio_clinico",
    "riesgo_residual_global","justificacion_tecnica","conclusion","normas_aplicables",
    "clasificacion_categoria","clasificacion_tipo","clasificacion_condicion_venta","clasificacion_riesgo_sanitario",
  ];
  const patch: any = {};
  for (const k of allowed) if (input[k] !== undefined) patch[k] = input[k];
  if (Object.keys(patch).length === 0) return { ok: false, error: "Sin campos para actualizar." };

  const { error } = await adminClient.from("folios").update(patch).eq("id", folioId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, folio_id: folioId, actualizados: Object.keys(patch) };
}

const TOOL_RULES_ADDENDUM = `

## REGLAS DE USO DE HERRAMIENTAS (obligatorias)
1. Si el usuario dice EXPLÍCITAMENTE "el folio no existe", "crea el folio GR-XXXX" o "crea un nuevo folio", NO llames a buscar_folio. Llama directamente a crear_folio.
2. Si llamas a buscar_folio y devuelve { found: false }, NO repitas la búsqueda con otra query parecida. Pregunta al usuario si desea crear el folio o, si ya lo confirmó, llama a crear_folio.
2.1. Si crear_folio devuelve ok=true con folio_id/codigo, ese folio queda activo en la conversación. NO llames crear_folio otra vez para el mismo proceso; usa ese folio_id para listar_riesgos_folio y proponer_riesgo.
3. Máximo 8 llamadas a herramientas por turno del usuario. Tras alcanzar ese tope, recibirás un aviso y deberás responder con la información disponible sin más búsquedas.
4. proponer_riesgo es terminal: tras llamarla NO sigas ejecutando otras herramientas en el mismo turno (espera la decisión del usuario).
5. consultar_config_org y listar_riesgos_folio: máximo UNA llamada por turno cada una; reutiliza el resultado.
6. actualizar_folio: solo si el usuario confirmó los valores. No inventes "alcance" ni "beneficio clínico"; pídelos explícitamente.
7. Antes de proponer un riesgo, calcula NPR = S × O × D y clasifícalo según los umbrales devueltos por consultar_config_org (Bajo < umbral_medio, Medio < umbral_alto, Alto ≥ umbral_alto). Si NPR ≥ umbral_medio, marca requiere_accion=true y propón acción, responsable y fecha_compromiso, además de S/O/D residuales esperados.
8. Distingue claramente: alcance = qué cubre el análisis (producto, área, proceso). etapa_proceso = fase del proceso productivo donde aparece el peligro (recepción, mezclado, envasado, etc.). NUNCA los confundas.
9. Clasificación regulatoria: revisa el contexto del folio. Si "clasificacion_riesgo_sanitario" = "Alto" o "clasificacion_tipo" = "Biológico/biotecnológico" (medicamentos), o "clase_dispositivo" = "Clase III" (DM), considera población vulnerable: cuando propongas un riesgo con S ≥ 9, aumenta severidad en +1 (tope 10) y deja explícito en justificación_aceptabilidad la mención de población vulnerable, exposición sistémica o consecuencia regulatoria (recall, farmacovigilancia, etc.).
10. Si la norma del folio es NOM-241, el campo de clasificación es "clase_dispositivo" (Clase I/II/III). Si es NOM-059, son tres campos: clasificacion_tipo, clasificacion_condicion_venta, clasificacion_riesgo_sanitario. NUNCA mezcles ambos esquemas; usa el correcto según norma_folio.
11. proponer_riesgo REQUIERE 'modo_falla' (cómo falla el proceso/producto, p.ej. "contaminación cruzada", "dosis incorrecta"). Si el usuario no lo dio, pregúntalo antes de llamar la herramienta.
12. Antes de proponer controles_prevencion o controles_deteccion nuevos, PREGUNTA al usuario qué controles_existentes ya tiene implementados y envíalos en ese campo. No dupliques en controles_prevencion lo que ya está en controles_existentes.
`;

async function getOrgContext(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, nombre, plan, norma_aplicable, metodologia, usar_detectabilidad, umbral_npr_alto, umbral_npr_medio, consultas_ia_extras)")
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
    let folio_id: string | null = body.folio_id ?? null;
    const agente_override: "dm" | "farma" | null = body.agente ?? null;
    let conversacion_id: string | null = body.conversacion_id ?? null;

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
    const extras = Math.max(0, Number(org.consultas_ia_extras ?? 0));
    const usage = await getCurrentUsage(adminClient, org.id);
    const limiteEfectivo = limit === -1 ? -1 : limit + extras;
    if (limit !== -1 && usage >= limiteEfectivo) {
      return new Response(JSON.stringify({
        error: "limite_alcanzado",
        message: `Has alcanzado el límite de ${limiteEfectivo} mensajes (${limit} del plan ${org.plan}${extras > 0 ? ` + ${extras} extras` : ""}).`,
        usage, limit, extras,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cargar system prompt
    const promptRow = await getActivePrompt(adminClient, agente);
    if (!promptRow) {
      return new Response(JSON.stringify({ error: "Agente no configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Conversación: crear o reanudar antes de construir contexto de folio ---
    let resumeNote = "";
    let isNewConversation = false;
    if (conversacion_id) {
      const { data: conv } = await adminClient
        .from("chat_conversaciones")
        .select("id, titulo, ultimo_mensaje_en, folio_id, agente")
        .eq("id", conversacion_id)
        .eq("org_id", org.id)
        .maybeSingle();
      if (!conv) conversacion_id = null;
      else {
        const fecha = new Date(conv.ultimo_mensaje_en).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
        resumeNote = `\n\n## CONTINUACIÓN DE CONVERSACIÓN\nRetomando nuestra conversación del ${fecha} sobre "${conv.titulo}". Mantén la coherencia con el historial previo.`;
        if (!folio_id && conv.folio_id) {
          const { data: convFolio } = await adminClient
            .from("folios")
            .select("id")
            .eq("id", conv.folio_id)
            .eq("org_id", org.id)
            .maybeSingle();
          if (convFolio) folio_id = conv.folio_id;
        }
      }
    }
    if (!conversacion_id) {
      const { data: created } = await adminClient
        .from("chat_conversaciones")
        .insert({ org_id: org.id, folio_id, agente, created_by: user.id })
        .select("id")
        .single();
      conversacion_id = created?.id ?? null;
      isNewConversation = true;
    }

    // Folio context
    let folioCtx = "";
    let activeFolioId: string | null = folio_id;
    let activeFolioCodigo: string | null = null;
    let activeFolioTitulo: string | null = null;
    if (folio_id) {
      const { data: folio } = await adminClient
        .from("folios")
        .select("codigo, proceso_equipo, estado, norma_folio, origen, alcance, beneficio_clinico, clase_dispositivo, clasificacion_categoria, clasificacion_tipo, clasificacion_condicion_venta, clasificacion_riesgo_sanitario")
        .eq("id", folio_id)
        .maybeSingle();
      const { data: riesgos } = await adminClient
        .from("riesgos")
        .select("numero_id, peligro, situacion_peligrosa, severidad, ocurrencia, deteccion, npr, dictamen")
        .eq("folio_id", folio_id)
        .order("numero_id");
      if (folio) {
        const f: any = folio;
        activeFolioCodigo = f.codigo;
        activeFolioTitulo = `[${f.codigo}] ${f.proceso_equipo ?? ""}`.trim();
        const isMed =
          f.norma_folio === "NOM-059" ||
          (f.norma_folio === "MULTI" && f.clasificacion_categoria === "medicamento");
        const clasifLine = isMed
          ? `Clasificación (medicamento): tipo=${f.clasificacion_tipo || "—"} | venta=${f.clasificacion_condicion_venta || "—"} | riesgo_sanitario=${f.clasificacion_riesgo_sanitario || "—"}`
          : `Clasificación (dispositivo médico): ${f.clase_dispositivo || "—"}`;
        folioCtx = `\n\n## CONTEXTO DEL FOLIO ACTIVO\nCódigo: ${f.codigo}\nProceso/Producto/Equipo/Sistema: ${f.proceso_equipo}\nOrigen del análisis: ${f.origen ?? "—"}\nEstado: ${f.estado}\nNorma: ${f.norma_folio}\nAlcance: ${f.alcance ?? "—"}\n${clasifLine}\nFolio_id: ${folio_id}\n\nRiesgos actuales (${(riesgos ?? []).length}):\n${(riesgos ?? []).map((r: any) => `#${r.numero_id} S:${r.severidad} O:${r.ocurrencia} D:${r.deteccion} NPR:${r.npr} ${r.dictamen} — ${r.peligro}`).join("\n")}`;
      }
    }

    const orgCtx = `\n\n## CONTEXTO DE LA ORGANIZACIÓN\nNombre: ${org.nombre}\nNorma aplicable: ${org.norma_aplicable}\nMetodología: ${org.metodologia}\nUsa detectabilidad: ${org.usar_detectabilidad}\nUmbral NPR Alto: ${org.umbral_npr_alto}\nUmbral NPR Medio: ${org.umbral_npr_medio}`;

    const systemPrompt = (promptRow as any).system_prompt + orgCtx + folioCtx + resumeNote + TOOL_RULES_ADDENDUM;

    // Persistir el último mensaje user + bump
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await adminClient.from("chat_mensajes").insert({
        conversacion_id,
        org_id: org.id, folio_id: activeFolioId, user_id: user.id,
        role: "user",
        contenido: typeof lastUser.content === "string" ? lastUser.content : JSON.stringify(lastUser.content),
        agente,
      });
      const nuevoUsage = await bumpUsage(adminClient, org.id);
      // Si el plan ya estaba agotado, consumir una consulta extra.
      if (limit !== -1 && nuevoUsage > limit && extras > 0) {
        await adminClient
          .from("organizations")
          .update({ consultas_ia_extras: Math.max(0, extras - 1) })
          .eq("id", org.id);
      }
    }

    // --- Loop agéntico server-side ---
    // Truncar historial a MAX_HISTORY para acotar costo en conversaciones largas
    const trimmedMessages = messages.length > MAX_HISTORY
      ? messages.slice(-MAX_HISTORY)
      : messages;
    const turnMessages: any[] = [...trimmedMessages];
    const allToolUses: any[] = [];
    let fullText = "";
    let tokensIn = 0, tokensOut = 0;
    let executedToolCalls = 0;
    let proposalEmitted = false;

    // --- Selección de modelo: Haiku para consultas, Sonnet para operaciones ---
    const userMsgText = typeof lastUser?.content === "string"
      ? lastUser.content
      : JSON.stringify(lastUser?.content ?? "");
    const userLower = userMsgText.toLowerCase();
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const lastAssistantText = typeof lastAssistant?.content === "string"
      ? lastAssistant.content
      : JSON.stringify(lastAssistant?.content ?? "");
    const forceSonnet =
      !!activeFolioId ||
      SONNET_TRIGGERS.some((t) => userLower.includes(t));
    const isConsultaMode =
      !forceSonnet && (
        HAIKU_TRIGGERS.some((t) => userLower.startsWith(t)) ||
        lastAssistantText.includes("MODO: CONSULTA")
      );
    const modelToUse = isConsultaMode ? CLAUDE_MODEL_HAIKU : CLAUDE_MODEL_SONNET;
    console.log(`[model] modelToUse=${modelToUse} | consulta=${isConsultaMode} | folio=${activeFolioId ? "y" : "n"} | msg=${userMsgText.slice(0, 50)}`);

    // --- Hint de conversación larga (1 sola vez por conversación) ---
    let emitHint = false;
    if (messages.length > MAX_HISTORY && conversacion_id) {
      const { data: prevHint } = await adminClient
        .from("chat_mensajes")
        .select("id")
        .eq("conversacion_id", conversacion_id)
        .eq("role", "assistant")
        .ilike("contenido", `%${HINT_SENTINEL}%`)
        .limit(1)
        .maybeSingle();
      emitHint = !prevHint;
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "conversacion", id: conversacion_id })}\n\n`));

        if (emitHint) {
          fullText += HINT_TEXT + HINT_SENTINEL + "\n\n";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: HINT_TEXT } })}\n\n`));
        }

        try {
          // Hasta 5 vueltas de seguridad (3 tools + finalización)
          for (let round = 0; round < 5; round++) {
            const limitReached = executedToolCalls >= MAX_TOOL_CALLS_PER_TURN;
            const sysForCall = limitReached
              ? systemPrompt + "\n\n[AVISO INTERNO] Se alcanzó el límite de 3 búsquedas en este turno. Procede con la información disponible y entrega la respuesta final al usuario."
              : systemPrompt;

            // --- Prompt caching ephemeral (5 min TTL) ---
            // 1) Cache del system prompt (siempre). Requiere ≥1024 tokens en Sonnet — se cumple.
            const systemForApi = [
              { type: "text", text: sysForCall, cache_control: { type: "ephemeral" } },
            ];
            // 2) Cache del historial cuando supera 10 mensajes: marcar último bloque
            //    del último mensaje del historial original (no los tool_results del loop).
            let messagesForApi: any[] = turnMessages;
            if (trimmedMessages.length > 10) {
              messagesForApi = turnMessages.map((m) => m);
              const lastHistoryIdx = trimmedMessages.length - 1;
              const target = messagesForApi[lastHistoryIdx];
              if (target) {
                let content: any[];
                if (typeof target.content === "string") {
                  content = [{ type: "text", text: target.content, cache_control: { type: "ephemeral" } }];
                } else if (Array.isArray(target.content) && target.content.length > 0) {
                  content = [...target.content];
                  const lastIdx = content.length - 1;
                  content[lastIdx] = { ...content[lastIdx], cache_control: { type: "ephemeral" } };
                } else {
                  content = target.content;
                }
                messagesForApi[lastHistoryIdx] = { ...target, content };
              }
            }

            const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: modelToUse,
                max_tokens: 4096,
                system: systemForApi,
                tools: limitReached ? [TOOLS.find((t) => t.name === "proponer_riesgo")] : TOOLS,
                messages: messagesForApi,
              }),
            });

            if (!anthRes.ok) {
              const errText = await anthRes.text();
              console.error("Anthropic error:", anthRes.status, errText);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: `\n\n_Error del modelo: ${errText.slice(0, 200)}_` } })}\n\n`));
              break;
            }

            const data = await anthRes.json();
            tokensIn += data.usage?.input_tokens ?? 0;
            tokensOut += data.usage?.output_tokens ?? 0;
            const cacheCreate = data.usage?.cache_creation_input_tokens ?? 0;
            const cacheRead = data.usage?.cache_read_input_tokens ?? 0;
            if (cacheCreate || cacheRead) {
              console.log(`[cache] create=${cacheCreate} read=${cacheRead} in=${data.usage?.input_tokens ?? 0} out=${data.usage?.output_tokens ?? 0} round=${round}`);
            }

            const blocks = data.content ?? [];
            const toolUseBlocks: any[] = [];
            const delayedProposalIds = new Set<string>();

            // Emitir bloques al cliente como SSE sintéticos
            for (const b of blocks) {
              if (b.type === "text") {
                fullText += b.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: b.text } })}\n\n`));
              } else if (b.type === "tool_use") {
                if (b.name === "proponer_riesgo" && activeFolioId) {
                  b.input = { ...(b.input ?? {}), folio_id: activeFolioId };
                }
                if (b.name === "proponer_riesgo" && !activeFolioId) {
                  delayedProposalIds.add(b.id);
                  toolUseBlocks.push(b);
                  continue;
                }
                toolUseBlocks.push(b);
                allToolUses.push(b);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_start", content_block: { type: "tool_use", id: b.id, name: b.name } })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input ?? {}) } })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_stop" })}\n\n`));
              }
            }

            if (data.stop_reason !== "tool_use" || toolUseBlocks.length === 0) break;

            // Construir tool_results
            turnMessages.push({ role: "assistant", content: blocks });
            const toolResults: any[] = [];
            let stopAfter = false;

            for (const tb of toolUseBlocks) {
              if (tb.name === "proponer_riesgo") {
                if (delayedProposalIds.has(tb.id)) {
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: tb.id,
                    content: "Aún no había folio activo al emitir esta propuesta. Primero fija el folio creado; después vuelve a llamar proponer_riesgo usando exactamente ese folio_id. No llames crear_folio otra vez.",
                  });
                  continue;
                }
                proposalEmitted = true;
                stopAfter = true;
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tb.id,
                  content: "Propuesta enviada al usuario para revisión en la UI. NO repitas la propuesta y espera la decisión del usuario.",
                });
              } else if (tb.name === "buscar_folio") {
                if (executedToolCalls >= MAX_TOOL_CALLS_PER_TURN) {
                  toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: "Límite de búsquedas alcanzado. Procede con la información disponible.", is_error: true });
                } else {
                  executedToolCalls++;
                  const r = await execBuscarFolio(adminClient, org.id, tb.input?.query ?? "");
                  toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(r) });
                }
              } else if (tb.name === "crear_folio") {
                if (executedToolCalls >= MAX_TOOL_CALLS_PER_TURN) {
                  toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: "Límite de búsquedas alcanzado. Procede con la información disponible.", is_error: true });
                } else if (activeFolioId) {
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: tb.id,
                    content: JSON.stringify({
                      ok: true,
                      reused: true,
                      folio_id: activeFolioId,
                      codigo: activeFolioCodigo,
                      message: `Ya existe un folio activo en esta conversación (${activeFolioCodigo}). No se creó un duplicado. Usa este folio para listar/proponer riesgos.`,
                    }),
                  });
                } else {
                  executedToolCalls++;
                  const r = await execCrearFolio(adminClient, org.id, user.id, tb.input ?? {});
                  if (r?.ok && r?.folio_id) {
                    activeFolioId = r.folio_id;
                    activeFolioCodigo = r.codigo ?? null;
                    activeFolioTitulo = `[${r.codigo}] ${r.proceso_equipo ?? ""}`.trim();
                    await adminClient
                      .from("chat_conversaciones")
                      .update({ folio_id: activeFolioId, titulo: activeFolioTitulo })
                      .eq("id", conversacion_id)
                      .eq("org_id", org.id);
                  }
                  toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(r) });
                }
              } else if (tb.name === "consultar_config_org") {
                executedToolCalls++;
                const r = await execConsultarConfigOrg(org);
                toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(r) });
              } else if (tb.name === "listar_riesgos_folio") {
                executedToolCalls++;
                const r = await execListarRiesgosFolio(adminClient, org.id, activeFolioId ?? tb.input?.folio_id ?? folio_id);
                toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(r) });
              } else if (tb.name === "actualizar_folio") {
                executedToolCalls++;
                const r = await execActualizarFolio(adminClient, org.id, tb.input ?? {});
                toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(r) });
              } else {
                toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: "Herramienta desconocida.", is_error: true });
              }
            }

            turnMessages.push({ role: "user", content: toolResults });
            if (stopAfter) break;
          }
        } catch (e) {
          console.error("agentic loop error", e);
        } finally {
          // Persistir respuesta del asistente
          try {
            await adminClient.from("chat_mensajes").insert({
              conversacion_id,
              org_id: org.id, folio_id: activeFolioId, user_id: user.id,
              role: "assistant",
              contenido: fullText,
              tokens_usados: tokensIn + tokensOut,
              agente,
              documentos_adjuntos: allToolUses.length ? { tool_uses: allToolUses } : null,
            });

            if (isNewConversation && conversacion_id) {
              let titulo = activeFolioTitulo ?? "";
              if (!titulo && folio_id) {
                const { data: f } = await adminClient
                  .from("folios").select("codigo, proceso_equipo")
                  .eq("id", folio_id).maybeSingle();
                if (f) titulo = `[${f.codigo}] ${f.proceso_equipo ?? ""}`.trim();
              }
              if (!titulo) {
                const firstUserText = typeof lastUser?.content === "string"
                  ? lastUser.content
                  : JSON.stringify(lastUser?.content ?? "");
                titulo = (firstUserText || "Conversación").slice(0, 50);
              }
              await adminClient
                .from("chat_conversaciones")
                .update({ titulo })
                .eq("id", conversacion_id);
            }
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