// C6c: activa un expediente de auditoría externa e invita al auditor. Solo el RS de la empresa activa.
// El auditor NUNCA se agrega a org_members: no ve nada por las políticas de la empresa ni consume licencias.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE = "https://tracea.com.mx";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let ctx;
  try { ctx = await resolverContextoOrg(req); } catch (e) {
    const err = e as ContextoOrgError;
    return json({ error: err.message }, err.status ?? 500);
  }
  if (ctx.soporteLogId || ctx.rolEnOrg !== "responsable_sanitario") {
    return json({ error: "Solo el Responsable Sanitario activa el expediente" }, 403);
  }
  const body = await req.json().catch(() => null);
  const auditoriaId = String(body?.auditoria_id ?? "");
  if (!UUID.test(auditoriaId)) return json({ error: "auditoria_id inválido" }, 400);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: aud } = await admin.from("auditorias_externas").select("*")
    .eq("id", auditoriaId).eq("org_id", ctx.orgId).maybeSingle();
  if (!aud) return json({ error: "Expediente no encontrado" }, 404);
  if (aud.estado !== "borrador") return json({ error: `El expediente ya está ${aud.estado}` }, 409);
  if (new Date(aud.expira_en) <= new Date()) return json({ error: "La vigencia ya terminó; ajusta las fechas" }, 409);
  const { count: nItems } = await admin.from("auditoria_items")
    .select("id", { count: "exact", head: true }).eq("auditoria_id", auditoriaId);
  if (!nItems) return json({ error: "Agrega al menos un ítem antes de activar" }, 409);

  const email = String(aud.auditor_email).trim().toLowerCase().replace(/[\s.]+$/, "");
  if (!/^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(email)) {
    return json({ error: "El correo del auditor no es válido; corrígelo con «Editar datos»" }, 400);
  }
  const { data: org } = await admin.from("organizations").select("nombre").eq("id", ctx.orgId).maybeSingle();
  const { data: perfil } = await admin.from("profiles").select("id, activo").ilike("email", email).maybeSingle();

  let auditorId: string;
  let cuentaNueva = false;
  let enlaceInvitacion: string | null = null;
  if (perfil) {
    if (perfil.activo === false) return json({ error: "La cuenta de ese correo está desactivada" }, 409);
    const { data: sa } = await admin.from("user_roles").select("role").eq("user_id", perfil.id).eq("role", "super_admin").maybeSingle();
    if (sa) return json({ error: "Ese correo pertenece al equipo TRACEA" }, 409);
    const { data: miembro } = await admin.from("org_members").select("id")
      .eq("org_id", ctx.orgId).eq("user_id", perfil.id).maybeSingle();
    if (miembro) return json({ error: "Ese correo ya es integrante de la empresa; un auditor externo no puede serlo" }, 409);
    auditorId = perfil.id;
  } else {
  // C6c.2: el enlace de invitación se genera sin que el sistema de cuentas envíe su correo genérico;
  // se manda dentro de la plantilla auditoria-invitacion (en español).
    const { data: inv, error: invErr } = await admin.auth.admin.generateLink({
      type: "invite", email,
      options: { data: { nombre: aud.auditor_nombre }, redirectTo: `${SITE}/reset-password` },
    });
    if (invErr || !inv?.user || !inv.properties?.action_link) {
      return json({ error: `No se pudo invitar: ${invErr?.message ?? "sin usuario"}` }, 500);
    }
    auditorId = inv.user.id;
    enlaceInvitacion = inv.properties.action_link;
    cuentaNueva = true;
    // La alta automática da un rol global por omisión; el auditor no debe tener ninguno.
    await admin.from("user_roles").delete().eq("user_id", auditorId).neq("role", "super_admin");
    await admin.from("profiles").update({ nombre: aud.auditor_nombre }).eq("id", auditorId);
  }

  const ahora = new Date().toISOString();
  const { error: upErr } = await admin.from("auditorias_externas").update({
    auditor_user_id: auditorId, estado: "activo", activado_por: ctx.userId, activado_en: ahora,
  }).eq("id", auditoriaId).eq("estado", "borrador");
  if (upErr) return json({ error: upErr.message }, 500);

  await admin.from("audit_trail").insert({
    accion: "AUDITORIA_ACTIVADA", tabla: "auditorias_externas", registro_id: auditoriaId,
    org_id: ctx.orgId, user_id: ctx.userId, ip,
    valor_nuevo: { auditoria_id: auditoriaId, auditor_user_id: auditorId, auditor_email: email,
      cuenta_nueva: cuentaNueva, expira_en: aud.expira_en, items: nItems },
  });

  const fmt = (d: string) => new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
  const { error: mailErr } = await enviarYRegistrar({
    templateName: "auditoria-invitacion", recipientEmail: email,
    idempotencyKey: `auditoria-${auditoriaId}`,
    templateData: { nombre: aud.auditor_nombre, organizacion: org?.nombre ?? "", expediente: aud.nombre,
      inicia: fmt(aud.inicia_en), expira: fmt(aud.expira_en), permiteDescarga: !!aud.permite_descarga,
      cuentaNueva, portalUrl: enlaceInvitacion ?? `${SITE}/auditoria-externa` },
  });
  if (mailErr) console.warn("correo auditoria-invitacion:", mailErr.message);
  return json({ success: true, cuenta_nueva: cuentaNueva, correo_enviado: !mailErr });
});
