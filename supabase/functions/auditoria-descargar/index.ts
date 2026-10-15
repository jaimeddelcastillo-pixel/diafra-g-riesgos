// C6c: descarga del auditor externo. Valida expediente/vigencia/ítem con auditoria_validar_acceso.
// PDF → copia con marca de agua en cada página (AUDITOR_DESCARGO). Otros archivos → solo vista con URL de 60 s (AUDITOR_CONSULTO).
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-disposition",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Helvetica estándar solo codifica WinAnsi: se quitan caracteres fuera de Latin-1.
const winAnsi = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF\u2014]/g, "?");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "No autorizado" }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "No autorizado" }, 401);

  const body = await req.json().catch(() => null);
  const itemId = String(body?.item_id ?? "");
  const pathPedido = body?.path ? String(body.path) : null;
  if (!UUID.test(itemId)) return json({ error: "item_id inválido" }, 400);
  if (pathPedido && pathPedido.length > 500) return json({ error: "path inválido" }, 400);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: acc, error: accErr } = await admin.rpc("auditoria_validar_acceso", { p_user: user.id, p_item_id: itemId });
  if (accErr || !acc) return json({ error: "Sin acceso vigente a este ítem" }, 403);
  const a = acc as Record<string, any>;

  // Resolver el archivo permitido para este ítem.
  let bucket = ""; let path = ""; let nombre = ""; let esPdf = false; let entidad = a.entidad_id;
  if (a.tipo === "documento") {
    const { data: d } = await admin.from("org_documentos")
      .select("storage_path, nombre, nombre_archivo_original, mime_type, deleted_at, org_id")
      .eq("id", a.entidad_id).maybeSingle();
    if (!d || d.deleted_at || d.org_id !== a.org_id || !d.storage_path) return json({ error: "Archivo no disponible" }, 404);
    bucket = "org-documentos"; path = d.storage_path;
    nombre = d.nombre_archivo_original || d.nombre || path.split("/").pop()!;
    esPdf = d.mime_type === "application/pdf" || path.toLowerCase().endsWith(".pdf");
  } else if (a.tipo === "folio") {
    if (!a.incluir_evidencias) return json({ error: "Este folio no incluye evidencias" }, 403);
    if (!pathPedido) return json({ error: "Falta la evidencia" }, 400);
    const { data: rs } = await admin.from("riesgos").select("anexos").eq("folio_id", a.entidad_id);
    const anexo = (rs ?? []).flatMap((r: any) => Array.isArray(r.anexos) ? r.anexos : [])
      .find((x: any) => x?.path === pathPedido);
    if (!anexo) return json({ error: "La evidencia no pertenece a este folio" }, 403);
    bucket = "evidencias"; path = anexo.path; nombre = anexo.name || path.split("/").pop()!;
    esPdf = path.toLowerCase().endsWith(".pdf");
  } else {
    return json({ error: "Este ítem no tiene archivo" }, 400);
  }

  if (!esPdf) {
    const { data: s, error: sErr } = await admin.storage.from(bucket).createSignedUrl(path, 60);
    if (sErr || !s) return json({ error: "No se pudo abrir el archivo" }, 500);
    await admin.from("audit_trail").insert({
      accion: "AUDITOR_CONSULTO", tabla: "auditoria_items", registro_id: itemId, org_id: a.org_id, user_id: user.id, ip,
      valor_nuevo: { auditoria_id: a.auditoria_id, tipo: a.tipo, entidad_id: entidad, archivo: nombre, modo: "vista_60s" },
    });
    return json({ modo: "vista", url: s.signedUrl, nombre });
  }

  if (!a.permite_descarga) return json({ error: "Este expediente no permite descargas" }, 403);
  const { data: blob, error: dErr } = await admin.storage.from(bucket).download(path);
  if (dErr || !blob) return json({ error: "No se pudo leer el archivo" }, 500);
  const original = await blob.arrayBuffer();
  const huella = await sha256(original);

  const ahora = new Date();
  const fecha = ahora.toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" });
  const marca = winAnsi(`COPIA NO CONTROLADA — ${a.nombre} — ${a.auditor_nombre} — ${fecha}`);
  let salida: Uint8Array;
  try {
    const pdf = await PDFDocument.load(original, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      const diag = Math.sqrt(width * width + height * height);
      let size = 28;
      while (size > 8 && font.widthOfTextAtSize(marca, size) > diag * 0.85) size -= 1;
      const w = font.widthOfTextAtSize(marca, size);
      const ang = Math.atan2(height, width);
      page.drawText(marca, {
        x: width / 2 - (w / 2) * Math.cos(ang) + (size / 2) * Math.sin(ang),
        y: height / 2 - (w / 2) * Math.sin(ang) - (size / 2) * Math.cos(ang),
        size, font, color: rgb(0.75, 0, 0), opacity: 0.28, rotate: degrees((ang * 180) / Math.PI),
      });
    }
    salida = await pdf.save();
  } catch (e) {
    console.error("marca de agua", e);
    return json({ error: "No se pudo preparar la copia del PDF" }, 500);
  }

  await admin.from("audit_trail").insert({
    accion: "AUDITOR_DESCARGO", tabla: "auditoria_items", registro_id: itemId, org_id: a.org_id, user_id: user.id, ip,
    valor_nuevo: { auditoria_id: a.auditoria_id, tipo: a.tipo, entidad_id: entidad, archivo: nombre, sha256: huella,
      sha256_copia: await sha256(salida.buffer as ArrayBuffer), marca },
  });
  return new Response(salida, {
    headers: { ...cors, "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nombre.replace(/\.pdf$/i, ""))}_copia_auditoria.pdf"` },
  });
});
