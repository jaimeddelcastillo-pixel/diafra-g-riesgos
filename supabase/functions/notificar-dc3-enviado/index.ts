// notificar-dc3-enviado
// Avisa al alumno que su constancia DC-3 fue enviada. Solo super_admin.
// Los datos salen de la solicitud guardada (no del navegador).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
    authHeader.slice(7),
  );
  if (claimsErr || !claims?.claims?.sub) return json({ error: "No autenticado" }, 401);

  const { data: esSuper, error: rolErr } = await userClient.rpc("is_super_admin");
  if (rolErr || esSuper !== true) return json({ error: "No autorizado" }, 403);

  let solicitudId: unknown;
  try {
    solicitudId = (await req.json())?.solicitud_id;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (typeof solicitudId !== "string" || !UUID.test(solicitudId)) {
    return json({ error: "solicitud_id inválido" }, 400);
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: s, error } = await admin
    .from("dc3_solicitudes")
    .select("id, estado, email_destino, alumno_nombre, curso_titulo, dc3_url, notas_admin")
    .eq("id", solicitudId)
    .maybeSingle();
  if (error) return json({ error: "No se pudo leer la solicitud" }, 500);
  if (!s) return json({ error: "Solicitud no encontrada" }, 404);
  if (s.estado !== "enviado") return json({ error: "La solicitud no está marcada como enviada" }, 409);

  const { data, error: sendErr } = await enviarYRegistrar({
    templateName: "dc3-enviado",
    recipientEmail: s.email_destino,
    idempotencyKey: `dc3-enviado-${s.id}`,
    templateData: {
      nombre: s.alumno_nombre,
      curso_titulo: s.curso_titulo,
      dc3_url: s.dc3_url || undefined,
      notas: s.notas_admin || undefined,
    },
  });
  if (sendErr) return json({ error: "No se pudo enviar el correo" }, 502);
  return json(data);
});
