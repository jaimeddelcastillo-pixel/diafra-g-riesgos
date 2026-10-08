// Conserva el nombre "delete-user" por compatibilidad, pero ahora DESACTIVA:
// nunca borra al usuario ni su perfil, para no perder autoría (ALCOA+ / 21 CFR Part 11).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "No autorizado" }, 401);
    const caller = userData.user;

    const body = await req.json().catch(() => ({}));
    const user_id: string | undefined = body?.user_id;
    const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
    const bodyOrgId: string | null = body?.org_id ?? null;

    if (!user_id || !UUID_RE.test(user_id)) return json({ error: "Falta user_id" }, 400);
    if (!motivo) return json({ error: "El motivo es obligatorio" }, 400);
    if (motivo.length > 1000) return json({ error: "Motivo demasiado largo" }, 400);
    if (bodyOrgId && !UUID_RE.test(bodyOrgId)) return json({ error: "org_id inválido" }, 400);
    if (user_id === caller.id) return json({ error: "No puedes desactivar tu propia cuenta" }, 400);

    const { data: saRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();
    const isSuperAdmin = !!saRow;

    // Organización afectada
    let orgId: string | null = null;
    if (!isSuperAdmin) {
      const { data: callerMember } = await admin
        .from("org_members").select("role, org_id")
        .eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      if (!callerMember) return json({ error: "Se requiere rol de administrador" }, 403);

      const { data: targetMember } = await admin
        .from("org_members").select("org_id")
        .eq("user_id", user_id).eq("org_id", callerMember.org_id).maybeSingle();
      if (!targetMember) return json({ error: "Usuario no pertenece a tu organización" }, 403);
      orgId = callerMember.org_id;
    } else {
      // El super_admin indica la organización. Si no la indica y el usuario no tiene
      // ninguna membresía (p. ej. equipo TRACEA), se desactiva sin quitar membresías.
      orgId = bodyOrgId;
      if (!orgId) {
        const { count } = await admin
          .from("org_members").select("org_id", { count: "exact", head: true }).eq("user_id", user_id);
        if ((count ?? 0) > 0) return json({ error: "Indica la organización (org_id)" }, 400);
      }
    }

    // Quitar membresía solo en la organización de quien desactiva
    if (orgId) {
      const { error: mErr } = await admin.from("org_members").delete()
        .eq("user_id", user_id).eq("org_id", orgId);
      if (mErr) return json({ error: `No se pudo quitar la membresía: ${mErr.message}` }, 400);
    }

    const { count: restantes } = await admin
      .from("org_members").select("org_id", { count: "exact", head: true }).eq("user_id", user_id);

    let bloqueado = false;
    if ((restantes ?? 0) === 0) {
      const { error: banErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" } as any);
      if (banErr) return json({ error: `No se pudo bloquear el acceso: ${banErr.message}` }, 400);
      bloqueado = true;
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("profiles").update({
        activo: false,
        desactivado_en: new Date().toISOString(),
        desactivado_por: caller.id,
        motivo_desactivacion: motivo,
      }).eq("id", user_id);
    }

    const { error: audErr } = await admin.from("audit_trail").insert({
      accion: "USUARIO_DESACTIVADO",
      tabla: "profiles",
      registro_id: user_id,
      org_id: orgId,
      user_id: caller.id,
      valor_nuevo: { motivo, bloqueado, org_id: orgId },
      ip: req.headers.get("x-forwarded-for") ?? null,
    });
    if (audErr) console.error("audit insert error:", audErr);

    return json({ success: true, bloqueado });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
