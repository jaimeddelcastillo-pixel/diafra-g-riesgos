ALTER TABLE public.auditorias_externas ADD COLUMN duplicado_de uuid REFERENCES public.auditorias_externas(id);

CREATE OR REPLACE FUNCTION public.normalizar_email_auditor(_e text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT regexp_replace(lower(trim(coalesce(_e,''))), '[\s.]+$', '')
$$;

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
    NEW.auditor_email := public.normalizar_email_auditor(NEW.auditor_email);
    IF NEW.auditor_email !~* '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' THEN
      RAISE EXCEPTION 'Correo del auditor inválido' USING ERRCODE = '22023';
    END IF;
    IF NEW.duplicado_de IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.auditorias_externas o WHERE o.id = NEW.duplicado_de AND o.org_id = NEW.org_id) THEN
      RAISE EXCEPTION 'Expediente de origen inválido' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.org_id <> OLD.org_id OR NEW.creado_por IS DISTINCT FROM OLD.creado_por OR NEW.created_at <> OLD.created_at
     OR NEW.duplicado_de IS DISTINCT FROM OLD.duplicado_de THEN
    RAISE EXCEPTION 'Dato no modificable' USING ERRCODE = '42501';
  END IF;
  IF OLD.estado IN ('cerrado','revocado') THEN
    RAISE EXCEPTION 'El expediente está %; ya no se puede modificar', OLD.estado USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN RETURN NEW; END IF;
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
  NEW.auditor_email := public.normalizar_email_auditor(NEW.auditor_email);
  IF NEW.auditor_email !~* '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Correo del auditor inválido' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

-- Duplicar preparación: copia solo ítems vigentes; informa los omitidos; bitácora AUDITORIA_DUPLICADA.
CREATE OR REPLACE FUNCTION public.duplicar_auditoria(
  p_origen uuid, p_nombre text, p_auditor_nombre text, p_auditor_organizacion text, p_auditor_email text,
  p_inicia_en timestamptz, p_expira_en timestamptz, p_permite_descarga boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.get_user_org_id(); v_o record; v_nuevo uuid; it record;
  v_ok boolean; v_titulo text; v_motivo text; v_copiados int := 0; v_omitidos jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_o FROM public.auditorias_externas WHERE id = p_origen AND org_id = v_org;
  IF v_o IS NULL THEN RAISE EXCEPTION 'Expediente no encontrado' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.auditorias_externas (org_id, nombre, auditor_nombre, auditor_organizacion, auditor_email,
    inicia_en, expira_en, permite_descarga, duplicado_de)
  VALUES (v_org, trim(p_nombre), trim(p_auditor_nombre), nullif(trim(coalesce(p_auditor_organizacion,'')),''), p_auditor_email,
    p_inicia_en, p_expira_en, coalesce(p_permite_descarga, true), p_origen)
  RETURNING id INTO v_nuevo;

  FOR it IN SELECT * FROM public.auditoria_items WHERE auditoria_id = p_origen ORDER BY created_at LOOP
    v_ok := false; v_titulo := NULL; v_motivo := NULL;
    IF it.tipo = 'conocimiento' THEN
      SELECT left(k.contenido, 140), k.estado = 'validado' INTO v_titulo, v_ok
        FROM public.brain_knowledge_items k WHERE k.id = it.entidad_id AND k.org_id = v_org;
      v_motivo := CASE WHEN v_titulo IS NULL THEN 'ya no existe' ELSE 'ya no está validado' END;
    ELSIF it.tipo = 'documento' THEN
      SELECT d.nombre, (d.deleted_at IS NULL AND d.retirado_en IS NULL) INTO v_titulo, v_ok
        FROM public.org_documentos d WHERE d.id = it.entidad_id AND d.org_id = v_org;
      v_motivo := CASE WHEN v_titulo IS NULL THEN 'ya no existe' ELSE 'archivo retirado o eliminado' END;
    ELSE
      SELECT f.codigo, true INTO v_titulo, v_ok FROM public.folios f WHERE f.id = it.entidad_id AND f.org_id = v_org;
      v_motivo := 'el folio ya no existe';
    END IF;
    IF coalesce(v_ok, false) THEN
      INSERT INTO public.auditoria_items (auditoria_id, org_id, tipo, entidad_id, incluir_evidencias, agregado_por)
      VALUES (v_nuevo, v_org, it.tipo, it.entidad_id, it.incluir_evidencias, auth.uid());
      v_copiados := v_copiados + 1;
    ELSE
      v_omitidos := v_omitidos || jsonb_build_object('tipo', it.tipo, 'titulo', coalesce(v_titulo, it.entidad_id::text), 'motivo', v_motivo);
    END IF;
  END LOOP;

  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (auth.uid(), v_org, 'auditorias_externas', v_nuevo::text, 'AUDITORIA_DUPLICADA',
    jsonb_build_object('auditoria_id', v_nuevo, 'duplicado_de', p_origen, 'items_copiados', v_copiados, 'omitidos', v_omitidos));

  RETURN jsonb_build_object('id', v_nuevo, 'copiados', v_copiados, 'omitidos', v_omitidos);
END $$;
REVOKE ALL ON FUNCTION public.duplicar_auditoria(uuid,text,text,text,text,timestamptz,timestamptz,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_auditoria(uuid,text,text,text,text,timestamptz,timestamptz,boolean) TO authenticated;

-- Folio: registro de vista (sin descargas) o descarga.
CREATE OR REPLACE FUNCTION public.auditor_registrar_folio_pdf(p_item_id uuid, p_descargar boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE acc jsonb; v_codigo text; v_ahora timestamptz := now();
BEGIN
  acc := public.auditoria_validar_acceso(auth.uid(), p_item_id);
  IF acc->>'tipo' <> 'folio' THEN RAISE EXCEPTION 'El ítem no es un folio' USING ERRCODE = '22023'; END IF;
  IF p_descargar AND NOT (acc->>'permite_descarga')::boolean THEN RAISE EXCEPTION 'Este expediente no permite descargas' USING ERRCODE = '42501'; END IF;
  SELECT codigo INTO v_codigo FROM public.folios WHERE id = (acc->>'entidad_id')::uuid;
  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (auth.uid(), (acc->>'org_id')::uuid, 'auditoria_items', p_item_id::text,
          CASE WHEN p_descargar THEN 'AUDITOR_DESCARGO' ELSE 'AUDITOR_CONSULTO' END,
          jsonb_build_object('auditoria_id', acc->>'auditoria_id', 'tipo', 'folio', 'entidad_id', acc->>'entidad_id',
                             'archivo', 'PDF del folio ' || coalesce(v_codigo,''), 'sha256', NULL,
                             'modo', CASE WHEN p_descargar THEN 'descarga' ELSE 'vista_pdf' END));
  RETURN jsonb_build_object('expediente', acc->>'nombre', 'auditor', acc->>'auditor_nombre', 'fecha', v_ahora);
END $function$;
REVOKE ALL ON FUNCTION public.auditor_registrar_folio_pdf(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditor_registrar_folio_pdf(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.auditoria_actividad(p_auditoria_id uuid)
 RETURNS TABLE(fecha timestamp with time zone, accion text, tipo text, item_id text, archivo text, sha256 text, modo text, ip text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
   WHERE t.org_id = v_org AND t.accion IN ('AUDITOR_CONSULTO','AUDITOR_DESCARGO','AUDITORIA_ACTIVADA','AUDITORIA_DUPLICADA')
     AND t.valor_nuevo->>'auditoria_id' = p_auditoria_id::text
   ORDER BY t.created_at DESC;
END $function$;