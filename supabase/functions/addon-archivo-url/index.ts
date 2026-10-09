// Edge function: addon-archivo-url
// Genera una signed URL (60 min) para descargar un archivo del catálogo addon_archivos
// Verifica que la org del usuario haya comprado el producto correspondiente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return j({ error: "no autorizado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "sesión inválida" }, 401);

    const { archivo_id } = await req.json();
    if (!archivo_id) return j({ error: "archivo_id requerido" }, 400);

    const { data: archivo, error: aErr } = await admin
      .from("addon_archivos")
      .select("id, producto, storage_path, nombre, activo")
      .eq("id", archivo_id)
      .maybeSingle();
    if (aErr || !archivo || !archivo.activo) return j({ error: "archivo no encontrado" }, 404);

    // Verificar super_admin o compra del producto
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    const isSuper = !!roleRow;

    if (!isSuper) {
      let member: { org_id: string };
      try { member = { org_id: (await resolverContextoOrg(req)).orgId }; }
      catch (e) { if (e instanceof ContextoOrgError) return j({ error: e.message }, e.status); throw e; }

      const { data: purchase } = await admin
        .from("addon_purchases")
        .select("id")
        .eq("org_id", member.org_id)
        .eq("producto", archivo.producto)
        .maybeSingle();
      if (!purchase) return j({ error: "producto no adquirido" }, 403);
    }

    const { data: signed, error: sErr } = await admin
      .storage.from("addon-protocolos")
      .createSignedUrl(archivo.storage_path, 3600, { download: archivo.nombre });
    if (sErr || !signed) return j({ error: sErr?.message ?? "no se pudo firmar" }, 500);

    return j({ url: signed.signedUrl, expires_in: 3600 });
  } catch (e) {
    console.error("addon-archivo-url", e);
    return j({ error: String(e) }, 500);
  }
});

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}