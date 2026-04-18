import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar que el caller esté autenticado
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar rol admin en org_members y obtener org_id
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerMember } = await adminClient
      .from("org_members")
      .select("role, org_id, organizations(max_users)")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!callerMember) {
      return new Response(JSON.stringify({ error: "Se requiere rol de administrador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerOrgId = callerMember.org_id;
    const maxUsers = (callerMember.organizations as any)?.max_users ?? 5;

    // Verificar límite de usuarios de la org
    const { count: currentUsers } = await adminClient
      .from("org_members")
      .select("*", { count: "exact" })
      .eq("org_id", callerOrgId);

    if ((currentUsers ?? 0) >= maxUsers) {
      return new Response(
        JSON.stringify({ error: `Límite de usuarios alcanzado (máx. ${maxUsers})` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { email, password, nombre, cargo, role } = await req.json();

    if (!email || !password || !nombre) {
      return new Response(JSON.stringify({ error: "Faltan campos obligatorios (email, password, nombre)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Actualizar perfil con nombre y cargo
    await adminClient
      .from("profiles")
      .update({ cargo: cargo || "", nombre })
      .eq("id", userId);

    // Insertar en org_members de la misma org del caller
    const targetRole = role || "operador";
    const { error: memberError } = await adminClient
      .from("org_members")
      .insert({ org_id: callerOrgId, user_id: userId, role: targetRole });

    if (memberError) {
      console.error("Error inserting org_member:", memberError.message);
    }

    return new Response(JSON.stringify({ success: true, user: { id: userId } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
