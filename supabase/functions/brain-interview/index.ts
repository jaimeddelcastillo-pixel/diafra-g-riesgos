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
const MAX_TOOL_CALLS_PER_TURN = 12; // safeguard anti-loop (no es diseño metodológico)
const SESSION_TRANSCRIPT_WINDOW = 5;

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
// ─────────────────── registrar_brecha ───────────────────
const TIPOS_BRECHA = [
  "pendiente_entrevista",
  "pendiente_otro_rol",
  "por_validar",
  "brecha_institucional",
];

TOOLS.push({
  name: "registrar_brecha",
  description:
    "Registra en brain_gaps conocimiento que falta. Llamar ÚNICAMENTE cuando la brecha es real y clasificable en uno de los cuatro tipos — nunca por el simple hecho de no haber llegado todavía a esa pregunta si la vas a formular en este mismo turno. Estado inicial siempre 'abierta'. Máximo 1 llamada por turno, con todas las brechas del turno en el arreglo.\n\nTIPOS:\n- pendiente_entrevista: el dominio no se ha explorado en esta sesión, el entrevistado probablemente lo sabe y se abordará más adelante en la misma sesión.\n- pendiente_otro_rol: el entrevistado confirmó que no es su área. SIEMPRE debe acompañarse de sugerir_entrevistado; indica rol_sugerido.\n- por_validar: hay conocimiento capturado pero sin confirmar; requiere contraste documental o segunda fuente.\n- brecha_institucional: SOLO cuando hay evidencia de ausencia real (no existe el proceso, documento o control). Nunca por omisión de pregunta. Idealmente confirmada por más de una fuente.",
  input_schema: {
    type: "object",
    properties: {
      brechas: {
        type: "array",
        description: "Brechas detectadas en este turno (1 a 5).",
        items: {
          type: "object",
          properties: {
            tipo_brecha: { type: "string", enum: TIPOS_BRECHA },
            descripcion: {
              type: "string",
              description: "Qué conocimiento falta, redactado de forma autocontenida (mínimo 15 caracteres).",
            },
            por_que_importa: { type: "string", description: "Impacto institucional o regulatorio de la brecha." },
            evidencia: {
              type: "string",
              description:
                "Obligatorio para brecha_institucional: evidencia de ausencia real (citas o fuentes que confirman que no existe).",
            },
            tipo_conocimiento: { type: "string", enum: TIPOS_CONOCIMIENTO },
            rol_sugerido: {
              type: "string",
              description: "Rol o puesto que podría cubrir la brecha. Obligatorio para pendiente_otro_rol.",
            },
            prioridad: { type: "string", enum: ["alta", "media", "baja"] },
            proceso_id: { type: "string", description: "UUID del proceso relacionado, si aplica." },
            area_id: { type: "string", description: "UUID del área relacionada, si aplica." },
          },
          required: ["tipo_brecha", "descripcion"],
        },
      },
    },
    required: ["brechas"],
  },
});

