// Huella sha256 calculada en el servidor al subir un archivo a Recursos (C6a.1).
// No depende de Cerebro. Nunca recalcula una huella ya registrada.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let ctx;
  try { ctx = await resolverContextoOrg(req); } catch (e) {
    const err = e as ContextoOrgError;
    return json({ error: err.message }, err.status ?? 500);
  }
  const body = await req.json().catch(() => null);
  const docId = String(body?.doc_id ?? "");
  if (!UUID.test(docId)) return json({ error: "doc_id inválido" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: doc } = await admin.from("org_documentos")
    .select("id, org_id, storage_path, sha256, sha256_servidor, creado_por").eq("id", docId).maybeSingle();
  if (!doc || doc.org_id !== ctx.orgId || !String(doc.storage_path).startsWith(`${ctx.orgId}/`)) {
    return json({ error: "El documento no pertenece a tu organización" }, 403);
  }
  const autorizado = doc.creado_por === ctx.userId || ["admin", "responsable_sanitario", "super_admin"].includes(ctx.rolEnOrg ?? "");
  if (!autorizado) return json({ error: "sin_permiso" }, 403);
  if (doc.sha256_servidor) {
    return json({ sha256_servidor: doc.sha256_servidor, coincide: !doc.sha256 || doc.sha256 === doc.sha256_servidor, ya_registrada: true });
  }

  const { data: file, error: dErr } = await admin.storage.from("org-documentos").download(doc.storage_path);
  if (dErr || !file) return json({ error: "No se pudo leer el archivo" }, 500);
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const coincide = !doc.sha256 || doc.sha256 === hash;

  const upd: Record<string, unknown> = { sha256_servidor: hash, sha256_verificado_en: new Date().toISOString() };
  if (!doc.sha256) upd.sha256 = hash;
  const { error: uErr } = await admin.from("org_documentos").update(upd).eq("id", docId);
  if (uErr) return json({ error: "No se pudo registrar la huella", detalle: uErr.message }, 500);

  if (!coincide) {
    await admin.from("audit_trail").insert({
      user_id: ctx.userId, org_id: ctx.orgId, tabla: "org_documentos", registro_id: docId,
      accion: "HUELLA_NO_COINCIDE",
      valor_nuevo: { sha256_navegador: doc.sha256, sha256_servidor: hash },
    });
  }
  return json({ sha256_servidor: hash, coincide });
});
