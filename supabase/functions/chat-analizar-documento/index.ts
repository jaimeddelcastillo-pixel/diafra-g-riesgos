// Edge function: chat-analizar-documento
// Análisis híbrido inteligente: PDFs e imágenes se envían a Claude (que extrae texto si es seleccionable
// y aplica visión si es escaneado). Devuelve resumen estructurado y clasificación.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import JSZip from "npm:jszip@3.10.1";

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
    const { data: member } = await adminClient
      .from("org_members").select("org_id").eq("user_id", user.id).maybeSingle();
    if (!member) return j({ error: "sin organización" }, 403);

    // Descargar el archivo
    const { data: file, error: dErr } = await adminClient
      .storage.from("chat-documentos").download(storage_path);
    if (dErr || !file) return j({ error: dErr?.message ?? "no descargable" }, 500);

    const buffer = await file.arrayBuffer();

    let userContent: any[] = [];
    if (mime_type === "application/pdf") {
      const base64 = arrayBufferToBase64(buffer);
      userContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
    } else if ((mime_type as string).startsWith("image/")) {
      const base64 = arrayBufferToBase64(buffer);
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: mime_type, data: base64 },
      });
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

    userContent.push({
      type: "text",
      text: `Analiza el documento "${nombre_archivo}" y devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "tipo": "amef" | "procedimiento" | "estudio" | "evidencia" | "otro",
  "resumen": "Resumen de 2-3 líneas",
  "puntos_clave": ["..."],
  "riesgos_detectados": [
    {
      "peligro": "...",
      "situacion_peligrosa": "...",
      "efecto_dano": "...",
      "causa_potencial": "...",
      "severidad_sugerida": 1-10,
      "ocurrencia_sugerida": 1-10,
      "deteccion_sugerida": 1-10
    }
  ],
  "accion_sugerida": "Texto que recomiende qué hacer (insertar riesgos, adjuntar como evidencia, etc.)"
}
No agregues explicaciones fuera del JSON.`,
    });

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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function isWordMime(mimeType: string, fileName: string) {
  return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.toLowerCase().endsWith(".docx");
}

async function extractDocxText(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) return "";
  return documentXml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}