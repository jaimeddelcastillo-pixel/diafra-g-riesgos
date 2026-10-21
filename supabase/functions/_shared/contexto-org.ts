// Fuente única de empresa y rol para edge functions (C2a).
// Nunca acepta la empresa desde body, encabezados ni respuesta del modelo.
import { createClient } from "npm:@supabase/supabase-js@2";

export interface ContextoOrg {
  userId: string;
  email: string;
  orgId: string;
  rolEnOrg: string | null;
  esSuperAdmin: boolean;
  soporteLogId: string | null;
  rolesEfectivos: string[];
  puedeAdministrarUsuarios: boolean;
}

export class ContextoOrgError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function resolverContextoOrg(req: Request): Promise<ContextoOrg> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new ContextoOrgError("No autorizado", 401);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) throw new ContextoOrgError("No autorizado", 401);

  const { data, error } = await userClient.rpc("contexto_org_actual");
  if (error) throw new ContextoOrgError("No se pudo resolver la organización", 500);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.org_id) throw new ContextoOrgError("Usuario sin organización", 403);
  const [{ data: roles, error: rolesError }, { data: administrar, error: administrarError }] = await Promise.all([
    userClient.rpc('mis_roles_efectivos'), userClient.rpc('puede_administrar_usuarios'),
  ]);
  if (rolesError || administrarError) throw new ContextoOrgError('No se pudieron resolver los permisos vigentes', 500);

  return {
    userId: user.id,
    email: user.email ?? "",
    orgId: row.org_id,
    rolEnOrg: row.rol_en_org ?? null,
    esSuperAdmin: !!row.es_super_admin,
    soporteLogId: row.soporte_log_id ?? null,
    rolesEfectivos: roles ?? [],
    puedeAdministrarUsuarios: administrar === true,
  };
}
