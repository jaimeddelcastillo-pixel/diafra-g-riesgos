-- C6c · 0a. Norma y metodología: el admin solo las escribe si están vacías.
CREATE OR REPLACE FUNCTION public.organizations_lista_blanca_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  permitidos text[] := ARRAY['logo_url','codigo_formato','version_formato','razon_social','rfc',
    'folio_prefijo','folio_formato_periodo','folio_digitos_consecutivo','updated_at'];
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN RETURN NEW; END IF;
  IF coalesce(trim(OLD.norma_aplicable::text),'') = '' THEN permitidos := permitidos || 'norma_aplicable'; END IF;
  IF coalesce(trim(OLD.metodologia::text),'') = '' THEN permitidos := permitidos || 'metodologia'; END IF;
  IF (to_jsonb(NEW) - permitidos) IS DISTINCT FROM (to_jsonb(OLD) - permitidos) THEN
    RAISE EXCEPTION 'Este dato solo lo puede cambiar soporte TRACEA' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

-- C6c · 0b. Cada persona lee solo sus propias conversaciones del asistente.
DROP POLICY IF EXISTS "Org members read chat_conversaciones" ON public.chat_conversaciones;
CREATE POLICY "Owner reads chat_conversaciones" ON public.chat_conversaciones
  FOR SELECT TO authenticated USING (created_by = auth.uid());
DROP POLICY IF EXISTS "Org members read chat_mensajes" ON public.chat_mensajes;
CREATE POLICY "Owner reads chat_mensajes" ON public.chat_mensajes
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.chat_conversaciones c
    WHERE c.id = chat_mensajes.conversacion_id AND c.created_by = auth.uid()));

-- C6c · 1. Tablas
CREATE TABLE public.auditorias_externas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  nombre text NOT NULL CHECK (length(trim(nombre)) BETWEEN 3 AND 200),
  auditor_nombre text NOT NULL CHECK (length(trim(auditor_nombre)) BETWEEN 2 AND 200),
  auditor_organizacion text,
  auditor_email text NOT NULL CHECK (auditor_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  auditor_user_id uuid,
  inicia_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL,
  permite_descarga boolean NOT NULL DEFAULT true,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','activo','cerrado','revocado')),
  creado_por uuid,
  activado_por uuid,
  activado_en timestamptz,
  cerrado_por uuid,
  cerrado_en timestamptz,
  motivo_cierre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditorias_externas_vigencia CHECK (expira_en > inicia_en AND expira_en <= inicia_en + interval '30 days'),
  CONSTRAINT auditorias_externas_motivo CHECK (estado NOT IN ('cerrado','revocado') OR length(trim(coalesce(motivo_cierre,''))) >= 5),
  CONSTRAINT auditorias_externas_activa_con_auditor CHECK (estado <> 'activo' OR auditor_user_id IS NOT NULL)
);
CREATE INDEX auditorias_externas_org_idx ON public.auditorias_externas(org_id);
CREATE INDEX auditorias_externas_auditor_idx ON public.auditorias_externas(auditor_user_id) WHERE estado = 'activo';

CREATE TABLE public.auditoria_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.auditorias_externas(id),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  tipo text NOT NULL CHECK (tipo IN ('folio','documento','conocimiento')),
  entidad_id uuid NOT NULL,
  incluir_evidencias boolean NOT NULL DEFAULT false,
  agregado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auditoria_id, tipo, entidad_id),
  CHECK (tipo = 'folio' OR incluir_evidencias = false)
);
CREATE INDEX auditoria_items_auditoria_idx ON public.auditoria_items(auditoria_id);

GRANT SELECT, INSERT, UPDATE ON public.auditorias_externas TO authenticated;
GRANT ALL ON public.auditorias_externas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditoria_items TO authenticated;
GRANT ALL ON public.auditoria_items TO service_role;

