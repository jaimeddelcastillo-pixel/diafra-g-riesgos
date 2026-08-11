// Importación del Listado Maestro de Documentos.
// El parseo ocurre en el cliente; aquí solo se validan permisos y se persiste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const FORMATOS = ["xlsx", "csv", "txt", "md", "docx", "pdf"];
const LOTE = 100;

function normalizar(s: string) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. JWT válido
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "no_autenticado" }, 401);
  const userId = userData.user.id;

  // 2. org_id desde org_members — nunca del frontend
  const { data: member } = await admin
    .from("org_members").select("org_id, role").eq("user_id", userId).maybeSingle();

  const { data: superRow } = await admin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  const esSuper = !!superRow;

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "payload_invalido" }, 400);

  const orgId = member?.org_id ?? (esSuper ? body.org_id : null);
  if (!orgId) return json({ error: "sin_organizacion" }, 403);

  // 3. Rol autorizado
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const lista = new Set<string>([...(roles ?? []).map((r: any) => r.role), member?.role].filter(Boolean) as string[]);
  const autorizado = esSuper || lista.has("admin") || lista.has("responsable_sanitario");
  if (!autorizado) return json({ error: "sin_permiso" }, 403);

  // 4. Feature del Cerebro activa
  const { data: feature } = await admin
    .from("organization_features").select("activo, expira_en")
    .eq("org_id", orgId).eq("feature_key", "institutional_brain").maybeSingle();
  const { data: org } = await admin.from("organizations").select("plan").eq("id", orgId).maybeSingle();
  const planIncluye = ["professional", "enterprise"].includes(org?.plan ?? "");
  const featureActiva = !!feature?.activo && (!feature.expira_en || new Date(feature.expira_en) > new Date());
  if (!esSuper && !planIncluye && !featureActiva) return json({ error: "feature_inactiva" }, 403);

  const accion = body.accion ?? "importar";

  // Acción previa: crear el batch y devolver URL firmada para subir el archivo original.
  if (accion === "preparar") {
    const formato = String(body.formato ?? "");
    if (!FORMATOS.includes(formato)) return json({ error: "formato_invalido" }, 400);
    const nombreArchivo = String(body.nombre_archivo ?? "listado.xlsx").slice(0, 200);
    const { data: batch, error } = await admin.from("brain_import_batches").insert({
      org_id: orgId,
      nombre_archivo: nombreArchivo,
      formato,
      estado: "pendiente",
      imported_by: userId,
      total_filas: Number(body.total_filas ?? 0),
      mapeo: body.mapeo ?? {},
    }).select("id").single();
    if (error) return json({ error: "no_se_pudo_crear_batch", detalle: error.message }, 500);

    const path = `${orgId}/${batch.id}/${nombreArchivo.replace(/[^\w.\-]/g, "_")}`;
    const { data: signed } = await admin.storage.from("brain-imports").createSignedUploadUrl(path);
    await admin.from("brain_import_batches").update({ storage_path: path }).eq("id", batch.id);
    return json({ batch_id: batch.id, upload: signed ?? null, storage_path: path });
  }

  // Importación efectiva
  const batchId = String(body.batch_id ?? "");
  if (!batchId) return json({ error: "batch_requerido" }, 400);
  const { data: batch } = await admin
    .from("brain_import_batches").select("id, org_id, estado").eq("id", batchId).maybeSingle();
  if (!batch || batch.org_id !== orgId) return json({ error: "batch_fuera_de_org" }, 403);
  if (batch.estado !== "pendiente") return json({ error: "batch_ya_procesado" }, 409);

  await admin.from("brain_import_batches").update({ estado: "procesando", mapeo: body.mapeo ?? {} }).eq("id", batchId);

  const registros: any[] = Array.isArray(body.registros) ? body.registros : [];
  if (registros.length > 2000) return json({ error: "demasiadas_filas" }, 400);

  // Segunda verificación de duplicados contra la base
  const { data: existentes } = await admin
    .from("brain_documents").select("id, nombre, codigo, revision").eq("org_id", orgId);
  const porCodigoRev = new Set(
    (existentes ?? []).filter((d: any) => d.codigo)
      .map((d: any) => `${normalizar(d.codigo)}|${normalizar(d.revision ?? "")}`),
  );

  // Áreas: crear o vincular
  const areaPorNombre = new Map<string, string>();
  const { data: areasExistentes } = await admin.from("brain_areas").select("id, nombre").eq("org_id", orgId);
  for (const a of areasExistentes ?? []) areaPorNombre.set(normalizar(a.nombre), a.id);

  const areasCreadas: string[] = [];
  for (const a of (body.areas_a_crear ?? []) as any[]) {
    const clave = normalizar(a.nombre ?? "");
    if (!clave || areaPorNombre.has(clave)) continue;
    const { data: nueva } = await admin.from("brain_areas")
      .insert({ org_id: orgId, nombre: String(a.nombre).slice(0, 200) }).select("id").single();
    if (nueva) { areaPorNombre.set(clave, nueva.id); areasCreadas.push(nueva.id); }
  }

  const procesosCreados: string[] = [];
  for (const p of (body.procesos_a_crear ?? []) as any[]) {
    if (!p?.nombre) continue;
    const { data: nuevo } = await admin.from("brain_processes")
      .insert({ org_id: orgId, nombre: String(p.nombre).slice(0, 200), descripcion: p.evidencia ?? null })
      .select("id").single();
    if (nuevo) procesosCreados.push(nuevo.id);
  }

  // Propuestas pendientes (nunca se crean automáticamente)
  const propuestas = ((body.propuestas_pendientes ?? []) as any[]).map((p) => ({
    org_id: orgId,
    batch_id: batchId,
    tipo: p.tipo === "area" ? "area" : "proceso",
    nombre: String(p.nombre ?? "").slice(0, 200),
    evidencia: p.evidencia ?? null,
    nivel_confianza: p.nivel_confianza === "explicito" ? "explicito" : "inferido",
  })).filter((p) => p.nombre);
  if (propuestas.length > 0) await admin.from("brain_import_propuestas").insert(propuestas);

  let importados = 0;
  let duplicados = 0;
  const errores: { fila: number; error: string }[] = [];

  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = registros.slice(i, i + LOTE);
    const filas = lote.map((r) => {
      const clave = r.codigo ? `${normalizar(r.codigo)}|${normalizar(r.revision ?? "")}` : "";
      if (clave && porCodigoRev.has(clave)) { duplicados++; return null; }
      if (clave) porCodigoRev.add(clave);
      return {
        org_id: orgId,
        nombre: String(r.nombre ?? "").slice(0, 500),
        tipo: r.tipo ? String(r.tipo).slice(0, 100) : "documento",
        codigo: r.codigo ?? null,
        revision: r.revision ?? null,
        estado: r.estado ? String(r.estado).slice(0, 60) : "vigente",
        area_id: r.area ? areaPorNombre.get(normalizar(r.area)) ?? null : null,
        notas: r.responsable ? `Responsable: ${r.responsable}` : null,
        origen: "listado_maestro",
        import_batch_id: batchId,
        import_row_reference: r.fila ?? null,
        import_status: r.clasificacion === "posible_actualizacion" ? "actualizado"
          : r.clasificacion === "requiere_revision" ? "revisar" : "nuevo",
      };
    }).filter(Boolean);

    if (filas.length === 0) continue;
    const { error } = await admin.from("brain_documents").insert(filas as any[]);
    if (error) {
      errores.push({ fila: lote[0]?.fila ?? i, error: error.message });
    } else {
      importados += filas.length;
    }
  }

  const estado = errores.length > 0 ? "parcial" : "completado";
  await admin.from("brain_import_batches").update({
    estado,
    filas_importadas: importados,
    total_filas: registros.length,
  }).eq("id", batchId);

  return json({
    batch_id: batchId, importados, duplicados,
    errores, estado,
    areas_creadas: areasCreadas.length, procesos_creados: procesosCreados.length,
    propuestas: propuestas.length,
  });
});
