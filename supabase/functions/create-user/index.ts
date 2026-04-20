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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verificar que el caller está autenticado
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "No autorizado" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ¿Es super_admin?
    const { data: saRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const isSuperAdmin = !!saRow;

    let orgIdToUse: string | null = null;

    if (isSuperAdmin) {
      // Super admin puede indicar cualquier org_id, o null para crear usuario TRACEA
      const body = await req.json();
      var { email, password, nombre, cargo, role, org_id } = body ?? {};
      orgIdToUse = org_id ?? null;
    } else {
      // Admin de org: debe tener org_members.role = admin
      const { data: callerMember } = await adminClient
        .from("org_members")
        .select("role, org_id, organizations(max_users)")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!callerMember) return json({ error: "Se requiere rol de administrador" }, 403);

      orgIdToUse = callerMember.org_id;
      const maxUsers = (callerMember.organizations as any)?.max_users ?? 5;

      const { count: currentUsers } = await adminClient
        .from("org_members")
        .select("*", { count: "exact" })
        .eq("org_id", orgIdToUse);

      if ((currentUsers ?? 0) >= maxUsers) {
        return json({ error: `Límite de usuarios alcanzado (máx. ${maxUsers})` }, 403);
      }

      const body = await req.json();
      var { email, password, nombre, cargo, role } = body ?? {};
    }

    if (!email || !password || !nombre) {
      return json({ error: "Faltan campos obligatorios: email, password, nombre" }, 400);
    }

    // Crear usuario en auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (createError) return json({ error: createError.message }, 400);

    const userId = newUser.user.id;

    // Actualizar perfil
    await adminClient
      .from("profiles")
      .update({ nombre, cargo: cargo || "" })
      .eq("id", userId);

    if (orgIdToUse) {
      // Usuario de organización → org_members
      const { error: memberError } = await adminClient
        .from("org_members")
        .insert({ org_id: orgIdToUse, user_id: userId, role: role || "operador" });
      if (memberError) {
        await adminClient.auth.admin.deleteUser(userId);
        return json({ error: memberError.message }, 500);
      }
    } else {
      // Usuario TRACEA → user_roles (sin org)
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: role || "super_admin" });
      if (roleError) {
        await adminClient.auth.admin.deleteUser(userId);
        return json({ error: roleError.message }, 500);
      }
    }

    return json({ success: true, user: { id: userId } });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
