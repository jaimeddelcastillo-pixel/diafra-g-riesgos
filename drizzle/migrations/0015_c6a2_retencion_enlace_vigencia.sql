-- ===== Retención de documentos de Recursos =====
ALTER TABLE public.org_documentos ADD COLUMN nombre_archivo_original text;
ALTER TABLE public.org_documentos ADD COLUMN retirado_en timestamptz;
ALTER TABLE public.org_documentos ADD COLUMN retirado_por uuid;
ALTER TABLE public.org_documentos ADD COLUMN motivo_retiro text;

-- Enlace archivo <-> registro del Listado (Cerebro apunta a Recursos, nunca al revés)
ALTER TABLE public.brain_documents ADD COLUMN archivo_id uuid REFERENCES public.org_documentos(id) ON DELETE RESTRICT;
CREATE INDEX brain_documents_archivo_idx ON public.brain_documents(archivo_id);

-- Motivo de retención: NULL si se puede borrar; 'controlado' o 'cerebro'.
CREATE OR REPLACE FUNCTION public.org_documento_retencion(p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clas text;
BEGIN
  SELECT clasificacion INTO v_clas FROM public.org_documentos WHERE id = p_id;
  IF v_clas = 'controlado' THEN RETURN 'controlado'; END IF;
  IF to_regclass('public.brain_documents') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.brain_documents b WHERE b.archivo_id = p_id) THEN
    RETURN 'cerebro';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.org_documento_retencion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_documento_retencion(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.documentos_retenidos(p_ids uuid[])
RETURNS TABLE(id uuid, motivo text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, public.org_documento_retencion(d.id)
    FROM public.org_documentos d
   WHERE d.id = ANY(p_ids) AND d.org_id = public.get_user_org_id()
     AND public.org_documento_retencion(d.id) IS NOT NULL
$$;
GRANT EXECUTE ON FUNCTION public.documentos_retenidos(uuid[]) TO authenticated;

-- Un documento retenido no entra a la papelera ni se borra por ninguna vía.
CREATE OR REPLACE FUNCTION public.org_documentos_retencion_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v := public.org_documento_retencion(OLD.id);
    IF v IS NOT NULL THEN
      RAISE EXCEPTION 'RETENCION: este documento no se puede eliminar (%). Solo se puede retirar.',
        CASE v WHEN 'controlado' THEN 'documento controlado' ELSE 'está enlazado o citado en Cerebro' END;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    v := public.org_documento_retencion(NEW.id);
    IF v IS NOT NULL THEN
      RAISE EXCEPTION 'RETENCION: este documento no se puede enviar a la papelera (%). Solo se puede retirar.',
        CASE v WHEN 'controlado' THEN 'documento controlado' ELSE 'está enlazado o citado en Cerebro' END;
    END IF;
  END IF;
  IF OLD.retirado_en IS NOT NULL AND (NEW.retirado_en IS DISTINCT FROM OLD.retirado_en
       OR NEW.retirado_por IS DISTINCT FROM OLD.retirado_por OR NEW.motivo_retiro IS DISTINCT FROM OLD.motivo_retiro) THEN
    RAISE EXCEPTION 'Un documento retirado conserva su registro de retiro';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_org_documentos_retencion BEFORE UPDATE OR DELETE ON public.org_documentos
  FOR EACH ROW EXECUTE FUNCTION public.org_documentos_retencion_guard();

CREATE OR REPLACE FUNCTION public.retirar_documento(p_doc_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.org_documentos; v_ctx record;
BEGIN
  SELECT * INTO v_ctx FROM public.contexto_org_actual();
  SELECT * INTO d FROM public.org_documentos WHERE id = p_doc_id;
  IF NOT FOUND OR d.org_id IS DISTINCT FROM v_ctx.org_id THEN RAISE EXCEPTION 'Documento no encontrado'; END IF;
  IF coalesce(v_ctx.rol_en_org,'') NOT IN ('admin','responsable_sanitario','super_admin') THEN
    RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden retirar documentos';
  END IF;
  IF coalesce(btrim(p_motivo),'') = '' THEN RAISE EXCEPTION 'Retirar exige un motivo'; END IF;
  IF d.retirado_en IS NOT NULL THEN RAISE EXCEPTION 'El documento ya está retirado'; END IF;
  IF d.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'El documento está en la papelera'; END IF;
  UPDATE public.org_documentos SET retirado_en = now(), retirado_por = auth.uid(), motivo_retiro = btrim(p_motivo)
   WHERE id = p_doc_id;
  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (auth.uid(), d.org_id, 'org_documentos', p_doc_id, 'DOCUMENTO_RETIRADO',
          jsonb_build_object('nombre', d.nombre, 'motivo', btrim(p_motivo),
                             'retencion', public.org_documento_retencion(p_doc_id)));
END $$;
GRANT EXECUTE ON FUNCTION public.retirar_documento(uuid, text) TO authenticated;

-- Purga automática y borrado definitivo omiten los retenidos
CREATE OR REPLACE FUNCTION public.purgar_documentos_eliminados()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.org_documentos d
    WHERE d.deleted_at IS NOT NULL
      AND d.deleted_at < NOW() - INTERVAL '30 days'
      AND public.org_documento_retencion(d.id) IS NULL
    RETURNING d.id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.purgar_documentos_expirados()
RETURNS TABLE(id uuid, storage_path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN QUERY
  WITH purgados AS (
    DELETE FROM public.org_documentos d
    WHERE d.deleted_at IS NOT NULL
      AND d.deleted_at < NOW() - INTERVAL '30 days'
      AND public.org_documento_retencion(d.id) IS NULL
    RETURNING d.id, d.storage_path
  )
  SELECT p.id, p.storage_path FROM purgados p;
END $$;

-- ===== Enlace sugerido (solo se confirma por una persona) =====
CREATE OR REPLACE FUNCTION public.codigo_tokens(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '-' || btrim(regexp_replace(upper(translate(coalesce(_t,''),
    'áàäâéèëêíìïîóòöôúùüûñçÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ','aaaaeeeeiiiioooouuuuncAAAAEEEEIIIIOOOOUUUUNC')),
    '[^A-Z0-9]+', '-', 'g'), '-') || '-'
$$;

CREATE TABLE public.brain_enlace_descartes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.brain_documents(id) ON DELETE CASCADE,
  archivo_id uuid NOT NULL REFERENCES public.org_documentos(id) ON DELETE CASCADE,
  descartado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_id, archivo_id)
);
GRANT SELECT ON public.brain_enlace_descartes TO authenticated;
GRANT ALL ON public.brain_enlace_descartes TO service_role;
ALTER TABLE public.brain_enlace_descartes ENABLE ROW LEVEL SECURITY;
CREATE POLICY brain_enlace_descartes_select ON public.brain_enlace_descartes FOR SELECT TO authenticated
  USING ((org_id = public.get_user_org_id() AND public.mi_org_tiene_modulo('institutional_brain')) OR public.is_super_admin());
CREATE TRIGGER trg_audit_brain_enlace_descartes AFTER INSERT OR UPDATE OR DELETE ON public.brain_enlace_descartes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE OR REPLACE FUNCTION public.brain_sugerencias_enlace()
RETURNS TABLE(documento_id uuid, codigo text, revision text, documento_nombre text,
              archivo_id uuid, archivo_nombre text, nombre_archivo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.codigo, b.revision, b.nombre, d.id, d.nombre, d.nombre_archivo_original
    FROM public.brain_documents b
    JOIN public.org_documentos d ON d.org_id = b.org_id
   WHERE b.org_id = public.get_user_org_id()
     AND public.mi_org_tiene_modulo('institutional_brain')
     AND b.archivo_id IS NULL
     AND coalesce(btrim(b.codigo),'') <> ''
     AND d.deleted_at IS NULL AND d.retirado_en IS NULL AND d.es_version_actual
     AND NOT EXISTS (SELECT 1 FROM public.brain_documents x WHERE x.archivo_id = d.id)
     AND NOT EXISTS (SELECT 1 FROM public.brain_enlace_descartes e WHERE e.documento_id = b.id AND e.archivo_id = d.id)
     AND position(public.codigo_tokens(b.codigo) IN public.codigo_tokens(coalesce(d.nombre_archivo_original, d.nombre))) > 0
   ORDER BY b.codigo
$$;
GRANT EXECUTE ON FUNCTION public.brain_sugerencias_enlace() TO authenticated;

CREATE OR REPLACE FUNCTION public.brain_resolver_enlace(p_documento_id uuid, p_archivo_id uuid, p_confirmar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ctx record; b public.brain_documents; d public.org_documentos;
BEGIN
  SELECT * INTO v_ctx FROM public.contexto_org_actual();
  IF coalesce(v_ctx.rol_en_org,'') NOT IN ('admin','responsable_sanitario','super_admin') THEN
    RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden confirmar enlaces';
  END IF;
  IF NOT public.org_tiene_modulo(v_ctx.org_id, 'institutional_brain') THEN RAISE EXCEPTION 'Cerebro no está activo'; END IF;
  SELECT * INTO b FROM public.brain_documents WHERE id = p_documento_id;
  SELECT * INTO d FROM public.org_documentos WHERE id = p_archivo_id;
  IF b.org_id IS DISTINCT FROM v_ctx.org_id OR d.org_id IS DISTINCT FROM v_ctx.org_id THEN
    RAISE EXCEPTION 'El registro o el archivo no pertenecen a tu organización';
  END IF;
  IF p_confirmar THEN
    IF d.deleted_at IS NOT NULL OR d.retirado_en IS NOT NULL THEN RAISE EXCEPTION 'El archivo no está disponible'; END IF;
    IF b.archivo_id IS NOT NULL THEN RAISE EXCEPTION 'El registro ya tiene un archivo enlazado'; END IF;
    UPDATE public.brain_documents SET archivo_id = p_archivo_id, actualizado_por = auth.uid() WHERE id = p_documento_id;
  ELSE
    INSERT INTO public.brain_enlace_descartes (org_id, documento_id, archivo_id, descartado_por)
    VALUES (v_ctx.org_id, p_documento_id, p_archivo_id, auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.brain_resolver_enlace(uuid, uuid, boolean) TO authenticated;

-- ===== Vigencia =====
ALTER TABLE public.brain_knowledge_items ADD COLUMN requiere_revision boolean NOT NULL DEFAULT false;
ALTER TABLE public.brain_knowledge_items ADD COLUMN motivo_revision text;

CREATE OR REPLACE FUNCTION public.brain_documents_vigencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_obs boolean; v_motivo text;
BEGIN
  IF coalesce(btrim(NEW.codigo),'') = '' THEN RETURN NEW; END IF;
  v_obs := public.normalizar_txt(NEW.estado) IN ('obsoleto','obsoleta','no vigente','cancelado','cancelada','retirado','retirada','baja');
  IF TG_OP = 'UPDATE' AND NOT (NEW.revision IS DISTINCT FROM OLD.revision
       OR (v_obs AND public.normalizar_txt(OLD.estado) IS DISTINCT FROM public.normalizar_txt(NEW.estado))) THEN
    RETURN NEW;
  END IF;
  v_motivo := CASE WHEN v_obs
    THEN format('El Listado Maestro marcó %s como %s.', NEW.codigo, NEW.estado)
    ELSE format('El Listado Maestro tiene vigente la revisión %s de %s; la fuente cita otra revisión.', coalesce(NEW.revision,'(sin revisión)'), NEW.codigo) END;
  UPDATE public.brain_knowledge_items k
     SET requiere_revision = true, motivo_revision = v_motivo
   WHERE k.org_id = NEW.org_id
     AND EXISTS (
       SELECT 1 FROM public.brain_knowledge_sources s
        WHERE s.knowledge_item_id = k.id AND s.tipo_fuente = 'documento'
          AND (s.documento_id = NEW.id OR public.codigo_tokens(s.documento_codigo) = public.codigo_tokens(NEW.codigo))
          AND (v_obs OR coalesce(btrim(s.documento_revision),'') IS DISTINCT FROM coalesce(btrim(NEW.revision),'')));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_brain_documents_vigencia AFTER INSERT OR UPDATE OF revision, estado ON public.brain_documents
  FOR EACH ROW EXECUTE FUNCTION public.brain_documents_vigencia();