// supabase/functions/org-action/index.ts
// Acciones administrativas sobre organizaciones (super_admin only):
//   - suspender   → estado='suspendido', activo=false
//   - reactivar   → estado='activo', activo=true
//   - cambiar-plan → cambia campo plan (override manual, sin tocar Stripe)
//   - eliminar    → soft-delete: estado='cancelado', activo=false, cancelled_at=now()
//   - recordatorio-pago → email a todos los admins de la org

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAccessToken(token: string, supabaseUrl: string) {
  const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${supabaseUrl}/auth/v1`,
    audience: "authenticated",
  });
  return payload;
}

const APP_URL = Deno.env.get("APP_URL") ?? "https://tracea.com.mx";
const PLANES_VALIDOS = ["trial", "starter", "professional", "enterprise", "pro"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validar JWT y rol super_admin
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let userId: string;
  try {
    const payload = await verifyAccessToken(token, supabaseUrl);
    if (typeof payload.sub !== "string") return json({ error: "No autorizado" }, 401);
    userId = payload.sub;
  } catch {
    return json({ error: "No autorizado" }, 401);
  }

  const { data: saCheck } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!saCheck) return json({ error: "Se requiere rol super_admin" }, 403);

  // Body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { action, org_id, plan, motivo, confirm_nombre } = body ?? {};
  if (!action || !org_id) {
    return json({ error: "Faltan campos: action, org_id" }, 400);
  }

  // Verificar que la org existe
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, nombre, slug, plan, estado, activo")
    .eq("id", org_id)
    .maybeSingle();
  if (orgErr || !org) return json({ error: "Organización no encontrada" }, 404);

  try {
    switch (action) {
      case "suspender": {
        const { error } = await admin
          .from("organizations")
          .update({ estado: "suspendido", activo: false, updated_at: new Date().toISOString() })
          .eq("id", org_id);
        if (error) throw error;
        return json({ success: true, message: `Organización ${org.nombre} suspendida` });
      }

      case "reactivar": {
        const { error } = await admin
          .from("organizations")
          .update({ estado: "activo", activo: true, updated_at: new Date().toISOString() })
          .eq("id", org_id);
        if (error) throw error;
        return json({ success: true, message: `Organización ${org.nombre} reactivada` });
      }

      case "cambiar-plan": {
        if (!plan || !PLANES_VALIDOS.includes(plan)) {
          return json({ error: `Plan inválido. Debe ser uno de: ${PLANES_VALIDOS.join(", ")}` }, 400);
        }
        const { error } = await admin
          .from("organizations")
          .update({ plan, pending_price_id: null, updated_at: new Date().toISOString() })
          .eq("id", org_id);
        if (error) throw error;
        return json({ success: true, message: `Plan cambiado a ${plan} (override manual, sin sincronizar con Stripe)` });
      }

      case "eliminar": {
        // Soft-delete con confirmación de nombre
        if (!confirm_nombre || confirm_nombre.trim() !== org.nombre) {
          return json({ error: `Para eliminar debes escribir exactamente el nombre: "${org.nombre}"` }, 400);
        }
        const { error } = await admin
          .from("organizations")
          .update({
            estado: "cancelado",
            activo: false,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", org_id);
        if (error) throw error;
        return json({ success: true, message: `Organización ${org.nombre} cancelada (soft-delete). Los datos se conservan.` });
      }

      case "recordatorio-pago": {
        // Buscar todos los admins de la org
        const { data: members } = await admin
          .from("org_members")
          .select("user_id")
          .eq("org_id", org_id)
          .eq("role", "admin");

        const adminIds = (members ?? []).map((m: any) => m.user_id);
        if (adminIds.length === 0) {
          return json({ error: "La organización no tiene administradores" }, 400);
        }

        const { data: profiles } = await admin
          .from("profiles")
          .select("id, nombre, email")
          .in("id", adminIds);

        const recipients = (profiles ?? []).filter((p: any) => p.email);
        if (recipients.length === 0) {
          return json({ error: "No hay correos válidos entre los administradores" }, 400);
        }

        const motivoTexto = (motivo && typeof motivo === "string" && motivo.trim().length > 0)
          ? motivo.trim()
          : "Tu cuenta tiene un pago pendiente. Para acceder a TRACEA debes completar tu suscripción.";

        const sentTo: string[] = [];
        const failed: { email: string; error: string }[] = [];

        for (const r of recipients) {
          try {
            const { error: sendErr } = await admin.functions.invoke("send-transactional-email", {
              body: {
                templateName: "recordatorio-pago",
                recipientEmail: r.email,
                idempotencyKey: `recordatorio-pago-${org_id}-${r.id}-${Date.now()}`,
                templateData: {
                  nombre: r.nombre || "",
                  organizacion: org.nombre,
                  motivo: motivoTexto,
                  pagoUrl: `${APP_URL}/pago-pendiente`,
                  soporteEmail: "soporte@tracea.com.mx",
                },
              },
            });
            if (sendErr) throw sendErr;
            sentTo.push(r.email);
          } catch (e: any) {
            failed.push({ email: r.email, error: e?.message || "error" });
          }
        }

        return json({
          success: true,
          message: `Recordatorio enviado a ${sentTo.length} administrador(es)`,
          sent_to: sentTo,
          failed,
        });
      }

      default:
        return json({ error: `Acción desconocida: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("org-action error:", err);
    return json({ error: err.message || "Error interno" }, 500);
  }
});
