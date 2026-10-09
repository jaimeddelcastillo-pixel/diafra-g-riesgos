-- Deshace C6a.4 (0021). No borra conocimiento ya creado.
DROP TRIGGER IF EXISTS trg_brain_knowledge_items_revision ON public.brain_knowledge_items;
DROP FUNCTION IF EXISTS public.brain_knowledge_items_revision_guard();
ALTER TABLE public.brain_knowledge_items
  DROP COLUMN IF EXISTS revision_confirmada, DROP COLUMN IF EXISTS revision_confirmada_por,
  DROP COLUMN IF EXISTS revision_confirmada_en, DROP COLUMN IF EXISTS revision_comentario;

DROP TRIGGER IF EXISTS trg_org_documentos_copia_guard ON public.org_documentos;
DROP FUNCTION IF EXISTS public.org_documentos_copia_guard();
ALTER TABLE public.org_documentos
  DROP COLUMN IF EXISTS copia_no_controlada_propuesta, DROP COLUMN IF EXISTS copia_no_controlada_evidencia,
  DROP COLUMN IF EXISTS copia_no_controlada;

DROP TRIGGER IF EXISTS trg_brain_documents_estado_guard ON public.brain_documents;
DROP FUNCTION IF EXISTS public.brain_documents_estado_guard();
ALTER TABLE public.brain_documents
  DROP COLUMN IF EXISTS estado_propuesto, DROP COLUMN IF EXISTS estado_evidencia, DROP COLUMN IF EXISTS estado_confianza,
  DROP COLUMN IF EXISTS requiere_confirmacion, DROP COLUMN IF EXISTS estado_propuesto_en,
  DROP COLUMN IF EXISTS enlace_por_confirmar, DROP COLUMN IF EXISTS enlace_revision_detectada, DROP COLUMN IF EXISTS enlace_evidencia;

ALTER TABLE public.brain_knowledge_sources DROP COLUMN IF EXISTS extraccion_id;
DROP TABLE IF EXISTS public.brain_extracciones;

CREATE OR REPLACE FUNCTION public.org_documento_retencion(p_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_clas text;
BEGIN
  SELECT clasificacion INTO v_clas FROM public.org_documentos WHERE id = p_id;
  IF v_clas = 'controlado' THEN RETURN 'controlado'; END IF;
  IF EXISTS (SELECT 1 FROM public.brain_documents b WHERE b.archivo_id = p_id) THEN RETURN 'cerebro'; END IF;
  IF EXISTS (SELECT 1 FROM public.brain_knowledge_sources s WHERE s.archivo_id = p_id) THEN RETURN 'cerebro'; END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.brain_documents_vigencia()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END $function$;

-- 0022 ajustes
DROP TRIGGER IF EXISTS trg_org_documentos_copia_marca_conocimiento ON public.org_documentos;
DROP FUNCTION IF EXISTS public.org_documentos_copia_marca_conocimiento();
DROP TRIGGER IF EXISTS trg_brain_documents_enlace_comentario ON public.brain_documents;
DROP FUNCTION IF EXISTS public.brain_documents_enlace_comentario_guard();
ALTER TABLE public.brain_documents DROP COLUMN IF EXISTS enlace_comentario;