ALTER TABLE public.auditorias_externas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY auditorias_externas_select ON public.auditorias_externas FOR SELECT TO authenticated
  USING ((org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario'))) OR public.is_super_admin());
CREATE POLICY auditorias_externas_insert ON public.auditorias_externas FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')));
CREATE POLICY auditorias_externas_update ON public.auditorias_externas FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')))
  WITH CHECK (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')));

CREATE POLICY auditoria_items_select ON public.auditoria_items FOR SELECT TO authenticated
  USING ((org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario'))) OR public.is_super_admin());
CREATE POLICY auditoria_items_insert ON public.auditoria_items FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')));
CREATE POLICY auditoria_items_update ON public.auditoria_items FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')))
  WITH CHECK (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')));
CREATE POLICY auditoria_items_delete ON public.auditoria_items FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')));

-- Gobierno del expediente: nada se borra; solo el RS cierra/revoca; activar solo por la función de invitación.
CREATE OR REPLACE FUNCTION public.auditorias_externas_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_es_rs boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un expediente de auditoría no se borra: ciérralo o revócalo con motivo' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'borrador' THEN RAISE EXCEPTION 'El expediente se crea en borrador' USING ERRCODE = '42501'; END IF;
    NEW.auditor_user_id := NULL; NEW.activado_por := NULL; NEW.activado_en := NULL;
    NEW.cerrado_por := NULL; NEW.cerrado_en := NULL; NEW.motivo_cierre := NULL;
    IF v_uid IS NOT NULL THEN NEW.creado_por := v_uid; END IF;
    NEW.auditor_email := lower(trim(NEW.auditor_email));
    RETURN NEW;
  END IF;
  -- UPDATE
  IF NEW.org_id <> OLD.org_id OR NEW.creado_por IS DISTINCT FROM OLD.creado_por OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Dato no modificable' USING ERRCODE = '42501';
  END IF;
  IF OLD.estado IN ('cerrado','revocado') THEN
    RAISE EXCEPTION 'El expediente está %; ya no se puede modificar', OLD.estado USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN RETURN NEW; END IF; -- funciones del servidor (invitación)
  IF NEW.estado = 'activo' AND OLD.estado = 'borrador' THEN
    RAISE EXCEPTION 'El expediente se activa con la invitación al auditor' USING ERRCODE = '42501';
  END IF;
  IF NEW.estado = 'borrador' AND OLD.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Un expediente activo no regresa a borrador' USING ERRCODE = '42501';
  END IF;
  IF NEW.auditor_user_id IS DISTINCT FROM OLD.auditor_user_id OR NEW.activado_por IS DISTINCT FROM OLD.activado_por
     OR NEW.activado_en IS DISTINCT FROM OLD.activado_en THEN
    RAISE EXCEPTION 'Dato no modificable' USING ERRCODE = '42501';
  END IF;
  IF NEW.estado IN ('cerrado','revocado') THEN
    v_es_rs := public.has_role(v_uid, 'responsable_sanitario') OR public.is_super_admin();
    IF NOT v_es_rs THEN
      RAISE EXCEPTION 'Solo el Responsable Sanitario cierra o revoca el expediente' USING ERRCODE = '42501';
    END IF;
    NEW.cerrado_por := v_uid; NEW.cerrado_en := now();
    IF (to_jsonb(NEW) - ARRAY['estado','cerrado_por','cerrado_en','motivo_cierre'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['estado','cerrado_por','cerrado_en','motivo_cierre']) THEN
      RAISE EXCEPTION 'Al cerrar o revocar solo cambia el estado y el motivo' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.cerrado_por IS DISTINCT FROM OLD.cerrado_por OR NEW.cerrado_en IS DISTINCT FROM OLD.cerrado_en
     OR NEW.motivo_cierre IS DISTINCT FROM OLD.motivo_cierre THEN
    RAISE EXCEPTION 'Dato no modificable' USING ERRCODE = '42501';
  END IF;
  IF OLD.estado = 'activo' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'Un expediente activo solo se cierra o se revoca' USING ERRCODE = '42501';
  END IF;
  NEW.auditor_email := lower(trim(NEW.auditor_email));
  RETURN NEW;
END $$;
CREATE TRIGGER auditorias_externas_governance BEFORE INSERT OR UPDATE OR DELETE ON public.auditorias_externas
  FOR EACH ROW EXECUTE FUNCTION public.auditorias_externas_governance();

-- Integridad de ítems
CREATE OR REPLACE FUNCTION public.auditoria_items_integridad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_aud record; v_ok boolean;
BEGIN
  SELECT * INTO v_aud FROM public.auditorias_externas
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.auditoria_id ELSE NEW.auditoria_id END;
  IF v_aud IS NULL THEN RAISE EXCEPTION 'Expediente inexistente'; END IF;
  IF v_aud.estado IN ('cerrado','revocado') THEN
    RAISE EXCEPTION 'El expediente está %; no se pueden agregar ni quitar ítems', v_aud.estado USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.auditoria_id <> OLD.auditoria_id OR NEW.tipo <> OLD.tipo OR NEW.entidad_id <> OLD.entidad_id
       OR NEW.org_id <> OLD.org_id OR NEW.agregado_por IS DISTINCT FROM OLD.agregado_por THEN
      RAISE EXCEPTION 'Solo se puede cambiar si incluye evidencias' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  NEW.org_id := v_aud.org_id;
  IF auth.uid() IS NOT NULL THEN NEW.agregado_por := auth.uid(); END IF;
  IF NEW.tipo = 'folio' THEN
    SELECT EXISTS (SELECT 1 FROM public.folios f WHERE f.id = NEW.entidad_id AND f.org_id = v_aud.org_id) INTO v_ok;
  ELSIF NEW.tipo = 'documento' THEN
    SELECT EXISTS (SELECT 1 FROM public.org_documentos d WHERE d.id = NEW.entidad_id AND d.org_id = v_aud.org_id AND d.deleted_at IS NULL) INTO v_ok;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.brain_knowledge_items k WHERE k.id = NEW.entidad_id AND k.org_id = v_aud.org_id AND k.estado = 'validado') INTO v_ok;
    IF NOT v_ok THEN RAISE EXCEPTION 'Solo se pueden agregar conocimientos validados de la misma empresa' USING ERRCODE = '42501'; END IF;
  END IF;
  IF NOT v_ok THEN RAISE EXCEPTION 'El ítem no pertenece a la empresa del expediente' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER auditoria_items_integridad BEFORE INSERT OR UPDATE OR DELETE ON public.auditoria_items
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_items_integridad();

CREATE TRIGGER audit_auditorias_externas AFTER INSERT OR UPDATE OR DELETE ON public.auditorias_externas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_auditoria_items AFTER INSERT OR UPDATE OR DELETE ON public.auditoria_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Regla única de acceso del auditor a un ítem (usuario explícito: la usan RPC y funciones del servidor).
CREATE OR REPLACE FUNCTION public.auditoria_validar_acceso(p_user uuid, p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501'; END IF;
  SELECT i.id AS item_id, i.tipo, i.entidad_id, i.incluir_evidencias, i.org_id,
         a.id AS auditoria_id, a.nombre, a.auditor_nombre, a.permite_descarga, a.expira_en
    INTO r
    FROM public.auditoria_items i JOIN public.auditorias_externas a ON a.id = i.auditoria_id
   WHERE i.id = p_item_id AND a.auditor_user_id = p_user AND a.estado = 'activo'
     AND now() >= a.inicia_en AND now() < a.expira_en;
  IF r IS NULL THEN RAISE EXCEPTION 'Sin acceso vigente a este ítem' USING ERRCODE = '42501'; END IF;
  RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.auditoria_validar_acceso(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_validar_acceso(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.auditor_mis_expedientes()
RETURNS TABLE(id uuid, nombre text, org_nombre text, auditor_nombre text, inicia_en timestamptz,
              expira_en timestamptz, permite_descarga boolean, items jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.id, a.nombre, o.nombre, a.auditor_nombre, a.inicia_en, a.expira_en, a.permite_descarga,
    coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'tipo', i.tipo, 'incluir_evidencias', i.incluir_evidencias,
        'titulo', CASE i.tipo
          WHEN 'folio' THEN (SELECT f.codigo || ' · ' || coalesce(f.proceso_equipo,'') FROM public.folios f WHERE f.id = i.entidad_id)
          WHEN 'documento' THEN (SELECT coalesce(bd.codigo || ' · ', '') || d.nombre FROM public.org_documentos d
                                 LEFT JOIN LATERAL (SELECT b.codigo FROM public.brain_documents b WHERE b.archivo_id = d.id ORDER BY b.updated_at DESC LIMIT 1) bd ON true
                                 WHERE d.id = i.entidad_id)
          ELSE (SELECT left(k.contenido, 140) FROM public.brain_knowledge_items k WHERE k.id = i.entidad_id) END
      ) ORDER BY i.tipo, i.created_at) FROM public.auditoria_items i WHERE i.auditoria_id = a.id), '[]'::jsonb)
  FROM public.auditorias_externas a JOIN public.organizations o ON o.id = a.org_id
  WHERE auth.uid() IS NOT NULL AND a.auditor_user_id = auth.uid() AND a.estado = 'activo'
    AND now() >= a.inicia_en AND now() < a.expira_en
  ORDER BY a.expira_en
$$;
REVOKE ALL ON FUNCTION public.auditor_mis_expedientes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditor_mis_expedientes() TO authenticated;

CREATE OR REPLACE FUNCTION public.auditor_ver_item(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.auditor_ver_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditor_ver_item(uuid) TO authenticated;

-- PDF del folio (se genera en el navegador): valida y registra antes de generarlo.
CREATE OR REPLACE FUNCTION public.auditor_registrar_descarga_folio(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE acc jsonb; v_codigo text; v_ahora timestamptz := now();
BEGIN
  acc := public.auditoria_validar_acceso(auth.uid(), p_item_id);
  IF acc->>'tipo' <> 'folio' THEN RAISE EXCEPTION 'El ítem no es un folio' USING ERRCODE = '22023'; END IF;
  IF NOT (acc->>'permite_descarga')::boolean THEN RAISE EXCEPTION 'Este expediente no permite descargas' USING ERRCODE = '42501'; END IF;
  SELECT codigo INTO v_codigo FROM public.folios WHERE id = (acc->>'entidad_id')::uuid;
  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (auth.uid(), (acc->>'org_id')::uuid, 'auditoria_items', p_item_id::text, 'AUDITOR_DESCARGO',
          jsonb_build_object('auditoria_id', acc->>'auditoria_id', 'tipo', 'folio', 'entidad_id', acc->>'entidad_id',
                             'archivo', 'PDF del folio ' || coalesce(v_codigo,''), 'sha256', NULL));
  RETURN jsonb_build_object('expediente', acc->>'nombre', 'auditor', acc->>'auditor_nombre', 'fecha', v_ahora);
END $$;
REVOKE ALL ON FUNCTION public.auditor_registrar_descarga_folio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditor_registrar_descarga_folio(uuid) TO authenticated;

-- Actividad del auditor (admin/RS de la empresa del expediente).
CREATE OR REPLACE FUNCTION public.auditoria_actividad(p_auditoria_id uuid)
RETURNS TABLE(fecha timestamptz, accion text, tipo text, item_id text, archivo text, sha256 text, modo text, ip text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid;
BEGIN
  SELECT a.org_id INTO v_org FROM public.auditorias_externas a WHERE a.id = p_auditoria_id;
  IF v_org IS NULL OR NOT (public.is_super_admin() OR (v_org = public.get_user_org_id()
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')))) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT t.created_at, t.accion, t.valor_nuevo->>'tipo', t.registro_id, t.valor_nuevo->>'archivo',
         t.valor_nuevo->>'sha256', t.valor_nuevo->>'modo', t.ip
    FROM public.audit_trail t
   WHERE t.org_id = v_org AND t.accion IN ('AUDITOR_CONSULTO','AUDITOR_DESCARGO','AUDITORIA_ACTIVADA')
     AND t.valor_nuevo->>'auditoria_id' = p_auditoria_id::text
   ORDER BY t.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.auditoria_actividad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_actividad(uuid) TO authenticated;