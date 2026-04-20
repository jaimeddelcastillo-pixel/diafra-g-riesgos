import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "No autorizado" }, 401);
    const caller = userData.user;

    const { user_id } = await req.json();
    if (!user_id) return json({ error: "Falta user_id" }, 400);

    if (user_id === caller.id) {
      return json({ error: "No puedes eliminar tu propia cuenta" }, 400);
    }

    // ¿Caller es super_admin?
    const { data: saRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const isSuperAdmin = !!saRow;

    if (!isSuperAdmin) {
      // Admin de org: solo puede eliminar usuarios de su propia organización
      const { data: callerMember } = await admin
        .from("org_members")
        .select("role, org_id")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!callerMember) return json({ error: "Se requiere rol de administrador" }, 403);

      const { data: targetMember } = await admin
        .from("org_members")
        .select("org_id")
        .eq("user_id", user_id)
        .eq("org_id", callerMember.org_id)
        .maybeSingle();

      if (!targetMember) return json({ error: "Usuario no pertenece a tu organización" }, 403);
    }

    // Limpiar referencias antes de borrar (cascade no garantizado en todas las tablas)
    await admin.from("org_members").delete().eq("user_id", user_id);
    await admin.from("user_roles").delete().eq("user_id", user_id);
    // Anular referencias en tablas que apuntan a auth.users pero no tienen ON DELETE
    await admin.from("folios").update({ created_by: null }).eq("created_by", user_id);
    await admin.from("folio_comite").update({ user_id: null }).eq("user_id", user_id);
    await admin.from("folio_versiones").update({ creado_por: null }).eq("creado_por", user_id);
    await admin.from("audit_trail").update({ user_id: null }).eq("user_id", user_id);
    await admin.from("profiles").delete().eq("id", user_id);

    const { error: delError } = await admin.auth.admin.deleteUser(user_id);
    if (delError) {
      console.error("deleteUser error:", delError);
      return json({ error: `No se pudo eliminar: ${delError.message}` }, 400);
    }

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});