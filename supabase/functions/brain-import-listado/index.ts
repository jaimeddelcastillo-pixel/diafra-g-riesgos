// Importación del Listado Maestro de Documentos.
// El parseo ocurre en el cliente; aquí solo se validan permisos y se persiste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolverContextoOrg, ContextoOrgError } from "../_shared/contexto-org.ts";

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

  // 1-2. JWT + empresa/rol desde contexto_org_actual — nunca del frontend
  let ctx;
  try {
    ctx = await resolverContextoOrg(req);
  } catch (e) {
    const err = e as ContextoOrgError;
    const code = err.status === 401 ? "no_autenticado" : err.status === 403 ? "sin_organizacion" : "error_contexto";
    return json({ error: code }, err.status ?? 500);
  }
  const userId = ctx.userId;
  const orgId = ctx.orgId;
  const esSuper = ctx.esSuperAdmin;

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "payload_invalido" }, 400);

  // 3. Rol autorizado (rol local en la empresa, no user_roles)
  const autorizado = esSuper || ctx.rolEnOrg === "admin" || ctx.rolEnOrg === "responsable_sanitario";
  if (!autorizado) return json({ error: "sin_permiso" }, 403);

  // 4. Módulo del Cerebro (decisión única en org_tiene_modulo)
  const { data: tieneModulo } = await admin.rpc("org_tiene_modulo", {
    _org: orgId, _modulo: "institutional_brain",
  });
  if (!esSuper && !tieneModulo) return json({ error: "feature_inactiva" }, 403);

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
      actualizado_por: userId,
      total_filas: Number(body.total_filas ?? 0),
      mapeo: body.mapeo ?? {},
    }).select("id").single();
    if (error) return json({ error: "no_se_pudo_crear_batch", detalle: error.message }, 500);

    const path = `${orgId}/${batch.id}/${nombreArchivo.replace(/[^\w.\-]/g, "_")}`;
    const { data: signed } = await admin.storage.from("brain-imports").createSignedUploadUrl(path);
    await admin.from("brain_import_batches").update({ storage_path: path, actualizado_por: userId }).eq("id", batch.id);
    return json({ batch_id: batch.id, upload: signed ?? null, storage_path: path });
  }

  // Reversión controlada: nunca elimina conocimiento institucional.
  if (accion === "revertir") {
    const bid = String(body.batch_id ?? "");
    const { data: b } = await admin
      .from("brain_import_batches").select("id, org_id").eq("id", bid).maybeSingle();
    if (!b || b.org_id !== orgId) return json({ error: "batch_fuera_de_org" }, 403);

    const { data: docsBatch } = await admin
      .from("brain_documents").select("id").eq("import_batch_id", bid);
    const ids = (docsBatch ?? []).map((d: any) => d.id);
    if (ids.length === 0) {
      // Batch sin documentos (importación fallida o vacía): solo se cierra como revertido.
      if (body.solo_diagnostico) return json({ total: 0, referenciados: 0, eliminables: 0, vacio: true });
      await admin.from("brain_import_batches").update({ estado: "revertido", filas_importadas: 0, actualizado_por: userId }).eq("id", bid);
      return json({ eliminados: 0, conservados: 0, procesos_eliminados: 0, procesos_conservados: 0, vacio: true });
    }

    const { data: refs, error: refsErr } = await admin
      .from("brain_knowledge_sources").select("documento_id").in("documento_id", ids);
    if (refsErr) {
      return json({ error: "no_se_pudo_verificar_referencias", detalle: refsErr.message }, 500);
    }
    const referenciados = new Set((refs ?? []).map((r: any) => r.documento_id));
    const eliminables = ids.filter((id) => !referenciados.has(id));

    if (body.solo_diagnostico) {
      return json({ total: ids.length, referenciados: referenciados.size, eliminables: eliminables.length });
    }
    if (eliminables.length === 0) {
      return json({ error: "todos_referenciados", total: ids.length }, 409);
    }

    // Áreas/procesos creados por el batch: solo si quedaron sin referencias.
    const { data: props } = await admin
      .from("brain_import_propuestas").select("area_id, proceso_id").eq("batch_id", bid);

    // C3: evento de resumen a nombre de quien pidió la reversión, antes de borrar.
    const { error: audErr } = await admin.from("audit_trail").insert({
      user_id: userId,
      org_id: orgId,
      tabla: "brain_import_batches",
      registro_id: bid,
      accion: "IMPORTACION_REVERTIDA",
      valor_nuevo: {
        batch_id: bid,
        documentos_a_borrar: eliminables,
        documentos_conservados: ids.filter((id) => referenciados.has(id)),
        areas_candidatas: [...new Set((props ?? []).map((p: any) => p.area_id).filter(Boolean))],
        procesos_candidatos: [...new Set((props ?? []).map((p: any) => p.proceso_id).filter(Boolean))],
      },
    });
    if (audErr) return json({ error: "no_se_pudo_registrar_auditoria", detalle: audErr.message }, 500);

    await admin.from("brain_documents").delete().in("id", eliminables);

    const tieneRef = async (tabla: string, columna: string, valor: string) => {
      const { count } = await admin.from(tabla)
        .select("id", { count: "exact", head: true }).eq(columna, valor);
      return (count ?? 0) > 0;
    };

    let procesosEliminados = 0;
    let procesosConservados = 0;
    const procesosVistos = new Set<string>();

    for (const p of props ?? []) {
      if (p.area_id) {
        if (!(await tieneRef("brain_documents", "area_id", p.area_id))) {
          await admin.from("brain_areas").delete().eq("id", p.area_id);
        }
      }
      if (p.proceso_id && !procesosVistos.has(p.proceso_id)) {
        procesosVistos.add(p.proceso_id);
        const pid = p.proceso_id;
        const referenciado =
          (await tieneRef("brain_session_processes", "process_id", pid)) ||
          (await tieneRef("brain_assignment_processes", "process_id", pid)) ||
          (await tieneRef("brain_knowledge_items", "proceso_id", pid)) ||
          (await tieneRef("brain_gaps", "proceso_id", pid)) ||
          (await tieneRef("brain_contradictions", "proceso_id", pid)) ||
          (await tieneRef("brain_documents", "proceso_id", pid));
        if (referenciado) {
          procesosConservados++;
        } else {
          const { error: delErr } = await admin.from("brain_processes").delete().eq("id", pid);
          if (delErr) procesosConservados++;
          else procesosEliminados++;
        }
      }
    }

    const restantes = ids.length - eliminables.length;
    await admin.from("brain_import_batches").update({
      estado: restantes === 0 ? "revertido" : "parcial",
      filas_importadas: restantes,
      actualizado_por: userId,
    }).eq("id", bid);

    return json({
      eliminados: eliminables.length,
      conservados: restantes,
      procesos_eliminados: procesosEliminados,
      procesos_conservados: procesosConservados,
    });
  }

  // Importación efectiva
  const batchId = String(body.batch_id ?? "");
  if (!batchId) return json({ error: "batch_requerido" }, 400);
  const { data: batch } = await admin
    .from("brain_import_batches").select("id, org_id, estado").eq("id", batchId).maybeSingle();
  if (!batch || batch.org_id !== orgId) return json({ error: "batch_fuera_de_org" }, 403);
  if (batch.estado !== "pendiente") return json({ error: "batch_ya_procesado" }, 409);

  await admin.from("brain_import_batches").update({ estado: "procesando", mapeo: body.mapeo ?? {}, actualizado_por: userId }).eq("id", batchId);

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
        actualizado_por: userId,
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
    actualizado_por: userId,
  }).eq("id", batchId);

  return json({
    batch_id: batchId, importados, duplicados,
    errores, estado,
    areas_creadas: areasCreadas.length, procesos_creados: procesosCreados.length,
    propuestas: propuestas.length,
  });
});