function normalizarTexto(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function execRegistrarBrecha(
  admin: any,
  orgId: string,
  sessionId: string | null,
  input: any,
) {
  const raw: any[] = Array.isArray(input?.brechas) ? input.brechas : [];
  if (!raw.length) return { ok: false, error: "No se recibieron brechas para registrar." };
  if (raw.length > 5) raw.length = 5;

  const [{ data: procs }, { data: areas }, { data: abiertas }] = await Promise.all([
    admin.from("brain_processes").select("id").eq("org_id", orgId),
    admin.from("brain_areas").select("id").eq("org_id", orgId),
    admin.from("brain_gaps").select("id, descripcion").eq("org_id", orgId).in("estado", ["abierta", "asignada"]),
  ]);
  const procIds = new Set((procs ?? []).map((p: any) => p.id));
  const areaIds = new Set((areas ?? []).map((a: any) => a.id));
  const existentes = new Map<string, string>(
    (abiertas ?? []).map((g: any) => [normalizarTexto(String(g.descripcion ?? "")), g.id]),
  );

  const registradas: any[] = [];
  const rechazadas: any[] = [];

  for (const b of raw) {
    const tipoBrecha = String(b?.tipo_brecha ?? "");
    const descripcion = String(b?.descripcion ?? "").trim();

    if (!TIPOS_BRECHA.includes(tipoBrecha)) {
      rechazadas.push({ descripcion: descripcion.slice(0, 80), motivo: `tipo_brecha inválido: ${tipoBrecha}` });
      continue;
    }
    if (descripcion.length < 15) {
      rechazadas.push({ descripcion, motivo: "descripción demasiado breve — precisa qué conocimiento falta" });
      continue;
    }
    // Reglas por tipo (corrección 2 del prompt maestro v2.1)
    if (tipoBrecha === "pendiente_otro_rol" && !String(b?.rol_sugerido ?? "").trim()) {
      rechazadas.push({
        descripcion: descripcion.slice(0, 80),
        motivo: "pendiente_otro_rol requiere rol_sugerido y debe acompañarse de sugerir_entrevistado",
      });
      continue;
    }
    if (tipoBrecha === "brecha_institucional" && String(b?.evidencia ?? "").trim().length < 15) {
      rechazadas.push({
        descripcion: descripcion.slice(0, 80),
        motivo:
          "brecha_institucional requiere evidencia de ausencia real. Si solo no se ha preguntado, usa pendiente_entrevista.",
      });
      continue;
    }

    const clave = normalizarTexto(descripcion);
    if (existentes.has(clave)) {
      rechazadas.push({ descripcion: descripcion.slice(0, 80), motivo: "duplicada — ya existe una brecha abierta equivalente", id: existentes.get(clave) });
      continue;
    }

    const prioridad = ["alta", "media", "baja"].includes(b?.prioridad)
      ? b.prioridad
      : tipoBrecha === "brecha_institucional"
        ? "alta"
        : "media";
    const procesoId = UUID_RE.test(b?.proceso_id ?? "") && procIds.has(b.proceso_id) ? b.proceso_id : null;
    const areaId = UUID_RE.test(b?.area_id ?? "") && areaIds.has(b.area_id) ? b.area_id : null;
    const tipoConocimiento = TIPOS_CONOCIMIENTO.includes(String(b?.tipo_conocimiento ?? ""))
      ? b.tipo_conocimiento
      : null;

    const detalle = [
      b?.por_que_importa ? String(b.por_que_importa).trim() : "",
      b?.evidencia ? `Evidencia de ausencia: ${String(b.evidencia).trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: row, error } = await admin
      .from("brain_gaps")
      .insert({
        org_id: orgId,
        tipo_brecha: tipoBrecha,
        descripcion,
        por_que_importa: detalle || null,
        tipo_conocimiento: tipoConocimiento,
        rol_sugerido: b?.rol_sugerido ? String(b.rol_sugerido).trim().slice(0, 120) : null,
        prioridad,
        estado: "abierta",
        proceso_id: procesoId,
        area_id: areaId,
        session_id: sessionId,
      })
      .select("id, tipo_brecha, prioridad, estado")
      .single();

    if (error || !row) {
      rechazadas.push({ descripcion: descripcion.slice(0, 80), motivo: error?.message ?? "error al insertar" });
      continue;
    }
    existentes.set(clave, row.id);
    registradas.push(row);
  }

  return {
    ok: registradas.length > 0,
    registradas_count: registradas.length,
    registradas,
    rechazadas,
    nota:
      "Estado inicial siempre 'abierta'. Las brechas pendiente_otro_rol deben acompañarse de sugerir_entrevistado. El cierre de brechas es acción humana desde /cerebro/brechas.",
  };
}

// ─────────────────── registrar_contradiccion ───────────────────
TOOLS.push({
  name: "registrar_contradiccion",
  description:
    "Registra en brain_contradictions una contradicción detectada entre dos versiones del mismo conocimiento (entre personas, entre persona y documento, o entre documentos). Registra AMBAS versiones sin juzgar cuál es correcta, continúa la entrevista sin resolverla y nunca la marques como resuelta: la resolución es exclusivamente humana desde /cerebro/contradicciones. Si la contradicción implica una posible brecha regulatoria, llama además a registrar_brecha con tipo_brecha 'brecha_institucional'. Máximo 1 llamada por turno con todas las contradicciones del turno.",
  input_schema: {
    type: "object",
    properties: {
      contradicciones: {
        type: "array",
        description: "Contradicciones detectadas en este turno (1 a 3).",
        items: {
          type: "object",
          properties: {
            tema: { type: "string", description: "Qué se está contradiciendo (enunciado corto y específico)." },
            version_a: { type: "string", description: "Primera versión del conocimiento, textual y autocontenida." },
            fuente_a: { type: "string", description: "Quién o qué respalda la versión A (persona, puesto, documento, registro)." },
            version_b: { type: "string", description: "Segunda versión, contradictoria con la A." },
            fuente_b: { type: "string", description: "Quién o qué respalda la versión B." },
            riesgo_potencial: { type: "string", description: "Qué implica la contradicción (operativo, regulatorio, de calidad)." },
            autoridad_requerida: { type: "string", description: "Rol o puesto que puede resolverla." },
            afecta_cumplimiento: { type: "boolean", description: "true si tiene impacto regulatorio." },
            document_id: { type: "string", description: "UUID del documento relacionado, si aplica." },
            proceso_id: { type: "string", description: "UUID del proceso relacionado, si aplica." },
            area_id: { type: "string", description: "UUID del área relacionada, si aplica." },
          },
          required: ["tema", "version_a", "fuente_a", "version_b", "fuente_b"],
        },
      },
    },
    required: ["contradicciones"],
  },
});

async function execRegistrarContradiccion(
  admin: any,
  orgId: string,
  sessionId: string | null,
  input: any,
) {
  const raw: any[] = Array.isArray(input?.contradicciones) ? input.contradicciones : [];
  if (!raw.length) return { ok: false, error: "No se recibieron contradicciones para registrar." };
  if (raw.length > 3) raw.length = 3;

  const [{ data: procs }, { data: areas }, { data: docs }, { data: abiertas }] = await Promise.all([
    admin.from("brain_processes").select("id").eq("org_id", orgId),
    admin.from("brain_areas").select("id").eq("org_id", orgId),
    admin.from("brain_documents").select("id").eq("org_id", orgId),
    admin
      .from("brain_contradictions")
      .select("id, tema, afirmacion_a, afirmacion_b")
      .eq("org_id", orgId)
      .in("estado", ["abierta", "en_analisis"]),
  ]);
  const procIds = new Set((procs ?? []).map((p: any) => p.id));
  const areaIds = new Set((areas ?? []).map((a: any) => a.id));
  const docIds = new Set((docs ?? []).map((d: any) => d.id));
  const temasAbiertos = new Map<string, string>(
    (abiertas ?? []).map((c: any) => [normalizarTexto(String(c.tema ?? c.afirmacion_a ?? "")), c.id]),
  );

  const registradas: any[] = [];
  const rechazadas: any[] = [];

  for (const c of raw) {
    const tema = String(c?.tema ?? "").trim();
    const versionA = String(c?.version_a ?? "").trim();
    const versionB = String(c?.version_b ?? "").trim();
    const fuenteA = String(c?.fuente_a ?? "").trim();
    const fuenteB = String(c?.fuente_b ?? "").trim();

    if (tema.length < 5) {
      rechazadas.push({ tema, motivo: "tema obligatorio: describe qué se está contradiciendo" });
      continue;
    }
    if (versionA.length < 10 || versionB.length < 10) {
      rechazadas.push({ tema, motivo: "version_a y version_b son obligatorias y deben ser enunciados completos" });
      continue;
    }
    if (normalizarTexto(versionA) === normalizarTexto(versionB)) {
      rechazadas.push({ tema, motivo: "version_a y version_b son idénticas — no hay contradicción" });
      continue;
    }
    if (!fuenteA || !fuenteB) {
      rechazadas.push({ tema, motivo: "fuente_a y fuente_b son obligatorias — identifica quién o qué respalda cada versión" });
      continue;
    }

    const clave = normalizarTexto(tema);
    if (temasAbiertos.has(clave)) {
      rechazadas.push({ tema, motivo: "duplicada — ya existe una contradicción abierta sobre el mismo tema", id: temasAbiertos.get(clave) });
      continue;
    }

    const procesoId = UUID_RE.test(c?.proceso_id ?? "") && procIds.has(c.proceso_id) ? c.proceso_id : null;
    const areaId = UUID_RE.test(c?.area_id ?? "") && areaIds.has(c.area_id) ? c.area_id : null;
    const documentId = UUID_RE.test(c?.document_id ?? "") && docIds.has(c.document_id) ? c.document_id : null;

    const { data: row, error } = await admin
      .from("brain_contradictions")
      .insert({
        org_id: orgId,
        tema,
        afirmacion_a: versionA,
        afirmacion_b: versionB,
        fuente_a: fuenteA,
        fuente_b: fuenteB,
        riesgo_potencial: c?.riesgo_potencial ? String(c.riesgo_potencial).trim() : null,
        autoridad_requerida: c?.autoridad_requerida ? String(c.autoridad_requerida).trim().slice(0, 160) : null,
        afecta_cumplimiento: c?.afecta_cumplimiento === true,
        document_id: documentId,
        proceso_id: procesoId,
        area_id: areaId,
        session_id: sessionId,
        estado: "abierta",
      })
      .select("id, tema, estado, afecta_cumplimiento")
      .single();

    if (error || !row) {
      rechazadas.push({ tema, motivo: error?.message ?? "error al insertar" });
      continue;
    }
    temasAbiertos.set(clave, row.id);
    registradas.push(row);
  }

  return {
    ok: registradas.length > 0,
    registradas_count: registradas.length,
    registradas,
    rechazadas,
    nota:
      "Estado inicial siempre 'abierta'. No resuelvas la contradicción ni elijas versión correcta: continúa la entrevista. Si implica una posible brecha regulatoria, registra también una brecha_institucional. La resolución es humana desde /cerebro/contradicciones.",
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
      .select("id, descripcion, tipo_brecha, tipo_conocimiento, prioridad, estado, rol_sugerido, proceso_id, area_id")
      .eq("org_id", orgId)
      .in("estado", ["abierta", "asignada"])
      .order("prioridad"),
    admin
      .from("brain_contradictions")
      .select("id, tema, afirmacion_a, afirmacion_b, fuente_a, fuente_b, estado, afecta_cumplimiento, riesgo_potencial, autoridad_requerida")
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

// ─────────────────── get_next_interview_objective ───────────────────
// Secuencia metodológica de bloques del Cerebro Institucional.
const SECUENCIA_OBJETIVOS: { tipo: string; objetivo: string }[] = [
  { tipo: "identidad_organizacional", objetivo: "Identidad organizacional: qué hace la empresa, para quién y bajo qué marco regulatorio." },
  { tipo: "producto_proceso", objetivo: "Productos y procesos: qué se produce y cómo fluye el proceso de principio a fin." },
  { tipo: "rol_responsabilidad", objetivo: "Roles y responsabilidades: quién decide, quién ejecuta y quién libera." },
  { tipo: "requisito_regulatorio", objetivo: "Requisitos regulatorios aplicables y cómo se demuestran." },
  { tipo: "arquitectura_sgc", objetivo: "Arquitectura del SGC: estructura documental y sistemas de calidad vigentes." },
  { tipo: "criterio_documental", objetivo: "Criterios documentales: cómo se crea, revisa, aprueba y controla un documento." },
  { tipo: "conocimiento_operativo", objetivo: "Conocimiento operativo: cómo se hace realmente el trabajo, incluyendo excepciones." },
  { tipo: "riesgo_control", objetivo: "Riesgos y controles: qué puede fallar y cómo se controla." },
  { tipo: "validacion_calificacion", objetivo: "Validación y calificación: qué está validado, con qué criterios y evidencia." },
  { tipo: "desviacion_capa", objetivo: "Desviaciones y CAPA: cómo se detectan, investigan y cierran." },
  { tipo: "auditoria_aprendizaje", objetivo: "Auditorías y aprendizaje: hallazgos previos y qué cambió a partir de ellos." },
  { tipo: "regla_pno", objetivo: "Reglas y PNO: reglas duras no escritas y su relación con los procedimientos." },
];

TOOLS.push({
  name: "get_next_interview_objective",
  description:
    "Calcula, desde la base de datos (no desde el historial del chat), cuál debe ser el siguiente objetivo de la entrevista: prioriza contradicciones abiertas que este entrevistado puede aclarar, brechas abiertas de su dominio y, si no hay nada pendiente, el siguiente bloque no cubierto de la secuencia metodológica. Llamar una vez por turno antes de formular la pregunta. Si envías objetivo_propuesto, la herramienta lo registra como objetivo_actual de la sesión cuando es coherente.",
  input_schema: {
    type: "object",
    properties: {
      objetivo_propuesto: {
        type: "string",
        description: "Objetivo que propones para el siguiente tramo de la entrevista (opcional).",
      },
      motivo: { type: "string", description: "Por qué propones ese objetivo (opcional)." },
    },
    required: [],
  },
});

async function execGetNextInterviewObjective(
  admin: any,
  orgId: string,
  sessionId: string | null,
  input: any,
) {
  const ctx = await execObtenerContextoCerebro(admin, orgId, sessionId, false);

  // Dominios del entrevistado (si la sesión tiene assignment)
  let dominios: string[] = [];
  let entrevistado = ctx.sesion?.entrevistado_nombre ?? null;
  if (ctx.sesion?.assignment_id) {
    const { data: asg } = await admin
      .from("brain_interview_assignments")
      .select("nombre_externo, puesto, dominios_conocimiento")
      .eq("id", ctx.sesion.assignment_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (asg) {
      dominios = asg.dominios_conocimiento ?? [];
      entrevistado = `${asg.nombre_externo ?? entrevistado ?? "—"} — ${asg.puesto ?? "—"}`;
    }
  }
  const enDominio = (t?: string | null) => !dominios.length || !t || dominios.includes(t);

  const porTipo: Record<string, number> = (ctx.resumen.por_tipo ?? {}) as any;
  const cubiertos = SECUENCIA_OBJETIVOS.filter((b) => (porTipo[b.tipo] ?? 0) > 0).map((b) => b.tipo);
  const pendientes = SECUENCIA_OBJETIVOS.filter((b) => (porTipo[b.tipo] ?? 0) === 0);

  const contradicciones = (ctx.contradicciones ?? []).filter((c: any) => c.afecta_cumplimiento === true);
  const gapsDominio = (ctx.brechas ?? [])
    .filter((g: any) => g.estado === "abierta" && enDominio(g.tipo_conocimiento))
    .filter((g: any) => g.tipo_brecha !== "pendiente_otro_rol")
    .sort((a: any, b: any) => {
      const p: Record<string, number> = { alta: 0, media: 1, baja: 2 };
      return (p[a.prioridad] ?? 3) - (p[b.prioridad] ?? 3);
    });

  let objetivo: string;
  let razon: string;
  let origen: string;

  if (contradicciones.length) {
    const c = contradicciones[0];
    origen = "contradiccion_abierta";
    objetivo = `Aclarar la contradicción sobre "${c.tema ?? c.afirmacion_a}" sin anticipar cuál versión es correcta.`;
    razon = "Existe una contradicción abierta con impacto en cumplimiento. Recoge evidencia adicional, no la resuelvas.";
  } else if (gapsDominio.length) {
    const g = gapsDominio[0];
    origen = "brecha_abierta";
    objetivo = `Cerrar la brecha: ${g.descripcion}`;
    razon = `Brecha abierta de prioridad ${g.prioridad} (${g.tipo_brecha}) dentro del dominio del entrevistado.`;
  } else if (pendientes.length) {
    const b = pendientes.find((x) => enDominio(x.tipo)) ?? pendientes[0];
    origen = "secuencia_metodologica";
    objetivo = b.objetivo;
    razon = `El bloque '${b.tipo}' aún no tiene conocimiento capturado en la organización.`;
  } else {
    const menos = SECUENCIA_OBJETIVOS.filter((b) => enDominio(b.tipo)).sort(
      (a, b) => (porTipo[a.tipo] ?? 0) - (porTipo[b.tipo] ?? 0),
    )[0] ?? SECUENCIA_OBJETIVOS[0];
    origen = "profundizacion";
    objetivo = `Profundizar en: ${menos.objetivo}`;
    razon = `Todos los bloques tienen algo capturado; '${menos.tipo}' es el de menor cobertura.`;
  }

  // El objetivo propuesto por el modelo se respeta si es específico
  const propuesto = String(input?.objetivo_propuesto ?? "").trim();
  const objetivoFinal = propuesto.length >= 15 ? propuesto : objetivo;

  if (sessionId) {
    await admin
      .from("brain_interview_sessions")
      .update({ objetivo_actual: objetivoFinal.slice(0, 500) })
      .eq("id", sessionId)
      .eq("org_id", orgId);
  }

  return {
    ok: true,
    objetivo: objetivoFinal,
    objetivo_calculado: objetivo,
    origen,
    razon,
    entrevistado,
    dominios_entrevistado: dominios,
    bloques_cubiertos: cubiertos,
    bloques_pendientes: pendientes.map((b) => b.tipo),
    brechas_prioritarias: gapsDominio.slice(0, 5).map((g: any) => ({ id: g.id, tipo_brecha: g.tipo_brecha, prioridad: g.prioridad, descripcion: g.descripcion })),
    contradicciones_criticas: contradicciones.slice(0, 3).map((c: any) => ({ id: c.id, tema: c.tema })),
    nota: "Formula UNA sola pregunta alineada a este objetivo. El objetivo quedó registrado en la sesión.",
  };
}

// ─────────────────── sugerir_entrevistado ───────────────────
TOOLS.push({
  name: "sugerir_entrevistado",
  description:
    "Sugiere entrevistar a otro rol cuando existe un gap de tipo 'pendiente_otro_rol' confirmado: el entrevistado actual no posee ese conocimiento y otro rol sí. Crea una sugerencia de asignación (no un compromiso): el administrador la aprueba o descarta desde /cerebro/entrevistas. Máximo 3 llamadas por sesión. No llamar si ya existe una asignación pendiente para ese dominio. Después de llamarla, continúa la entrevista sin esperar aprobación.",
  input_schema: {
    type: "object",
    properties: {
      dominio_conocimiento: { type: "string", description: "Dominio de conocimiento faltante (ej. 'validacion_calificacion', 'mantenimiento de equipos')." },
      proceso_id: { type: "string", description: "UUID del proceso asociado (opcional)." },
      area_id: { type: "string", description: "UUID del área asociada (opcional)." },
      razon: { type: "string", description: "Por qué se necesita a este entrevistado." },
      urgencia: { type: "string", enum: ["alta", "media", "baja"], description: "Prioridad de la sugerencia." },
      rol_sugerido: { type: "string", description: "Puesto o rol sugerido a entrevistar (opcional)." },
    },
    required: ["dominio_conocimiento", "razon"],
  },
});

const MAX_SUGERENCIAS_POR_SESION = 3;
const MAX_ASIGNACIONES_AUTO_PENDIENTES = 10;
const sugerenciasPorSesion = new Map<string, number>();

async function execSugerirEntrevistado(
  admin: any,
  orgId: string,
  sessionId: string | null,
  input: any,
) {
  const dominio = String(input?.dominio_conocimiento ?? "").trim();
  const razon = String(input?.razon ?? "").trim();
  const rolSugerido = String(input?.rol_sugerido ?? "").trim() || null;
  const urgencia = ["alta", "media", "baja"].includes(input?.urgencia) ? input.urgencia : "media";
  const procesoId = String(input?.proceso_id ?? "").trim() || null;
  const areaId = String(input?.area_id ?? "").trim() || null;

  if (!dominio) return { ok: false, error: "dominio_conocimiento no puede estar vacío." };
  if (!razon) return { ok: false, error: "razon no puede estar vacía." };

  const claveSesion = sessionId ?? "sin-sesion";
  let usadas = sugerenciasPorSesion.get(claveSesion) ?? 0;
  // Fallback persistente (el isolate puede reciclarse): contar sugerencias automáticas creadas desde el inicio de la sesión
  if (sessionId) {
    const { data: ses } = await admin
      .from("brain_interview_sessions")
      .select("iniciada_en, created_at")
      .eq("id", sessionId)
      .eq("org_id", orgId)
      .maybeSingle();
    const desde = (ses as any)?.iniciada_en ?? (ses as any)?.created_at;
    if (desde) {
      const { count } = await admin
        .from("brain_interview_assignments")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("asignado_automaticamente", true)
        .gte("created_at", desde);
      usadas = Math.max(usadas, count ?? 0);
    }
  }
  if (usadas >= MAX_SUGERENCIAS_POR_SESION) {
    return { ok: false, error: `Ya sugeriste ${MAX_SUGERENCIAS_POR_SESION} entrevistados en esta sesión. Continúa la entrevista con el conocimiento que sí posee el entrevistado actual.` };
  }

  // Validar referencias de la organización
  if (procesoId) {
    const { data } = await admin.from("brain_processes").select("id, nombre").eq("id", procesoId).eq("org_id", orgId).maybeSingle();
    if (!data) return { ok: false, error: "proceso_id no existe en esta organización." };
    input.__proceso_nombre = data.nombre;
  }
  if (areaId) {
    const { data } = await admin.from("brain_areas").select("id, nombre").eq("id", areaId).eq("org_id", orgId).maybeSingle();
    if (!data) return { ok: false, error: "area_id no existe en esta organización." };
    input.__area_nombre = data.nombre;
  }

  // PASO 2 — duplicados
  const { data: activas } = await admin
    .from("brain_interview_assignments")
    .select("id, puesto, dominios_conocimiento, estado, prioridad, razon_asignacion, asignado_automaticamente")
    .eq("org_id", orgId)
    .in("estado", ["pendiente", "en_proceso"]);

  const norm = (s: string) => s.toLowerCase().trim();
  const existente = (activas ?? []).find((a: any) =>
    (a.dominios_conocimiento ?? []).some((d: string) => norm(d) === norm(dominio)),
  );
  if (existente) {
    return {
      ok: true,
      duplicado: true,
      assignment_id: existente.id,
      mensaje: "Ya existe una asignación pendiente para este dominio",
      accion_requerida: "aprobacion_admin",
      nota: "No se creó una nueva sugerencia. Continúa la entrevista.",
    };
  }

  // Límite de asignaciones automáticas pendientes
  const autoPendientes = (activas ?? []).filter((a: any) => a.asignado_automaticamente && a.estado === "pendiente").length;
  if (autoPendientes >= MAX_ASIGNACIONES_AUTO_PENDIENTES) {
    return {
      ok: false,
      error: "Hay muchas asignaciones pendientes de aprobar. El administrador debe revisar /cerebro/entrevistas antes de generar nuevas sugerencias",
    };
  }

  // PASO 3 — crear
  const { data: nueva, error } = await admin
    .from("brain_interview_assignments")
    .insert({
      org_id: orgId,
      puesto: rolSugerido,
      area_id: areaId,
      dominios_conocimiento: [dominio],
      estado: "pendiente",
      prioridad: urgencia,
      razon_asignacion: razon.slice(0, 1000),
      asignado_automaticamente: true,
    })
    .select("id")
    .single();

  if (error || !nueva) {
    console.error("sugerir_entrevistado insert error", error);
    return { ok: false, error: "No se pudo crear la sugerencia de entrevista." };
  }

  if (procesoId) {
    const { error: pErr } = await admin
      .from("brain_assignment_processes")
      .insert({ org_id: orgId, assignment_id: nueva.id, process_id: procesoId });
    if (pErr) console.error("sugerir_entrevistado proceso link error", pErr);
  }

  sugerenciasPorSesion.set(claveSesion, usadas + 1);

  const destino = input.__proceso_nombre ?? input.__area_nombre ?? "la organización";
  return {
    ok: true,
    assignment_id: nueva.id,
    mensaje: `Se sugirió entrevistar a ${rolSugerido ?? dominio} para cubrir el gap en ${destino}. El administrador puede aprobar o descartar esta sugerencia desde /cerebro/entrevistas`,
    accion_requerida: "aprobacion_admin",
    sugerencias_restantes: MAX_SUGERENCIAS_POR_SESION - (usadas + 1),
    nota: "Esta es una sugerencia, no un compromiso. Continúa la entrevista sin esperar aprobación.",
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
${gapsFiltrados.slice(0, 20).map((g: any) => `- [${g.prioridad}/${g.tipo_brecha}] ${g.descripcion} (id: ${g.id})`).join("\n") || "- (sin brechas registradas)"}
[CONTRADICCIONES ABIERTAS]: ${ctx.resumen.contradicciones_abiertas}
${ctx.contradicciones.slice(0, 15).map((c: any) => `- [${c.tema ?? "sin tema"}] A: ${c.afirmacion_a} (${c.fuente_a ?? "—"}) | B: ${c.afirmacion_b} (${c.fuente_b ?? "—"}) (id: ${c.id})`).join("\n") || "- (sin contradicciones abiertas)"}
[PROCESOS ASIGNADOS]: ${procesosAsignados.join(" | ") || "ninguno"}
[AREAS REGISTRADAS]: ${ctx.areas.map((a: any) => `${a.nombre} (${a.id})`).join(" | ") || "ninguna"}
[SESSION_ID]: ${sessionId ?? "—"}
[ORG_ID]: ${orgId}
`;
  return { bloque, ctx };
}

// ─────────────────── Idempotencia por operación ───────────────────
function canonical(v: any): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type TurnMetrics = {
  knowledge_created: number;
  gaps_created: number;
  contradictions_created: number;
  interviewees_suggested: number;
  persisted: boolean;
};

async function stampTurn(admin: any, table: string, ids: string[], orgId: string, turnId: string) {
  if (!ids.length) return;
  try {
    await admin.from(table).update({ turn_id: turnId }).in("id", ids).eq("org_id", orgId);
  } catch (e) { console.error("stampTurn", table, e); }
}

// ──────────────────────────────── Handler ───────────────────────────────
const ACCIONES = ["iniciar", "mensaje", "pausar", "reanudar", "cerrar"];
const RAZONES_CIERRE = ["user_closed", "objectives_complete", "admin_closed"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── 1. JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 2. org_id resuelto server-side (nunca del frontend ni del modelo)
    const { data: member } = await admin
      .from("org_members")
      .select("org_id, role, organizations(id, nombre, norma_aplicable, plan)")
      .eq("user_id", user.id)
      .maybeSingle();
    const org: any = (member as any)?.organizations;
    if (!org) return json({ error: "Usuario sin organización" }, 403);
    const orgId: string = org.id;

    // ── 3. Feature institutional_brain + restricciones de plan
    const { data: superRole } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    const esSuperAdmin = !!superRole;
    const plan = String(org.plan ?? "").toLowerCase();
    const planIncluye = ["professional", "enterprise"].includes(plan);
    const { data: feat } = await admin
      .from("organization_features")
      .select("activo, expira_en")
      .eq("org_id", orgId)
      .eq("feature_key", "institutional_brain")
      .maybeSingle();
    const featActiva = !!feat?.activo && (!feat.expira_en || new Date(feat.expira_en) > new Date());
    if (!esSuperAdmin && !planIncluye && !featActiva) {
      return json({ error: "El módulo Cerebro Institucional no está activo para esta organización" }, 403);
    }
    const esTrial = plan.startsWith("trial");

    // ── 4. GET /brain-interview/turn/{turn_id}
    const url = new URL(req.url);
    const partes = url.pathname.split("/").filter(Boolean);
    if (req.method === "GET" && partes.length >= 2 && partes[partes.length - 2] === "turn") {
      const turnId = partes[partes.length - 1];
      const { data: turno } = await admin
        .from("brain_interview_turns")
        .select("id, session_id, estado, operations, knowledge_created, gaps_created, contradictions_created, interviewees_suggested, current_objective, error, created_at, completed_at")
        .eq("id", turnId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (!turno) return json({ error: "Turno no encontrado" }, 404);
      const { data: ses } = await admin
        .from("brain_interview_sessions").select("estado").eq("id", turno.session_id).eq("org_id", orgId).maybeSingle();
      const { data: msgs } = await admin
        .from("brain_interview_messages")
        .select("role, content, created_at")
        .eq("turn_id", turnId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });
      return json({ ...turno, session_status: ses?.estado ?? null, messages: msgs ?? [] });
    }

    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

    const body = await req.json().catch(() => ({}));
    const action: string = ACCIONES.includes(body?.action) ? body.action : "mensaje";
    const turnId: string | null = typeof body?.turn_id === "string" && UUID_RE.test(body.turn_id) ? body.turn_id : null;
    const content: string = String(body?.content ?? "").trim();

    // ── 5. sesión pertenece a la org resuelta
    const sessionId: string | null = typeof body?.session_id === "string" ? body.session_id : null;
    if (!sessionId) return json({ error: "session_id requerido" }, 400);
    const { data: sesion } = await admin
      .from("brain_interview_sessions")
      .select("id, estado, iniciada_en, metadata")
      .eq("id", sessionId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!sesion) return json({ error: "Sesión no encontrada para esta organización" }, 403);

    // Trial: una sola sesión de entrevista por organización
    if (esTrial && !esSuperAdmin && action === "iniciar") {
      const { count } = await admin
        .from("brain_interview_sessions")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .neq("id", sessionId);
      if ((count ?? 0) >= 1) {
        return json({ error: "El plan de prueba permite una sola sesión de entrevista" }, 403);
      }
    }

    const encoder = new TextEncoder();
    const sse = (controller: ReadableStreamDefaultController, event: string, data: unknown) =>
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    const streamResponse = (fn: (c: ReadableStreamDefaultController) => Promise<void>) =>
      new Response(
        new ReadableStream({
          async start(controller) {
            try { await fn(controller); } finally { controller.close(); }
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } },
      );

    // ── Acción pausar (no requiere turno del modelo)
    if (action === "pausar") {
      await admin.from("brain_interview_sessions").update({ estado: "pausada" }).eq("id", sessionId).eq("org_id", orgId);
      return streamResponse(async (c) => {
        sse(c, "turn_complete", {
          session_id: sessionId,
          turn_id: turnId,
          knowledge_created: 0,
          gaps_created: 0,
          contradictions_created: 0,
          interviewees_suggested: 0,
          current_objective: null,
          session_status: "pausada",
        });
      });
    }

    if (!turnId) return json({ error: "turn_id requerido (UUID generado por el frontend)" }, 400);

    // ── 6. Idempotencia de turno
    const { data: turnoPrev } = await admin
      .from("brain_interview_turns")
      .select("id, estado, knowledge_created, gaps_created, contradictions_created, interviewees_suggested, current_objective")
      .eq("id", turnId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (turnoPrev?.estado === "procesando") {
      return json({ error: "Turno en proceso", code: "conflict", turn_id: turnId }, 409);
    }
    if (turnoPrev?.estado === "completado") {
      const { data: msgs } = await admin
        .from("brain_interview_messages").select("role, content").eq("turn_id", turnId).eq("org_id", orgId)
        .order("created_at", { ascending: true });
      const asistente = (msgs ?? []).filter((m: any) => m.role === "assistant").map((m: any) => m.content).join("\n");
      return streamResponse(async (c) => {
        if (asistente) sse(c, "message_delta", { turn_id: turnId, delta: asistente });
        sse(c, "turn_complete", {
          session_id: sessionId,
          turn_id: turnId,
          knowledge_created: turnoPrev.knowledge_created,
          gaps_created: turnoPrev.gaps_created,
          contradictions_created: turnoPrev.contradictions_created,
          interviewees_suggested: turnoPrev.interviewees_suggested,
          current_objective: turnoPrev.current_objective,
          session_status: sesion.estado,
          replay: true,
        });
      });
    }

    if (!turnoPrev) {
      const { error: insErr } = await admin.from("brain_interview_turns").insert({
        id: turnId, org_id: orgId, session_id: sessionId, estado: "procesando",
      });
      if (insErr) return json({ error: insErr.message }, 500);
    } else {
      await admin.from("brain_interview_turns").update({ estado: "procesando", error: null }).eq("id", turnId).eq("org_id", orgId);
    }

    // ── Prompt maestro
    const promptRow = await admin
      .from("agent_prompts").select("system_prompt, version").eq("nombre", "cerebro_institucional").eq("activo", true).maybeSingle();
    if (!promptRow.data) {
      await admin.from("brain_interview_turns").update({ estado: "fallido", error: "database: agente no configurado" }).eq("id", turnId);
      return json({ error: "Agente Cerebro no configurado" }, 500);
    }

    const { bloque } = await construirContextoSesion(admin, orgId, sessionId, org);

    // Transcript server-side (nunca el historial que envíe el frontend)
    const { data: transcript } = await admin
      .from("brain_interview_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(action === "reanudar" ? SESSION_TRANSCRIPT_WINDOW * 2 : MAX_HISTORY);
    const historial = (transcript ?? []).slice().reverse().map((m: any) => ({ role: m.role, content: m.content }));

    let bloqueAccion = "";
    if (action === "iniciar") {
      await admin.from("brain_interview_sessions").update({ estado: "en_proceso", iniciada_en: new Date().toISOString() }).eq("id", sessionId).eq("org_id", orgId);
      bloqueAccion = "\n\n[INICIO DE SESIÓN] Abre la entrevista según el Prompt Maestro: preséntate, encuadra el objetivo y formula UNA sola primera pregunta.";
    } else if (action === "reanudar") {
      await admin.from("brain_interview_sessions").update({ estado: "en_proceso" }).eq("id", sessionId).eq("org_id", orgId);
      const ultimas = historial.slice(-SESSION_TRANSCRIPT_WINDOW);
      const ultima = ultimas.length ? ultimas[ultimas.length - 1] : null;
      bloqueAccion = `\n\n[SESIÓN REANUDADA]\n[ÚLTIMA INTERACCIÓN]: ${ultima ? `${ultima.role}: ${String(ultima.content).slice(0, 600)}` : "(sin interacciones previas)"}\nRetoma la entrevista con coherencia. Tú decides cómo retomar: no repitas preguntas ya respondidas.`;
    } else if (action === "cerrar") {
      bloqueAccion = "\n\n[CIERRE DE SESIÓN] Genera el mensaje de cierre según el Prompt Maestro: resume lo capturado, lo pendiente y agradece. No hagas preguntas nuevas ni llames herramientas de persistencia.";
    }

    const systemPromptBase = (promptRow.data as any).system_prompt + bloque + bloqueAccion;

    // Mensaje del entrevistado
    if (action === "mensaje") {
      if (!content) {
        await admin.from("brain_interview_turns").update({ estado: "fallido", error: "tool_error: contenido vacío" }).eq("id", turnId);
        return json({ error: "content requerido" }, 400);
      }
      await admin.from("brain_interview_messages").insert({
        org_id: orgId, session_id: sessionId, turn_id: turnId, role: "user", content,
      });
      historial.push({ role: "user", content });
    }

    const turnMessages: any[] = historial.length
      ? historial.slice(-MAX_HISTORY)
      : [{ role: "user", content: "Inicia la sesión." }];
    if (turnMessages[turnMessages.length - 1].role !== "user") {
      turnMessages.push({
        role: "user",
        content: action === "cerrar" ? "Cierra la sesión de entrevista." : "Continúa la entrevista.",
      });
    }

    const metrics: TurnMetrics = {
      knowledge_created: 0, gaps_created: 0, contradictions_created: 0, interviewees_suggested: 0, persisted: false,
    };
    let currentObjective: any = null;
    let executedToolCalls = 0;
    let fullText = "";

    const idem = async (toolName: string, payload: any, fn: () => Promise<any>) => {
      const clave = `${toolName}:${await sha256hex(canonical(payload ?? {}))}`;
      const { data: claim } = await admin.rpc("brain_turn_claim_operation", {
        p_turn_id: turnId, p_org_id: orgId, p_clave: clave,
      });
      if (!claim?.claimed) {
        const prev = claim?.resultado;
        if (prev && prev !== null && prev.status !== "in_progress") return { ...prev, idempotente: true };
        return { ok: true, idempotente: true, nota: "Operación idéntica ya ejecutada en este turno." };
      }
      metrics.persisted = true;
      const result = await fn();
      await admin.rpc("brain_turn_set_operation", {
        p_turn_id: turnId, p_org_id: orgId, p_clave: clave, p_resultado: result,
      });
      return result;
    };

    return streamResponse(async (controller) => {
      const fallar = async (causa: string, mensaje: string) => {
        const code = metrics.persisted ? "post_persist" : "pre_persist";
        await admin.from("brain_interview_turns")
          .update({ estado: "fallido", error: `${causa}: ${mensaje}`.slice(0, 1000) })
          .eq("id", turnId).eq("org_id", orgId);
        sse(controller, "error", {
          turn_id: turnId,
          code,
          message: code === "post_persist"
            ? "El turno ya produjo cambios persistidos. Recupera el resultado del turno."
            : "No se pudo procesar el turno. Puedes reintentar con el mismo turn_id.",
          retryable: code === "pre_persist",
        });
      };

      try {
        for (let round = 0; round < 8; round++) {
          if (executedToolCalls >= MAX_TOOL_CALLS_PER_TURN) {
            await admin.from("brain_interview_turns")
              .update({ error: "tool_error: MAX_TOOL_CALLS_PER_TURN alcanzado" }).eq("id", turnId).eq("org_id", orgId);
            sse(controller, "error", {
              turn_id: turnId, code: "tool_error",
              message: "Se alcanzó el límite técnico de herramientas en este turno.",
              retryable: false,
            });
            break;
          }

          let res: Response;
          try {
            res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: MODEL,
                max_tokens: 3000,
                system: [{ type: "text", text: systemPromptBase, cache_control: { type: "ephemeral" } }],
                tools: action === "cerrar" ? [] : TOOLS,
                messages: turnMessages,
              }),
            });
          } catch (e) {
            await fallar("network", String(e));
            return;
          }

          if (!res.ok) {
            const errText = await res.text();
            console.error("Anthropic error", res.status, errText);
            await fallar("model_api", `${res.status} ${errText.slice(0, 300)}`);
            return;
          }

          const data = await res.json();
          const blocks = data.content ?? [];
          const toolUses: any[] = [];

          for (const b of blocks) {
            if (b.type === "text") {
              fullText += b.text;
              sse(controller, "message_delta", { turn_id: turnId, delta: b.text });
            } else if (b.type === "tool_use") {
              toolUses.push(b);
            }
          }

          if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

          sse(controller, "tool_status", { status: "procesando" });
          turnMessages.push({ role: "assistant", content: blocks });
          const toolResults: any[] = [];

          for (const tb of toolUses) {
            if (executedToolCalls >= MAX_TOOL_CALLS_PER_TURN) {
              toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: "Límite técnico de herramientas alcanzado.", is_error: true });
              continue;
            }
            executedToolCalls++;
            let result: any;
            try {
              if (tb.name === "obtener_contexto_cerebro") {
                result = await execObtenerContextoCerebro(admin, orgId, sessionId, tb.input?.incluir_items !== false);
              } else if (tb.name === "get_next_interview_objective") {
                result = await execGetNextInterviewObjective(admin, orgId, sessionId, tb.input ?? {});
                currentObjective = { objetivo: result?.objetivo, origen: result?.origen, razon: result?.razon };
              } else if (tb.name === "guardar_conocimiento") {
                result = await idem("guardar_conocimiento", tb.input ?? {}, () =>
                  execGuardarConocimiento(admin, orgId, sessionId, user.id, tb.input ?? {}));
                if (!result?.idempotente) {
                  const ids = (result?.guardados ?? []).map((g: any) => g.id);
                  metrics.knowledge_created += ids.length;
                  await stampTurn(admin, "brain_knowledge_items", ids, orgId, turnId);
                }
              } else if (tb.name === "registrar_brecha") {
                result = await idem("registrar_brecha", tb.input ?? {}, () =>
                  execRegistrarBrecha(admin, orgId, sessionId, tb.input ?? {}));
                if (!result?.idempotente) {
                  const ids = (result?.registradas ?? []).map((g: any) => g.id);
                  metrics.gaps_created += ids.length;
                  await stampTurn(admin, "brain_gaps", ids, orgId, turnId);
                }
              } else if (tb.name === "registrar_contradiccion") {
                result = await idem("registrar_contradiccion", tb.input ?? {}, () =>
                  execRegistrarContradiccion(admin, orgId, sessionId, tb.input ?? {}));
                if (!result?.idempotente) {
                  const ids = (result?.registradas ?? []).map((c: any) => c.id);
                  metrics.contradictions_created += ids.length;
                  await stampTurn(admin, "brain_contradictions", ids, orgId, turnId);
                }
              } else if (tb.name === "sugerir_entrevistado") {
                result = await idem("sugerir_entrevistado", tb.input ?? {}, () =>
                  execSugerirEntrevistado(admin, orgId, sessionId, tb.input ?? {}));
                if (!result?.idempotente && result?.assignment_id && result?.ok !== false) {
                  metrics.interviewees_suggested += 1;
                }
              } else {
                result = { ok: false, error: "Herramienta no disponible." };
              }
            } catch (e) {
              console.error("tool error", tb.name, e);
              result = { ok: false, error: String(e) };
            }
            toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(result) });
          }
          turnMessages.push({ role: "user", content: toolResults });
        }

        // ── Persistir mensaje del asistente
        if (fullText.trim()) {
          metrics.persisted = true;
          await admin.from("brain_interview_messages").insert({
            org_id: orgId, session_id: sessionId, turn_id: turnId, role: "assistant", content: fullText,
            metadata: { action },
          });
        }

        let sessionStatus = action === "cerrar" ? "completada" : "en_proceso";

        // ── Cierre: métricas reales desde BD
        if (action === "cerrar") {
          const { data: turnosSesion } = await admin
            .from("brain_interview_turns").select("id").eq("session_id", sessionId).eq("org_id", orgId);
          const turnIds = (turnosSesion ?? []).map((t: any) => t.id);

          const [{ count: kCount }, { data: gapsRows }, { count: cCount }, { data: asgRows }] = await Promise.all([
            admin.from("brain_knowledge_items").select("id", { count: "exact", head: true }).eq("org_id", orgId).in("turn_id", turnIds.length ? turnIds : [turnId]),
            admin.from("brain_gaps").select("tipo_brecha").eq("org_id", orgId).eq("session_id", sessionId),
            admin.from("brain_contradictions").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("session_id", sessionId),
            admin.from("brain_interview_assignments").select("id").eq("org_id", orgId).eq("asignado_automaticamente", true).gte("created_at", sesion.iniciada_en),
          ]);

          const gapsPorTipo: Record<string, number> = {
            pendiente_entrevista: 0, pendiente_otro_rol: 0, por_validar: 0, brecha_institucional: 0,
          };
          for (const g of gapsRows ?? []) {
            const t = String((g as any).tipo_brecha ?? "");
            if (t in gapsPorTipo) gapsPorTipo[t] += 1;
          }

          let completionReason = RAZONES_CIERRE.includes(body?.completion_reason) ? body.completion_reason : null;
          if (!completionReason) {
            const obj = await execGetNextInterviewObjective(admin, orgId, sessionId, {});
            completionReason = (obj?.bloques_pendientes ?? []).length === 0 && (obj?.brechas_prioritarias ?? []).length === 0
              ? "objectives_complete"
              : "user_closed";
          }

          const finalizadaEn = new Date();
          const duracionMin = Math.max(
            0, Math.round((finalizadaEn.getTime() - new Date(sesion.iniciada_en).getTime()) / 60000),
          );
          const cierre = {
            knowledge_created: kCount ?? 0,
            gaps_created: gapsPorTipo,
            contradictions_created: cCount ?? 0,
            interviewees_suggested: (asgRows ?? []).length,
            duracion_minutos: duracionMin,
            completion_reason: completionReason,
          };

          await admin.from("brain_interview_sessions").update({
            estado: "completada",
            finalizada_en: finalizadaEn.toISOString(),
            metadata: { ...(sesion.metadata ?? {}), cierre },
          }).eq("id", sessionId).eq("org_id", orgId);

          sessionStatus = "completada";

          await admin.from("brain_interview_turns").update({
            estado: "completado",
            knowledge_created: metrics.knowledge_created,
            gaps_created: metrics.gaps_created,
            contradictions_created: metrics.contradictions_created,
            interviewees_suggested: metrics.interviewees_suggested,
            current_objective: currentObjective,
            completed_at: finalizadaEn.toISOString(),
          }).eq("id", turnId).eq("org_id", orgId);

          sse(controller, "turn_complete", {
            session_id: sessionId, turn_id: turnId,
            knowledge_created: metrics.knowledge_created,
            gaps_created: metrics.gaps_created,
            contradictions_created: metrics.contradictions_created,
            interviewees_suggested: metrics.interviewees_suggested,
            current_objective: currentObjective,
            session_status: sessionStatus,
            resumen_cierre: cierre,
          });
          return;
        }

        // ── Turno normal completado
        if (fullText.trim()) {
          const { data: s } = await admin
            .from("brain_interview_sessions").select("preguntas_realizadas").eq("id", sessionId).maybeSingle();
          await admin.from("brain_interview_sessions")
            .update({ preguntas_realizadas: ((s as any)?.preguntas_realizadas ?? 0) + 1 })
            .eq("id", sessionId).eq("org_id", orgId);
        }

        await admin.from("brain_interview_turns").update({
          estado: "completado",
          knowledge_created: metrics.knowledge_created,
          gaps_created: metrics.gaps_created,
          contradictions_created: metrics.contradictions_created,
          interviewees_suggested: metrics.interviewees_suggested,
          current_objective: currentObjective,
          completed_at: new Date().toISOString(),
        }).eq("id", turnId).eq("org_id", orgId);

        sse(controller, "turn_complete", {
          session_id: sessionId, turn_id: turnId,
          knowledge_created: metrics.knowledge_created,
          gaps_created: metrics.gaps_created,
          contradictions_created: metrics.contradictions_created,
          interviewees_suggested: metrics.interviewees_suggested,
          current_objective: currentObjective,
          session_status: sessionStatus,
        });
      } catch (e) {
        console.error("brain-interview loop error", e);
        await fallar("tool_error", String(e));
      }
    });
  } catch (e) {
    console.error("brain-interview error", e);
    return json({ error: String(e) }, 500);
  }
});
