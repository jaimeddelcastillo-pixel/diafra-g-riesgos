// Edge function: chat-buscar-folio
// Busca folios por código o palabra clave dentro de la organización del usuario.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return j({ error: "no autorizado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { query } = await req.json();
    const q = String(query ?? "").trim();
    if (!q) return j({ folios: [] });

    const { data, error } = await supabase
      .from("folios")
      .select("id, codigo, proceso_equipo, estado, norma_folio, fecha_inicio")
      .or(`codigo.ilike.%${q}%,proceso_equipo.ilike.%${q}%,alcance.ilike.%${q}%`)
      .order("fecha_inicio", { ascending: false })
      .limit(10);

    if (error) return j({ error: error.message }, 500);
    return j({ folios: data ?? [] });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}