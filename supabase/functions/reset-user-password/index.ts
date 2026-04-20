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
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar autenticación del caller pasando el token explícito al admin client
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "No autorizado" }, 401);
    const caller = userData.user;

    // ¿Es super_admin?
    const { data: saRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const isSuperAdmin = !!saRow;

    const { user_id, new_password } = await req.json();

    if (!user_id || !new_password) {
      return json({ error: "Faltan campos: user_id, new_password" }, 400);
    }
    if (new_password.length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
    }

    if (!isSuperAdmin) {
      // Admin de org: verificar que tiene rol admin y que el target es de su org
      const { data: callerMember } = await adminClient
        .from("org_members")
        .select("role, org_id")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!callerMember) return json({ error: "Se requiere rol de administrador" }, 403);

      const { data: targetMember } = await adminClient
        .from("org_members")
        .select("org_id")
        .eq("user_id", user_id)
        .eq("org_id", callerMember.org_id)
        .maybeSingle();

      if (!targetMember) return json({ error: "Usuario no pertenece a tu organización" }, 403);
    }
    // Super admin: sin restricciones de org — puede resetear cualquier usuario

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });
    if (updateError) return json({ error: updateError.message }, 400);

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
