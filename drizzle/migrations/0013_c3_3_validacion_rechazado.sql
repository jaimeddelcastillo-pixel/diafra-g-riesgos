ALTER TABLE public.brain_knowledge_items ADD COLUMN IF NOT EXISTS comentario_validacion text;
ALTER TABLE public.brain_knowledge_items DROP CONSTRAINT IF EXISTS brain_knowledge_items_estado_check;
ALTER TABLE public.brain_knowledge_items ADD CONSTRAINT brain_knowledge_items_estado_check CHECK (estado = ANY (ARRAY['no_explorado','en_entrevista','capturado','contrastado','validado','por_validar','contradictorio','brecha','obsoleto','sustituido','rechazado']));

CREATE OR REPLACE FUNCTION public.brain_knowledge_items_governance()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_dest record; v_ctx record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado NOT IN ('capturado','en_entrevista','no_explorado','por_validar') THEN
      NEW.estado := 'capturado';
    END IF;
    NEW.validado_por := NULL; NEW.validado_en := NULL; NEW.sustituido_por_id := NULL;
    NEW.estado_cambiado_por := NULL; NEW.estado_cambiado_en := NULL;
    NEW.comentario_validacion := NULL;
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.marco_validado IS DISTINCT FROM OLD.marco_validado
     OR NEW.motivo_invalidacion IS DISTINCT FROM OLD.motivo_invalidacion
     OR NEW.afecta_cumplimiento IS DISTINCT FROM OLD.afecta_cumplimiento
     OR NEW.sustituido_por_id IS DISTINCT FROM OLD.sustituido_por_id
     OR NEW.comentario_validacion IS DISTINCT FROM OLD.comentario_validacion THEN
    -- C3.3: rol de la persona en la empresa activa (no el rol global).
    SELECT * INTO v_ctx FROM public.contexto_org_actual();
    IF NOT (coalesce(v_ctx.es_super_admin,false)
            OR (v_ctx.org_id = NEW.org_id AND v_ctx.rol_en_org IN ('admin','responsable_sanitario'))) THEN
      RAISE EXCEPTION 'Solo administradores o responsable sanitario de esta empresa pueden cambiar el estado de validación';
    END IF;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado IN ('obsoleto','sustituido','rechazado') AND NEW.estado <> 'por_validar' THEN
      RAISE EXCEPTION 'Desde % solo se puede volver a por_validar', OLD.estado;
    END IF;
    IF NEW.estado = 'obsoleto' THEN
      IF coalesce(btrim(NEW.motivo_estado),'') = '' THEN RAISE EXCEPTION 'Marcar como obsoleto exige un motivo'; END IF;
      NEW.sustituido_por_id := NULL;
    ELSIF NEW.estado = 'rechazado' THEN
      IF coalesce(btrim(NEW.motivo_estado),'') = '' THEN RAISE EXCEPTION 'Rechazar exige un motivo'; END IF;
      NEW.sustituido_por_id := NULL;
    ELSIF NEW.estado = 'sustituido' THEN
      IF coalesce(btrim(NEW.motivo_estado),'') = '' OR NEW.sustituido_por_id IS NULL THEN
        RAISE EXCEPTION 'Sustituir exige motivo y el conocimiento que lo sustituye';
      END IF;
      IF NEW.sustituido_por_id = NEW.id THEN RAISE EXCEPTION 'Un conocimiento no puede sustituirse a sí mismo'; END IF;
      SELECT org_id, estado INTO v_dest FROM brain_knowledge_items WHERE id = NEW.sustituido_por_id;
      IF v_dest.org_id IS DISTINCT FROM NEW.org_id OR v_dest.estado IS DISTINCT FROM 'validado' THEN
        RAISE EXCEPTION 'El conocimiento sustituto debe ser de la misma empresa y estar validado';
      END IF;
    ELSIF OLD.estado = 'sustituido' THEN
      NEW.sustituido_por_id := NULL;
    END IF;
    NEW.estado_cambiado_por := auth.uid();
    NEW.estado_cambiado_en := now();
  ELSIF NEW.sustituido_por_id IS DISTINCT FROM OLD.sustituido_por_id AND NEW.estado <> 'sustituido' THEN
    NEW.sustituido_por_id := OLD.sustituido_por_id;
  END IF;

  IF NEW.estado = 'validado' AND OLD.estado IS DISTINCT FROM 'validado' THEN
    NEW.validado_por := auth.uid();
    NEW.validado_en := now();
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado
        AND NEW.estado NOT IN ('validado','obsoleto','sustituido') THEN
    NEW.validado_por := NULL;
    NEW.validado_en := NULL;
    NEW.comentario_validacion := NULL;
  ELSIF NEW.estado IN ('obsoleto','sustituido') THEN
    NEW.validado_por := OLD.validado_por;
    NEW.validado_en := OLD.validado_en;
    NEW.comentario_validacion := OLD.comentario_validacion;
  ELSIF NEW.estado = 'validado' THEN
    NEW.comentario_validacion := OLD.comentario_validacion;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;