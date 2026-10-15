CREATE OR REPLACE FUNCTION public.auditor_persona(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_id IS NULL THEN NULL ELSE
    (SELECT jsonb_build_object('nombre', p.nombre, 'cargo', p.cargo) FROM public.profiles p WHERE p.id = p_id) END
$$;
REVOKE ALL ON FUNCTION public.auditor_persona(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auditor_ver_item(p_item_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE acc jsonb; v_ent uuid; v_tipo text; v_org uuid; datos jsonb; v_orgj jsonb;
BEGIN
  acc := public.auditoria_validar_acceso(auth.uid(), p_item_id);
  v_ent := (acc->>'entidad_id')::uuid; v_tipo := acc->>'tipo'; v_org := (acc->>'org_id')::uuid;
  SELECT jsonb_build_object('nombre', o.nombre, 'razon_social', o.razon_social, 'rfc', o.rfc, 'logo_url', o.logo_url,
           'codigo_formato', o.codigo_formato, 'version_formato', o.version_formato)
    INTO v_orgj FROM public.organizations o WHERE o.id = v_org;

  IF v_tipo = 'folio' THEN
    SELECT jsonb_build_object(
      'folio', to_jsonb(f) - ARRAY['created_by','cancelado_por'],
      'org', v_orgj,
      'riesgos', coalesce((SELECT jsonb_agg(to_jsonb(r) - 'anexos' ORDER BY r.numero_id NULLS LAST, r.created_at)
                  FROM public.riesgos r WHERE r.folio_id = f.id), '[]'::jsonb),
      'comite', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'folio_id', c.folio_id, 'user_id', c.user_id,
                  'nombre', c.nombre, 'cargo', c.cargo, 'responsabilidad', c.responsabilidad,
                  'firmado', c.firmado, 'fecha_firma', c.fecha_firma, 'texto_compromiso', c.texto_compromiso,
                  'hash_documento', c.hash_documento, 'created_at', c.created_at) ORDER BY c.created_at)
                  FROM public.folio_comite c WHERE c.folio_id = f.id), '[]'::jsonb),
      'votos', coalesce((SELECT jsonb_agg(jsonb_build_object('persona', p.nombre, 'voto', v.voto,
                  'comentario', v.comentario, 'fecha', v.updated_at) ORDER BY v.created_at)
                  FROM public.comite_votos v LEFT JOIN public.profiles p ON p.id = v.user_id WHERE v.folio_id = f.id), '[]'::jsonb),
      'versiones', coalesce((SELECT jsonb_agg(jsonb_build_object('version', fv.version, 'motivo_revision', fv.motivo_revision,
                  'created_at', fv.created_at, 'realizado_por', p.nombre) ORDER BY fv.created_at)
                  FROM public.folio_versiones fv LEFT JOIN public.profiles p ON p.id = fv.creado_por WHERE fv.folio_id = f.id), '[]'::jsonb),
      'evidencias', CASE WHEN (acc->>'incluir_evidencias')::boolean THEN coalesce((
                  SELECT jsonb_agg(jsonb_build_object('riesgo_numero', r.numero_id, 'nombre', e->>'name', 'path', e->>'path',
                    'es_pdf', lower(coalesce(e->>'path','')) LIKE '%.pdf') ORDER BY r.numero_id)
                  FROM public.riesgos r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.anexos,'[]'::jsonb)) e
                  WHERE r.folio_id = f.id AND jsonb_typeof(r.anexos) = 'array'), '[]'::jsonb) ELSE NULL END)
      INTO datos FROM public.folios f WHERE f.id = v_ent AND f.org_id = v_org;
  ELSIF v_tipo = 'documento' THEN
    SELECT jsonb_build_object(
      'nombre', d.nombre, 'nombre_archivo', d.nombre_archivo_original, 'tipo', coalesce(d.tipo_clave, d.tipo),
      'version', d.version, 'clasificacion', d.clasificacion, 'copia_no_controlada', d.copia_no_controlada,
      'sha256', coalesce(d.sha256_servidor, d.sha256), 'sha256_verificado_en', d.sha256_verificado_en,
      'mime_type', d.mime_type, 'size_bytes', d.size_bytes, 'retirado_en', d.retirado_en,
      'es_pdf', (d.mime_type = 'application/pdf' OR lower(coalesce(d.storage_path,'')) LIKE '%.pdf'),
      'registro', (SELECT jsonb_build_object('codigo', b.codigo, 'revision', b.revision, 'estado', b.estado, 'nombre', b.nombre)
                   FROM public.brain_documents b WHERE b.archivo_id = d.id AND b.org_id = d.org_id ORDER BY b.updated_at DESC LIMIT 1))
      INTO datos FROM public.org_documentos d WHERE d.id = v_ent AND d.org_id = v_org;
  ELSE
    SELECT jsonb_build_object(
      'contenido', k.contenido, 'tipo', k.tipo, 'estado', k.estado, 'org', v_orgj,
      'area', (SELECT a.nombre FROM public.brain_areas a WHERE a.id = k.area_id),
      'proceso', (SELECT pr.nombre FROM public.brain_processes pr WHERE pr.id = k.proceso_id),
      'validado_por', (SELECT p.nombre FROM public.profiles p WHERE p.id = k.validado_por),
      'validado', public.auditor_persona(k.validado_por) || jsonb_build_object('fecha', k.validado_en),
      'propuso', coalesce(
          (SELECT public.auditor_persona(t.user_id) || jsonb_build_object('fecha', t.created_at)
             FROM public.audit_trail t WHERE t.tabla = 'brain_knowledge_items' AND t.registro_id = k.id::text
              AND t.accion = 'INSERT' AND t.user_id IS NOT NULL ORDER BY t.created_at LIMIT 1),
          (SELECT public.auditor_persona(x.solicitado_por) || jsonb_build_object('fecha', k.created_at, 'via', 'Extracción de documento')
             FROM public.brain_knowledge_sources s JOIN public.brain_extracciones x ON x.id = s.extraccion_id
            WHERE s.knowledge_item_id = k.id AND x.solicitado_por IS NOT NULL LIMIT 1),
          (SELECT jsonb_build_object('nombre', coalesce(ses.entrevistado_nombre, pe.nombre), 'cargo', coalesce(ses.entrevistado_puesto, pe.cargo),
                    'fecha', k.created_at, 'via', 'Entrevista')
             FROM public.brain_knowledge_sources s JOIN public.brain_interview_sessions ses ON ses.id = s.session_id
             LEFT JOIN public.profiles pe ON pe.id = ses.entrevistado_profile_id
            WHERE s.knowledge_item_id = k.id LIMIT 1),
          jsonb_build_object('nombre', NULL, 'cargo', NULL, 'fecha', k.created_at)),
      'validado_en', k.validado_en,
      'historial', coalesce((SELECT jsonb_agg(h ORDER BY h->>'fecha') FROM (
          SELECT jsonb_build_object('fecha', t.created_at, 'estado', t.valor_nuevo->>'estado',
                   'por', (SELECT p.nombre FROM public.profiles p WHERE p.id = t.user_id)) h
            FROM public.audit_trail t
           WHERE t.tabla = 'brain_knowledge_items' AND t.registro_id = k.id::text
             AND (t.accion = 'INSERT' OR (t.valor_nuevo->>'estado') IS DISTINCT FROM (t.valor_anterior->>'estado'))
             AND t.valor_nuevo ? 'estado') q), '[]'::jsonb),
      'fuentes', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo_fuente', s.tipo_fuente, 'nombre_fuente', s.nombre_fuente,
                  'documento_nombre', bd.nombre,
                  'documento_codigo', coalesce(s.documento_codigo, bd.codigo), 'documento_revision', coalesce(s.documento_revision, bd.revision),
                  'pagina', s.pagina, 'parrafo', s.parrafo, 'seccion', s.seccion, 'cita_textual', s.cita_textual) ORDER BY s.created_at)
                  FROM public.brain_knowledge_sources s LEFT JOIN public.brain_documents bd ON bd.id = s.documento_id
                  WHERE s.knowledge_item_id = k.id), '[]'::jsonb))
      INTO datos FROM public.brain_knowledge_items k WHERE k.id = v_ent AND k.org_id = v_org AND k.estado = 'validado';
  END IF;
  IF datos IS NULL THEN RAISE EXCEPTION 'El ítem ya no está disponible' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (auth.uid(), v_org, 'auditoria_items', p_item_id::text, 'AUDITOR_CONSULTO',
          jsonb_build_object('auditoria_id', acc->>'auditoria_id', 'tipo', v_tipo, 'entidad_id', v_ent));

  RETURN jsonb_build_object('item_id', p_item_id, 'tipo', v_tipo, 'auditoria_id', acc->>'auditoria_id',
    'permite_descarga', (acc->>'permite_descarga')::boolean, 'expediente', acc->>'nombre',
    'auditor', acc->>'auditor_nombre', 'datos', datos);
