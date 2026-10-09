-- C3 rollback (deshace 0011_c3_vinculos_ciclo_vida_trazabilidad.sql)
-- folio_id / riesgo_id NO se eliminaron en C3 (DROP COLUMN bloqueado por la herramienta);
-- se rellenan desde brain_vinculos y se quitan los comentarios DEPRECATED.
BEGIN;

UPDATE public.brain_knowledge_items k SET folio_id = v.entidad_id
  FROM public.brain_vinculos v
 WHERE v.knowledge_item_id = k.id AND v.entidad_tipo = 'folio' AND v.relacion = 'aplica_a' AND k.folio_id IS NULL;
UPDATE public.brain_knowledge_items k SET riesgo_id = v.entidad_id
  FROM public.brain_vinculos v
 WHERE v.knowledge_item_id = k.id AND v.entidad_tipo = 'riesgo' AND v.relacion = 'aplica_a' AND k.riesgo_id IS NULL;
COMMENT ON COLUMN public.brain_knowledge_items.folio_id IS NULL;
COMMENT ON COLUMN public.brain_knowledge_items.riesgo_id IS NULL;
COMMENT ON COLUMN public.brain_processes.folio_id IS NULL;

DROP TABLE IF EXISTS public.brain_vinculos;
DROP FUNCTION IF EXISTS public.brain_vinculos_integridad();
DROP TABLE IF EXISTS public.vinculo_tipos_entidad;

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org_id UUID; v_record_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := (to_jsonb(OLD) ->> 'org_id')::UUID; v_record_id := (to_jsonb(OLD) ->> 'id');
  ELSE
    v_org_id := (to_jsonb(NEW) ->> 'org_id')::UUID; v_record_id := (to_jsonb(NEW) ->> 'id');
  END IF;
  IF v_org_id IS NULL THEN v_org_id := public.get_user_org_id(); END IF;
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END; $function$;

-- audit_trail.solicitado_por se conserva: la bitácora es inalterable y la columna contiene evidencia.
-- Si se exige retirarla: ALTER TABLE public.audit_trail DROP COLUMN solicitado_por;
ALTER TABLE public.brain_interview_sessions DROP COLUMN IF EXISTS actualizado_por;
ALTER TABLE public.brain_documents DROP COLUMN IF EXISTS actualizado_por;
ALTER TABLE public.brain_import_batches DROP COLUMN IF EXISTS actualizado_por;

DROP TRIGGER IF EXISTS trg_brain_sources_revision ON public.brain_knowledge_sources;
DROP FUNCTION IF EXISTS public.brain_sources_revision_documento();
ALTER TABLE public.brain_knowledge_sources DROP COLUMN IF EXISTS documento_codigo, DROP COLUMN IF EXISTS documento_revision;

UPDATE public.brain_knowledge_items SET estado = 'por_validar' WHERE estado IN ('obsoleto','sustituido');
ALTER TABLE public.brain_knowledge_items DROP CONSTRAINT brain_knowledge_items_estado_check;
ALTER TABLE public.brain_knowledge_items ADD CONSTRAINT brain_knowledge_items_estado_check CHECK (estado = ANY (ARRAY['no_explorado','en_entrevista','capturado','contrastado','validado','por_validar','contradictorio','brecha']));
ALTER TABLE public.brain_knowledge_items
  DROP COLUMN IF EXISTS sustituido_por_id, DROP COLUMN IF EXISTS motivo_estado,
  DROP COLUMN IF EXISTS estado_cambiado_por, DROP COLUMN IF EXISTS estado_cambiado_en,
  DROP COLUMN IF EXISTS actualizado_por;

CREATE OR REPLACE FUNCTION public.brain_knowledge_items_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado NOT IN ('capturado','en_entrevista','no_explorado') THEN NEW.estado := 'capturado'; END IF;
    NEW.validado_por := NULL; NEW.validado_en := NULL;
    RETURN NEW;
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.marco_validado IS DISTINCT FROM OLD.marco_validado
     OR NEW.motivo_invalidacion IS DISTINCT FROM OLD.motivo_invalidacion
     OR NEW.afecta_cumplimiento IS DISTINCT FROM OLD.afecta_cumplimiento THEN
    IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'responsable_sanitario') OR is_super_admin()) THEN
      RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden cambiar el estado de validación';
    END IF;
  END IF;
  IF NEW.estado = 'validado' AND OLD.estado IS DISTINCT FROM 'validado' THEN
    NEW.validado_por := auth.uid(); NEW.validado_en := now();
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado <> 'validado' THEN
    NEW.validado_por := NULL; NEW.validado_en := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $function$;

COMMIT;
