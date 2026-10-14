// solicitar-dc3
// Crea una solicitud manual de constancia DC-3 oficial STPS.
// - Valida que el diploma exista y pertenezca al usuario.
// - Si la org tiene tiene_curso_pagado=true o dc3_adicionales_disponibles>0,
//   descuenta saldo y crea la solicitud (fuente: incluido/comprado).
// - Sin saldo => responde { requires_payment: true } para que el frontend abra checkout.
// - Notifica al alumno (dc3-solicitud-recibida) y al equipo TRACEA (dc3-solicitud-interna).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://tracea.com.mx";
const SOPORTE_EMAIL = "soporte@tracea.com.mx";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "No autenticado" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, service);

    const { data: userResp } = await userClient.auth.getUser();
    const user = userResp?.user;
    if (!user) return json({ error: "No autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const diplomaId: string | undefined = body?.diploma_id;
    if (!diplomaId) return json({ error: "diploma_id requerido" }, 400);

    // Diploma
    const { data: diploma, error: dErr } = await admin
      .from("curso_diplomas")
      .select("id, user_id, org_id, curso_id, curso_titulo, curso_norma, calificacion, intento_id, alumno_nombre, alumno_email")
      .eq("id", diplomaId)
      .maybeSingle();
    if (dErr || !diploma) return json({ error: "Diploma no encontrado" }, 404);
    if (diploma.user_id !== user.id) return json({ error: "No autorizado" }, 403);

    // No duplicar solicitud activa
    const { data: existing } = await admin
      .from("dc3_solicitudes")
      .select("id, estado")
      .eq("user_id", user.id)
      .eq("curso_id", diploma.curso_id)
      .in("estado", ["pendiente", "enviado"])
      .limit(1)
      .maybeSingle();
    if (existing) {
      return json({ error: "Ya existe una solicitud activa de DC-3 para este curso", solicitud: existing }, 409);
    }

    // Org y saldo
    let orgId: string | null = null;
    try { orgId = (await resolverContextoOrg(req)).orgId; }
    catch (e) { if (e instanceof ContextoOrgError) return json({ error: e.message }, e.status); throw e; }
    if (diploma.org_id && diploma.org_id !== orgId) {
      return json({ error: "El diploma no pertenece a la empresa activa" }, 403);
    }

    let orgRow: any = null;
    if (orgId) {
      const { data } = await admin
        .from("organizations")
        .select("id, nombre, plan, estado, tiene_curso_pagado, dc3_adicionales_disponibles, dc3_emitidos")
        .eq("id", orgId)
        .maybeSingle();
      orgRow = data;
    }

    // P1c.2: con la empresa suspendida solo se consultan DC-3 existentes; no se solicitan nuevas.
    if (orgRow?.estado === "suspendido") {
      return json({ error: "La empresa está suspendida: no se pueden solicitar nuevas DC-3" }, 403);
    }

    const tieneIncluido = orgRow?.tiene_curso_pagado === true;
    const saldoExtra = Number(orgRow?.dc3_adicionales_disponibles ?? 0);

    let fuente: "incluido" | "comprado" | null = null;
    if (tieneIncluido) fuente = "incluido";
    else if (saldoExtra > 0) fuente = "comprado";

    if (!fuente) {
      return json({ requires_payment: true, priceId: "price_1TbRUHKfwzAg4OKvWE8uMR6y" });
    }

    // Descontar saldo de manera atómica
    if (fuente === "incluido") {
      const { error: upErr } = await admin
        .from("organizations")
        .update({ tiene_curso_pagado: false })
        .eq("id", orgId)
        .eq("tiene_curso_pagado", true);
      if (upErr) return json({ error: "No se pudo reservar el DC-3 incluido" }, 500);
    } else {
      // comprado: decremento condicional
      const { data: updated, error: upErr } = await admin
        .from("organizations")
        .update({ dc3_adicionales_disponibles: saldoExtra - 1 })
        .eq("id", orgId)
        .eq("dc3_adicionales_disponibles", saldoExtra)
        .select("id")
        .maybeSingle();
      if (upErr || !updated) {
        return json({ error: "El saldo de DC-3 cambió, vuelve a intentarlo" }, 409);
      }
    }

    // Email destino: profile
    const { data: profile } = await admin
      .from("profiles")
      .select("nombre, email")
      .eq("id", user.id)
      .maybeSingle();
    const emailDestino = profile?.email ?? user.email ?? "";
    const alumnoNombre = diploma.alumno_nombre ?? profile?.nombre ?? "Alumno";

    const { data: ins, error: insErr } = await admin
      .from("dc3_solicitudes")
      .insert({
        user_id: user.id,
        org_id: orgId,
        curso_id: diploma.curso_id,
        diploma_id: diploma.id,
        intento_id: diploma.intento_id,
        curso_titulo: diploma.curso_titulo,
        curso_norma: diploma.curso_norma,
        calificacion: diploma.calificacion,
        email_destino: emailDestino,
        alumno_nombre: alumnoNombre,
        org_nombre: orgRow?.nombre ?? null,
        plan_org: orgRow?.plan ?? null,
        fuente,
        estado: "pendiente",
      })
      .select("*")
      .single();
    if (insErr) {
      console.error("solicitar-dc3 insert error", insErr);
      return json({ error: "No se pudo registrar la solicitud" }, 500);
    }

    // Notificar al alumno y a TRACEA (no romper el flujo si falla)
    try {
      await enviarYRegistrar({
          templateName: "dc3-solicitud-recibida",
          recipientEmail: emailDestino,
          idempotencyKey: `dc3-recibida-${ins.id}`,
          templateData: {
            nombre: alumnoNombre,
            curso_titulo: diploma.curso_titulo,
            fuente,
            plataforma_url: `${APP_URL}/mis-diplomas`,
          },
        });
    } catch (e) { console.error("email alumno error", e); }

    try {
      await enviarYRegistrar({
          templateName: "dc3-solicitud-interna",
          recipientEmail: SOPORTE_EMAIL,
          idempotencyKey: `dc3-interna-${ins.id}`,
          templateData: {
            alumno_nombre: alumnoNombre,
            email_destino: emailDestino,
            org_nombre: orgRow?.nombre ?? "—",
            plan_org: orgRow?.plan ?? "—",
            curso_titulo: diploma.curso_titulo,
            curso_norma: diploma.curso_norma,
            calificacion: diploma.calificacion,
            fuente,
            admin_url: `${APP_URL}/admin/dc3`,
          },
        });
    } catch (e) { console.error("email interno error", e); }

    return json({ ok: true, solicitud_id: ins.id, fuente });
  } catch (e) {
    console.error("solicitar-dc3 fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}