END $function$;

-- Registro de PDF generado en el navegador (folio o ficha de conocimiento).
CREATE OR REPLACE FUNCTION public.auditor_registrar_pdf_generado(p_item_id uuid, p_descargar boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE acc jsonb; v_arch text; v_ahora timestamptz := now();
BEGIN
  acc := public.auditoria_validar_acceso(auth.uid(), p_item_id);
  IF acc->>'tipo' NOT IN ('folio','conocimiento') THEN RAISE EXCEPTION 'Este ítem no genera PDF' USING ERRCODE = '22023'; END IF;
  IF p_descargar AND NOT (acc->>'permite_descarga')::boolean THEN RAISE EXCEPTION 'Este expediente no permite descargas' USING ERRCODE = '42501'; END IF;
  IF acc->>'tipo' = 'folio' THEN
    SELECT 'PDF del folio ' || coalesce(codigo,'') INTO v_arch FROM public.folios WHERE id = (acc->>'entidad_id')::uuid;
  ELSE v_arch := 'Ficha de conocimiento institucional'; END IF;
  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (auth.uid(), (acc->>'org_id')::uuid, 'auditoria_items', p_item_id::text,
          CASE WHEN p_descargar THEN 'AUDITOR_DESCARGO' ELSE 'AUDITOR_CONSULTO' END,
          jsonb_build_object('auditoria_id', acc->>'auditoria_id', 'tipo', acc->>'tipo', 'entidad_id', acc->>'entidad_id',
                             'archivo', v_arch, 'sha256', NULL, 'modo', CASE WHEN p_descargar THEN 'descarga' ELSE 'vista_pdf' END));
  RETURN jsonb_build_object('expediente', acc->>'nombre', 'auditor', acc->>'auditor_nombre', 'fecha', v_ahora);
END $function$;
REVOKE ALL ON FUNCTION public.auditor_registrar_pdf_generado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditor_registrar_pdf_generado(uuid, boolean) TO authenticated;

-- Carátula e índice del expediente.
CREATE OR REPLACE FUNCTION public.auditor_caratula(p_auditoria_id uuid, p_descargar boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; res jsonb;
BEGIN
  SELECT * INTO a FROM public.auditorias_externas x
   WHERE x.id = p_auditoria_id AND x.auditor_user_id = auth.uid() AND x.estado = 'activo'
     AND now() >= x.inicia_en AND now() < x.expira_en;
  IF a IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Sin acceso vigente a este expediente' USING ERRCODE = '42501'; END IF;
  IF p_descargar AND NOT a.permite_descarga THEN RAISE EXCEPTION 'Este expediente no permite descargas' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'org', (SELECT jsonb_build_object('nombre', o.nombre, 'razon_social', o.razon_social, 'rfc', o.rfc, 'logo_url', o.logo_url,
              'codigo_formato', o.codigo_formato, 'version_formato', o.version_formato) FROM public.organizations o WHERE o.id = a.org_id),
    'expediente', a.nombre, 'auditor', a.auditor_nombre, 'auditor_organizacion', a.auditor_organizacion,
    'inicia_en', a.inicia_en, 'expira_en', a.expira_en, 'permite_descarga', a.permite_descarga,
    'preparo', public.auditor_persona(a.creado_por) || jsonb_build_object('fecha', a.created_at),
    'activo', public.auditor_persona(a.activado_por) || jsonb_build_object('fecha', a.activado_en),
    'fecha', now(),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', i.tipo, 'item_id', i.id) ||
        CASE i.tipo
          WHEN 'folio' THEN (SELECT jsonb_build_object('codigo', f.codigo, 'titulo', f.proceso_equipo, 'revision', coalesce(f.numero_version,'1.0'), 'estado', f.estado)
                             FROM public.folios f WHERE f.id = i.entidad_id)
          WHEN 'documento' THEN (SELECT jsonb_build_object('codigo', bd.codigo, 'titulo', d.nombre, 'revision', coalesce(bd.revision, d.version),
                                   'estado', coalesce(bd.estado, CASE WHEN d.retirado_en IS NOT NULL THEN 'Retirado' END),
                                   'sha256', coalesce(d.sha256_servidor, d.sha256))
                                 FROM public.org_documentos d
                                 LEFT JOIN LATERAL (SELECT b.codigo, b.revision, b.estado FROM public.brain_documents b WHERE b.archivo_id = d.id ORDER BY b.updated_at DESC LIMIT 1) bd ON true
                                 WHERE d.id = i.entidad_id)
          ELSE (SELECT jsonb_build_object('codigo', NULL, 'titulo', left(k.contenido, 160), 'revision', NULL, 'estado', k.estado)
                FROM public.brain_knowledge_items k WHERE k.id = i.entidad_id) END
      ORDER BY i.tipo, i.created_at) FROM public.auditoria_items i WHERE i.auditoria_id = a.id), '[]'::jsonb)
  ) INTO res;
  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (auth.uid(), a.org_id, 'auditorias_externas', a.id::text,
          CASE WHEN p_descargar THEN 'AUDITOR_DESCARGO' ELSE 'AUDITOR_CONSULTO' END,
          jsonb_build_object('auditoria_id', a.id, 'archivo', 'Carátula e índice', 'modo', CASE WHEN p_descargar THEN 'descarga' ELSE 'vista_pdf' END));
  RETURN res;
END $function$;
REVOKE ALL ON FUNCTION public.auditor_caratula(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditor_caratula(uuid, boolean) TO authenticated;