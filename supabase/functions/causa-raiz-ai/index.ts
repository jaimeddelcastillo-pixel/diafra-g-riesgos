// Edge function: causa-raiz-ai
// Asistencia IA para análisis de causa raíz (Ishikawa 6M y 5 Porqués).
// Devuelve JSON estructurado (no streaming).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverContextoOrg } from "../_shared/contexto-org.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CLAUDE_MODEL = "claude-sonnet-4-6";

type IshikawaReq = {
  mode: "ishikawa";
  peligro: string;
  proceso: string;
  norma: string;
  causa_actual?: string;
};

type PorquesReq = {
  mode: "evaluar_porque";
  norma: string;
  causa_inicial: string;
  porques: string[]; // respuestas niveles 1..n
};

function extractJson(text: string): any | null {
  // intenta encontrar el primer bloque { ... } válido
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function askClaude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  const data = await res.json();
  const block = (data?.content ?? []).find((b: any) => b.type === "text");
  return block?.text ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "no autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Empresa resuelta por el servidor (contexto_org_actual) — C2a
    let memberRow: { org_id: string } | null = null;
    try { memberRow = { org_id: (await resolverContextoOrg(req)).orgId }; } catch (_e) { memberRow = null; }
    if (!memberRow) {
      return new Response(JSON.stringify({ error: "sin organización" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as IshikawaReq | PorquesReq;

    if (body.mode === "ishikawa") {
      const { peligro, proceso, norma, causa_actual } = body;
      const sys =
        `Eres un experto en gestión de riesgos según ${norma} (ISO 14971 / ICH Q9). ` +
        `Devuelve EXCLUSIVAMENTE un JSON válido sin texto adicional, sin markdown, sin \`\`\`. ` +
        `Estructura exacta: {"mano_obra":[],"maquina":[],"metodo":[],"material":[],"medio_ambiente":[],"medicion":[]}. ` +
        `Cada lista debe tener entre 2 y 4 causas potenciales concretas, específicas al peligro y proceso. ` +
        `Evita causas genéricas tipo "error humano" o "falta de capacitación" sin contexto. ` +
        `Cada causa: máximo 12 palabras.`;
      const user =
        `Peligro: "${peligro}"\nProceso: "${proceso}"\n` +
        (causa_actual ? `Causa actual capturada: "${causa_actual}"\n` : "") +
        `Genera el JSON Ishikawa 6M.`;
      const text = await askClaude(sys, user);
      const json = extractJson(text);
      if (!json) throw new Error("Respuesta IA no parseable");
      return new Response(JSON.stringify(json), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.mode === "evaluar_porque") {
      const { norma, causa_inicial, porques } = body;
      const cadena = [causa_inicial, ...porques].filter(Boolean).join(" → ");
      const sys =
        `Eres un experto en análisis de causa raíz bajo ${norma}. ` +
        `Evalúa si la cadena de 5 Porqués llega a una verdadera causa raíz (sistémica, ` +
        `controlable por la organización, no atribuible a culpa individual, no puede seguir ` +
        `preguntándose "por qué" de forma significativa). ` +
        `Devuelve EXCLUSIVAMENTE JSON sin markdown: ` +
        `{"esCausaRaiz":boolean,"justificacion":"...","sugerencia":"... o null"}. ` +
        `"sugerencia" debe contener el siguiente porqué propuesto si aún no es raíz, o null.`;
      const user = `Cadena: ${cadena}\nNiveles capturados: ${porques.length}\nEvalúa el último nivel.`;
      const text = await askClaude(sys, user);
      const json = extractJson(text);
      if (!json) throw new Error("Respuesta IA no parseable");
      return new Response(JSON.stringify(json), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "mode inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});