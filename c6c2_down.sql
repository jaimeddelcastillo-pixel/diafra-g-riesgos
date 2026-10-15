-- Reversión C6c.2 (migración 0040). Restaura auditor_ver_item previo y quita funciones nuevas.
DROP FUNCTION IF EXISTS public.auditor_caratula(uuid, boolean);
DROP FUNCTION IF EXISTS public.auditor_registrar_pdf_generado(uuid, boolean);

CREATE OR REPLACE FUNCTION public.auditor_ver_item(p_item_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE acc jsonb; v_ent uuid; v_tipo text; v_org uuid; datos jsonb;
BEGIN
  acc := public.auditoria_validar_acceso(auth.uid(), p_item_id);
  v_ent := (acc->>'entidad_id')::uuid; v_tipo := acc->>'tipo'; v_org := (acc->>'org_id')::uuid;
  IF v_tipo = 'folio' THEN
    SELECT jsonb_build_object(
      'folio', to_jsonb(f) - ARRAY['created_by','cancelado_por'],
      'org', (SELECT jsonb_build_object('nombre', o.nombre, 'logo_url', o.logo_url,
               'codigo_formato', o.codigo_formato, 'version_formato', o.version_formato)
              FROM public.organizations o WHERE o.id = f.org_id),
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
      'contenido', k.contenido, 'tipo', k.tipo, 'estado', k.estado,
      'validado_por', (SELECT p.nombre FROM public.profiles p WHERE p.id = k.validado_por),
      'validado_en', k.validado_en,
      'fuentes', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo_fuente', s.tipo_fuente, 'nombre_fuente', s.nombre_fuente,
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
DROP FUNCTION IF EXISTS public.auditor_persona(uuid);
-- Código: revertir auditoria-invitar (inviteUserByEmail), auditoria-invitacion.tsx, ResetPassword.tsx,
-- index.html (captura del enlace), auditoriaPdf.ts, AuditoriaExterna.tsx y marcas de agua.
