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

    // Verificar rol admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "responsable_sanitario"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Se requiere rol de administrador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, nombre, cargo, role } = await req.json();

    if (!email || !password || !nombre) {
      return new Response(JSON.stringify({ error: "Faltan campos obligatorios (email, password, nombre)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FIX 1: email_confirm: true para que Supabase envíe el correo de confirmación
    // (requiere SMTP externo configurado en el dashboard de Supabase)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ← cambiado de false a true
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

    // FIX 2: UPSERT en lugar de UPDATE
    // El trigger on_auth_user_created ya insertó 'operador'.
    // Con UPDATE + eq("user_id") el filtro sí encuentra el registro,
    // pero si el role actual ES operador y quieres operador no hay problema;
    // si quieres otro rol, el UPDATE funciona — el bug real es que la condición
    // `role !== "operador"` omitía el update para usuarios con rol operador.
    // Solución: siempre hacer UPSERT para garantizar el rol correcto sin importar
    // qué insertó el trigger.
    const targetRole = role || "operador";
    const { error: rErr } = await adminClient.from("user_roles").upsert(
      { user_id: userId, role: targetRole },
      { onConflict: "user_id,role" }, // ← UPSERT: inserta o actualiza
    );

    // Si el trigger ya insertó 'operador' y queremos otro rol,
    // necesitamos eliminar el registro anterior y re-insertar
    if (!rErr && targetRole !== "operador") {
      // Eliminar el rol 'operador' insertado por el trigger
      await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "operador")
        .neq("role", targetRole); // no borrar si el target ES operador
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
