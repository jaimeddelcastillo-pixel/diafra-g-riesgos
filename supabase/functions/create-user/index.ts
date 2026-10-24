import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";
import { enviarYRegistrar } from "../_shared/transactional-email-templates/enviar-y-registrar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES_ORG = ["admin", "responsable_sanitario", "comite_tecnico", "operador", "lectura", "aseguramiento_calidad"];
const ROL_LABEL: Record<string, string> = {
  aseguramiento_calidad: "Aseguramiento de Calidad",
  admin: "Administrador", responsable_sanitario: "Responsable Sanitario",
  comite_tecnico: "Comité Técnico", operador: "Operador", lectura: "Lectura",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Admin = ReturnType<typeof createClient>;

// Lógica única de reactivación (alta con correo desactivado y botón "Reactivar").
async function reactivarUsuario(admin: Admin, p: {
  userId: string; orgId: string | null; role: string | null; callerId: string;
  ip: string | null; password?: string; nombre?: string; metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const upd: Record<string, unknown> = { ban_duration: "none" };
  if (p.password) {
    upd.password = p.password;
    upd.email_confirm = true;
    if (p.nombre) upd.user_metadata = { ...(p.metadata ?? {}), nombre: p.nombre };
  }
  const { error: upErr } = await admin.auth.admin.updateUserById(p.userId, upd as any);
  if (upErr) return `No se pudo reactivar el usuario: ${upErr.message}`;

  await admin.from("profiles").update({
    activo: true, desactivado_en: null, desactivado_por: null, motivo_desactivacion: null,
  } as any).eq("id", p.userId);

  if (p.orgId) {
    const { error: mErr } = await admin.from("org_members")
      .insert({ org_id: p.orgId, user_id: p.userId, role: p.role || "operador" });
    if (mErr && !/duplicate|unique/i.test(mErr.message)) return mErr.message;
  }

  const { error: aErr } = await admin.from("audit_trail").insert({
    accion: "USUARIO_REACTIVADO", tabla: "profiles", registro_id: p.userId,
    org_id: p.orgId, user_id: p.callerId,
    valor_nuevo: { role: p.role || null, org_id: p.orgId },
    ip: p.ip,
  });
  if (aErr) console.error("audit USUARIO_REACTIVADO:", aErr);
  return null;
}

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
    const { data: temporal, error: temporalError } = await callerClient.rpc('requiere_cambio_temporal');
    if (temporalError || temporal) return json({ error: 'Debes cambiar tu contraseña temporal antes de usar la plataforma' }, 403);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const ip = req.headers.get("x-forwarded-for") ?? null;

    const { data: saRow } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();
    const isSuperAdmin = !!saRow;

    const body = await req.json().catch(() => ({}));
    const { email, password, nombre, cargo, role, accion } = body ?? {};

    let orgIdToUse: string | null = null;
    if (isSuperAdmin) {
      // Super admin puede indicar cualquier org_id, o null para crear usuario TRACEA
      orgIdToUse = body?.org_id ?? null;
      if (orgIdToUse && !UUID_RE.test(orgIdToUse)) return json({ error: "org_id inválido" }, 400);
    } else {
      // Admin en su empresa activa (C2b): empresa y rol del servidor
      let ctx;
      try { ctx = await resolverContextoOrg(req); }
      catch (e) { if (e instanceof ContextoOrgError) return json({ error: e.message }, e.status); throw e; }
      if (ctx.soporteLogId) return json({ error: "No disponible en modo soporte" }, 403);
      if (!ctx.puedeAdministrarUsuarios) {
        return json({ error: "Se requiere rol de administrador o Responsable Sanitario en la empresa activa" }, 403);
      }
      orgIdToUse = ctx.orgId;
    }

    const limiteAlcanzado = async (): Promise<string | null> => {
      if (!orgIdToUse || isSuperAdmin) return null;
      const { data: org } = await adminClient.from("organizations").select("max_users").eq("id", orgIdToUse).maybeSingle();
      const maxUsers = (org as any)?.max_users ?? 5;
      const { count } = await adminClient.from("org_members")
        .select("*", { count: "exact", head: true }).eq("org_id", orgIdToUse);
      return (count ?? 0) >= maxUsers ? `Límite de usuarios alcanzado (máx. ${maxUsers})` : null;
    };

    // ── Reactivar desde "Usuarios desactivados" ──────────────────────────────
    if (accion === "reactivar") {
      const targetId: string | undefined = body?.user_id;
      if (!targetId || !UUID_RE.test(targetId)) return json({ error: "Falta user_id" }, 400);
      if (!orgIdToUse) return json({ error: "Indica la organización" }, 400);

      const { data: yaMiembro } = await adminClient.from("org_members").select("id")
        .eq("org_id", orgIdToUse).eq("user_id", targetId).maybeSingle();
      if (yaMiembro) return json({ error: "Ya pertenece a esta empresa" }, 200);

      const lim = await limiteAlcanzado();
      if (lim) return json({ error: lim }, 200);

      // Rol que tenía al desactivarse en esta empresa
      const { data: ev } = await adminClient.from("audit_trail")
        .select("valor_anterior").eq("accion", "USUARIO_DESACTIVADO")
        .eq("org_id", orgIdToUse).eq("registro_id", targetId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const rolPrevio = (ev as any)?.valor_anterior?.rol;
      const rol = ROLES_ORG.includes(rolPrevio) ? rolPrevio : "operador";

      const err = await reactivarUsuario(adminClient, { userId: targetId, orgId: orgIdToUse, role: rol, callerId: caller.id, ip });
      if (err) return json({ error: err }, 200);
      return json({ success: true, user: { id: targetId }, role: rol, reactivado: true });
    }

    if (!email || !password || !nombre) {
      return json({ error: "Faltan campos obligatorios: email, password, nombre" }, 400);
    }
    if (orgIdToUse && role && !ROLES_ORG.includes(role)) return json({ error: "Rol inválido" }, 400);

    const lim = await limiteAlcanzado();
    if (lim) return json({ error: lim }, 403);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nombre },
    });

    let userId: string;
    if (createError) {
      const yaExiste = /already been registered|already registered|email_exists/i.test(createError.message);
      if (!yaExiste) return json({ error: createError.message }, 200);

      const target = String(email).trim().toLowerCase();
      let existing: any = null;
      for (let page = 1; page <= 20 && !existing; page++) {
        const { data: list, error: lErr } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
        if (lErr) return json({ error: lErr.message }, 200);
        existing = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
        if (list.users.length < 1000) break;
      }
      if (!existing) return json({ error: "Ese correo ya está registrado." }, 200);

      if (orgIdToUse) {
        const { data: yaMiembro } = await adminClient.from("org_members").select("id")
          .eq("org_id", orgIdToUse).eq("user_id", existing.id).maybeSingle();
        if (yaMiembro) return json({ error: "Ya pertenece a esta empresa" }, 200);
      }

      const { count: membresias } = await adminClient
        .from("org_members").select("org_id", { count: "exact", head: true }).eq("user_id", existing.id);
      const { data: rolGlobal } = await adminClient
        .from("user_roles").select("role").eq("user_id", existing.id);
      const esSA = (rolGlobal ?? []).some((r: any) => r.role === "super_admin");

      if ((membresias ?? 0) > 0 || (rolGlobal?.length ?? 0) > 0) {
        // ── Parte D: usuario activo → agregar a la empresa activa de quien invita ──
        if (!orgIdToUse) return json({ error: "Este correo ya pertenece a un usuario activo." }, 200);
        if (esSA) return json({ error: "Ese correo pertenece al equipo TRACEA y no se puede agregar a una empresa." }, 200);
        const rol = role || "operador";
        const { error: mErr } = await adminClient.from("org_members")
          .insert({ org_id: orgIdToUse, user_id: existing.id, role: rol });
        if (mErr) {
          if (/duplicate|unique/i.test(mErr.message)) return json({ error: "Ya pertenece a esta empresa" }, 200);
          return json({ error: mErr.message }, 500);
        }
        const { data: org } = await adminClient.from("organizations").select("nombre").eq("id", orgIdToUse).maybeSingle();
        const { data: perfil } = await adminClient.from("profiles").select("nombre").eq("id", existing.id).maybeSingle();
        await adminClient.from("audit_trail").insert({
          accion: "USUARIO_AGREGADO_A_EMPRESA", tabla: "org_members", registro_id: existing.id,
          org_id: orgIdToUse, user_id: caller.id,
          valor_nuevo: { invitado_por: caller.id, org_id: orgIdToUse, org_nombre: (org as any)?.nombre ?? null, rol },
          ip,
        });
        try {
          await enviarYRegistrar({
              templateName: "usuario-agregado-empresa",
              recipientEmail: target,
              idempotencyKey: `agregado-${orgIdToUse}-${existing.id}-${Date.now()}`,
              templateData: {
                nombre: (perfil as any)?.nombre ?? undefined,
                organizacion: (org as any)?.nombre ?? "",
                rol: ROL_LABEL[rol] ?? rol,
                loginUrl: "https://tracea.com.mx/login",
              },
            });
        } catch (e) { console.warn("correo usuario-agregado-empresa:", e); }
        return json({ success: true, user: { id: existing.id }, agregado: true });
      }

      // Usuario desactivado → reactivar con la nueva contraseña
      const err = await reactivarUsuario(adminClient, {
        userId: existing.id, orgId: null, role: role || null, callerId: caller.id, ip,
        password, nombre, metadata: existing.user_metadata ?? {},
      });
      if (err) return json({ error: err }, 200);
      userId = existing.id;
    } else {
      userId = newUser.user.id;
    }

    const { error: temporalErrorNew } = await adminClient.rpc('marcar_password_temporal', { _usuario: userId, _org: orgIdToUse, _actor: caller.id });
    if (temporalErrorNew) return json({ error: 'No se pudo activar el cambio obligatorio de contraseña' }, 500);
    await adminClient.from("profiles").update({ nombre, cargo: cargo || "" }).eq("id", userId);

    if (orgIdToUse) {
      const { error: memberError } = await adminClient
        .from("org_members")
        .insert({ org_id: orgIdToUse, user_id: userId, role: role || "operador" });
      if (memberError) {
        if (!createError) await adminClient.auth.admin.deleteUser(userId);
        return json({ error: memberError.message }, 500);
      }
    } else {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: role || "super_admin" });
      if (roleError) {
        if (!createError) await adminClient.auth.admin.deleteUser(userId);
        return json({ error: roleError.message }, 500);
      }
    }

    return json({ success: true, user: { id: userId } });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
