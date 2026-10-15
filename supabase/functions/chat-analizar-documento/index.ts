// Edge function: chat-analizar-documento
// Análisis híbrido inteligente: PDFs e imágenes se envían a Claude (que extrae texto si es seleccionable
// y aplica visión si es escaneado). Devuelve resumen estructurado y clasificación.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cargarSkill, interpolar, registrarSkillFaltante } from "../_shared/skills.ts";
import { resolverContextoOrg } from "../_shared/contexto-org.ts";
import { bloqueImagen, bloquePdf, extractDocxText, isWordMime } from "../_shared/documento-contenido.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLAUDE_MODEL = "claude-sonnet-4-6";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return j({ error: "no autorizado" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "sesión inválida" }, 401);

    const { storage_path, nombre_archivo, mime_type, folio_id } = await req.json();
    if (!storage_path) return j({ error: "storage_path requerido" }, 400);

    // Org del usuario
    let member: { org_id: string } | null = null;
    try { member = { org_id: (await resolverContextoOrg(req)).orgId }; } catch (_e) { member = null; }
    if (!member) return j({ error: "sin organización" }, 403);

    // C2a.1: el archivo debe pertenecer a la empresa del contexto
    if (typeof storage_path !== "string" || !storage_path.startsWith(`${member.org_id}/`) || storage_path.includes("..")) {
      return j({ error: "El documento no pertenece a tu organización" }, 403);
    }
    if (folio_id) {
      const { data: folio } = await adminClient.from("folios").select("org_id").eq("id", folio_id).maybeSingle();
      if (!folio || folio.org_id !== member.org_id) {
        return j({ error: "El folio no pertenece a tu organización" }, 403);
      }
    }

    // Descargar el archivo
    const { data: file, error: dErr } = await adminClient
      .storage.from("chat-documentos").download(storage_path);
    if (dErr || !file) return j({ error: dErr?.message ?? "no descargable" }, 500);

    const buffer = await file.arrayBuffer();

    let userContent: any[] = [];
    if (mime_type === "application/pdf") {
      userContent.push(bloquePdf(buffer));
    } else if ((mime_type as string).startsWith("image/")) {
      userContent.push(bloqueImagen(buffer, mime_type));
    } else if (isWordMime(mime_type, nombre_archivo)) {
      const extracted = await extractDocxText(buffer);
      if (!extracted.trim()) return j({ error: "No se pudo extraer texto del Word" }, 422);
      userContent.push({
        type: "text",
        text: `Contenido extraído del documento Word "${nombre_archivo}":\n\n${extracted.slice(0, 50000)}`,
      });
    } else {
      return j({
        analisis: {
          tipo: "no_soportado",
          mensaje: `Formato ${mime_type} todavía no soportado para análisis automático. Pega el contenido relevante directamente en el chat.`,
        },
      });
    }

    // C4a: la instrucción vive en la base (skill analisis_documento, vigente).
    let instruccion = "";
    try {
      const skill = await cargarSkill(adminClient, "analisis_documento");
      instruccion = interpolar(skill.texto, { documento: `"${nombre_archivo}"` });
    } catch (e) {
      console.error("C4a: analisis_documento no vigente", e);
      await registrarSkillFaltante(adminClient, member.org_id, "analisis_documento", "chat-analizar-documento");
      return j({ error: "skill_no_vigente", mensaje: "Skill no vigente: analisis_documento. Publícala en el panel Skills de IA." }, 500);
    }
    userContent.push({ type: "text", text: instruccion });

    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthRes.ok) {
      const t = await anthRes.text();
      console.error("anthropic err", t);
      return j({ error: "anthropic_error", detail: t }, 502);
    }
    const anthJson = await anthRes.json();
    const txt = anthJson.content?.[0]?.text ?? "{}";
    let analisis: any;
    try {
      const cleaned = txt.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      analisis = JSON.parse(cleaned);
    } catch {
      analisis = { tipo: "otro", resumen: txt.slice(0, 500), puntos_clave: [], riesgos_detectados: [] };
    }

    // Persistir
    await adminClient.from("chat_documentos").insert({
      org_id: member.org_id,
      folio_id: folio_id ?? null,
      user_id: user.id,
      nombre_archivo,
      tipo: mime_type,
      storage_path,
      analisis_resultado: analisis,
      tokens_usados: (anthJson.usage?.input_tokens ?? 0) + (anthJson.usage?.output_tokens ?? 0),
    });

    return j({ analisis });
  } catch (e) {
    console.error("chat-analizar-documento", e);
    return j({ error: String(e) }, 500);
  }
});

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Los helpers de lectura de archivos viven en ../_shared/documento-contenido.ts (C6a.3).