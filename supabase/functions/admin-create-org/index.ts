// admin-create-org: super_admin crea organización + usuario admin inicial.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "No autorizado" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: saRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!saRow) return json({ error: "Solo super_admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const {
      org_nombre,
      org_slug,
      norma_aplicable = "NOM-241",
      plan = "trial",
      trial_dias = 14,
      max_users = 5,
      admin_email,
      admin_nombre,
      admin_password,
      admin_cargo = "",
    } = body ?? {};

    if (!org_nombre?.trim() || !org_slug?.trim()) {
      return json({ error: "Falta nombre o slug de la organización" }, 400);
    }
    if (!admin_email || !admin_password || !admin_nombre) {
      return json({ error: "Faltan datos del administrador (email, password, nombre)" }, 400);
    }
    if (!["NOM-241", "NOM-059", "MULTI"].includes(norma_aplicable)) {
      return json({ error: "norma_aplicable inválida" }, 400);
    }
    const metodologia =
      norma_aplicable === "NOM-059" ? "ICH-Q9" : norma_aplicable === "MULTI" ? "MULTI" : "AMEF";

    // Slug único
    const { data: slugCheck } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", org_slug.trim())
      .maybeSingle();
    if (slugCheck) return json({ error: "El identificador de empresa ya está en uso" }, 409);

    // Crear organización (activa, trial estándar). Super_admin la deja lista para demo.
    const trialExpires =
      plan === "trial"
        ? new Date(Date.now() + Number(trial_dias) * 86_400_000).toISOString()
        : null;

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        nombre: org_nombre.trim(),
        slug: org_slug.trim(),
        plan,
        activo: true,
        estado: "activo",
        norma_aplicable,
        metodologia,
        max_users: Math.max(1, Number(max_users)),
        trial_expires_at: trialExpires,
        subscription_status: plan === "trial" ? "trial" : "active",
      })
      .select()
      .single();
    if (orgErr) return json({ error: orgErr.message }, 500);

    // Crear o reutilizar usuario admin
    let userId: string | null = null;
    let reused = false;
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: { nombre: admin_nombre },
    });
    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        (createError as any).code === "email_exists";
      if (!alreadyExists) {
        await admin.from("organizations").delete().eq("id", org.id);
        return json({ error: createError.message }, 400);
      }
      // Buscar usuario existente por email
      const { data: existing, error: lookupErr } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", admin_email)
        .maybeSingle();
      if (lookupErr || !existing) {
        await admin.from("organizations").delete().eq("id", org.id);
        return json({
          error:
            "Ese correo ya existe en el sistema pero no se pudo localizar el perfil. Pide al usuario que inicie sesión una vez para crear su perfil, o usa otro correo.",
        }, 409);
      }
      userId = existing.id;
      reused = true;
    } else {
      userId = newUser!.user.id;
    }

    await admin
      .from("profiles")
      .update({ nombre: admin_nombre, cargo: admin_cargo })
      .eq("id", userId!);

    const { error: memberErr } = await admin
      .from("org_members")
      .upsert(
        { org_id: org.id, user_id: userId!, role: "admin" },
        { onConflict: "user_id,org_id" },
      );
    if (memberErr) {
      if (!reused) await admin.auth.admin.deleteUser(userId!);
      await admin.from("organizations").delete().eq("id", org.id);
      return json({ error: memberErr.message }, 500);
    }

    // Promover a admin en user_roles y quitar el 'operador' del trigger
    await admin
      .from("user_roles")
      .upsert({ user_id: userId!, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    await admin.from("user_roles").delete().eq("user_id", userId!).eq("role", "operador");

    return json({ success: true, org_id: org.id, user_id: userId, reused });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});