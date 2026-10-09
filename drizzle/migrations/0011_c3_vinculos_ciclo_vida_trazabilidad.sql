-- ===== C3 Parte A: vínculos genéricos =====
CREATE TABLE public.vinculo_tipos_entidad (
  tipo text PRIMARY KEY,
  modulo text NOT NULL REFERENCES public.modulos(clave),
  tabla text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.vinculo_tipos_entidad TO authenticated;
GRANT ALL ON public.vinculo_tipos_entidad TO service_role;
ALTER TABLE public.vinculo_tipos_entidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY vinculo_tipos_select_auth ON public.vinculo_tipos_entidad FOR SELECT TO authenticated USING (true);
CREATE POLICY vinculo_tipos_write_super ON public.vinculo_tipos_entidad FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
INSERT INTO public.vinculo_tipos_entidad (tipo, modulo, tabla, descripcion) VALUES
  ('folio','riesgos','folios','Folio de gestión de riesgos'),
  ('riesgo','riesgos','riesgos','Riesgo (ID) dentro de un folio');

CREATE TABLE public.brain_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  knowledge_item_id uuid NOT NULL REFERENCES public.brain_knowledge_items(id) ON DELETE CASCADE,
  entidad_tipo text NOT NULL REFERENCES public.vinculo_tipos_entidad(tipo),
  entidad_id uuid NOT NULL,
  relacion text NOT NULL CHECK (relacion IN ('origen','aplica_a','evidencia','referencia')),
  nota text,
  creado_por uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (knowledge_item_id, entidad_tipo, entidad_id, relacion)
);
CREATE INDEX brain_vinculos_entidad_idx ON public.brain_vinculos (entidad_tipo, entidad_id);
CREATE INDEX brain_vinculos_org_idx ON public.brain_vinculos (org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_vinculos TO authenticated;
GRANT ALL ON public.brain_vinculos TO service_role;

CREATE OR REPLACE FUNCTION public.brain_vinculos_integridad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_activo boolean; v_org uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.creado_por IS NULL THEN NEW.creado_por := auth.uid(); END IF;
  IF NOT EXISTS (SELECT 1 FROM brain_knowledge_items WHERE id = NEW.knowledge_item_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'El vínculo debe ser con una entidad de la misma empresa';
  END IF;
  SELECT activo INTO v_activo FROM vinculo_tipos_entidad WHERE tipo = NEW.entidad_tipo;
  IF v_activo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Tipo de entidad inactivo o inexistente: %', NEW.entidad_tipo;
  END IF;
  IF NEW.entidad_tipo = 'folio' THEN
    SELECT org_id INTO v_org FROM folios WHERE id = NEW.entidad_id;
  ELSIF NEW.entidad_tipo = 'riesgo' THEN
    SELECT f.org_id INTO v_org FROM riesgos r JOIN folios f ON f.id = r.folio_id WHERE r.id = NEW.entidad_id;
  ELSE
    RAISE EXCEPTION 'Tipo de entidad sin regla de validación: %', NEW.entidad_tipo;
  END IF;
  IF v_org IS NULL OR v_org <> NEW.org_id THEN
    RAISE EXCEPTION 'El vínculo debe ser con una entidad de la misma empresa';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_brain_vinculos_integridad BEFORE INSERT OR UPDATE ON public.brain_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.brain_vinculos_integridad();
CREATE TRIGGER trg_audit_brain_vinculos AFTER INSERT OR UPDATE OR DELETE ON public.brain_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

ALTER TABLE public.brain_vinculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY brain_vinculos_select_org ON public.brain_vinculos FOR SELECT TO authenticated
  USING (((org_id = public.get_user_org_id()) OR public.is_super_admin()) AND public.mi_org_tiene_modulo('institutional_brain'));
CREATE POLICY brain_vinculos_insert_gob ON public.brain_vinculos FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()) AND public.mi_org_tiene_modulo('institutional_brain'));
CREATE POLICY brain_vinculos_update_gob ON public.brain_vinculos FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()) AND public.mi_org_tiene_modulo('institutional_brain'))
  WITH CHECK (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()) AND public.mi_org_tiene_modulo('institutional_brain'));
CREATE POLICY brain_vinculos_delete_gob ON public.brain_vinculos FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario') OR public.is_super_admin()) AND public.mi_org_tiene_modulo('institutional_brain'));

-- ===== C3 Parte B: migrar folio_id / riesgo_id (0 filas esperadas) =====
INSERT INTO public.brain_vinculos (org_id, knowledge_item_id, entidad_tipo, entidad_id, relacion, nota)
SELECT org_id, id, 'folio', folio_id, 'aplica_a', 'migrado en C3' FROM public.brain_knowledge_items WHERE folio_id IS NOT NULL;
INSERT INTO public.brain_vinculos (org_id, knowledge_item_id, entidad_tipo, entidad_id, relacion, nota)
SELECT org_id, id, 'riesgo', riesgo_id, 'aplica_a', 'migrado en C3' FROM public.brain_knowledge_items WHERE riesgo_id IS NOT NULL;
COMMENT ON COLUMN public.brain_knowledge_items.folio_id IS 'DEPRECATED (C3): reemplazado por brain_vinculos';
COMMENT ON COLUMN public.brain_knowledge_items.riesgo_id IS 'DEPRECATED (C3): reemplazado por brain_vinculos';
COMMENT ON COLUMN public.brain_processes.folio_id IS 'DEPRECATED (C3): reemplazado por vínculos genéricos';

-- ===== C3 Parte C: ciclo de vida =====
ALTER TABLE public.brain_knowledge_items DROP CONSTRAINT brain_knowledge_items_estado_check;
ALTER TABLE public.brain_knowledge_items ADD CONSTRAINT brain_knowledge_items_estado_check CHECK (estado = ANY (ARRAY['no_explorado','en_entrevista','capturado','contrastado','validado','por_validar','contradictorio','brecha','obsoleto','sustituido']));
ALTER TABLE public.brain_knowledge_items
  ADD COLUMN sustituido_por_id uuid REFERENCES public.brain_knowledge_items(id),
  ADD COLUMN motivo_estado text,
  ADD COLUMN estado_cambiado_por uuid,
  ADD COLUMN estado_cambiado_en timestamptz,
  ADD COLUMN actualizado_por uuid;

CREATE OR REPLACE FUNCTION public.brain_knowledge_items_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_dest record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado NOT IN ('capturado','en_entrevista','no_explorado','por_validar') THEN
      NEW.estado := 'capturado';
    END IF;
    NEW.validado_por := NULL;
    NEW.validado_en := NULL;
    NEW.sustituido_por_id := NULL;
    NEW.estado_cambiado_por := NULL;
    NEW.estado_cambiado_en := NULL;
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.marco_validado IS DISTINCT FROM OLD.marco_validado
     OR NEW.motivo_invalidacion IS DISTINCT FROM OLD.motivo_invalidacion
     OR NEW.afecta_cumplimiento IS DISTINCT FROM OLD.afecta_cumplimiento
     OR NEW.sustituido_por_id IS DISTINCT FROM OLD.sustituido_por_id THEN
    IF NOT (has_role(auth.uid(), 'admin')
            OR has_role(auth.uid(), 'responsable_sanitario')
            OR is_super_admin()) THEN
      RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden cambiar el estado de validación';
    END IF;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado IN ('obsoleto','sustituido') AND NEW.estado <> 'por_validar' THEN
      RAISE EXCEPTION 'Desde % solo se puede volver a por_validar', OLD.estado;
    END IF;
    IF NEW.estado = 'obsoleto' THEN
      IF coalesce(btrim(NEW.motivo_estado),'') = '' THEN
        RAISE EXCEPTION 'Marcar como obsoleto exige un motivo';
      END IF;
      NEW.sustituido_por_id := NULL;
    ELSIF NEW.estado = 'sustituido' THEN
      IF coalesce(btrim(NEW.motivo_estado),'') = '' OR NEW.sustituido_por_id IS NULL THEN
        RAISE EXCEPTION 'Sustituir exige motivo y el conocimiento que lo sustituye';
      END IF;
      IF NEW.sustituido_por_id = NEW.id THEN
        RAISE EXCEPTION 'Un conocimiento no puede sustituirse a sí mismo';
      END IF;
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
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado <> 'validado' THEN
    NEW.validado_por := NULL;
    NEW.validado_en := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- ===== C3 Parte D: trazabilidad =====
ALTER TABLE public.brain_knowledge_sources ADD COLUMN documento_codigo text, ADD COLUMN documento_revision text;
CREATE OR REPLACE FUNCTION public.brain_sources_revision_documento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.documento_id IS NOT NULL THEN
    SELECT codigo, revision INTO NEW.documento_codigo, NEW.documento_revision
    FROM brain_documents WHERE id = NEW.documento_id AND org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_brain_sources_revision BEFORE INSERT ON public.brain_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.brain_sources_revision_documento();
UPDATE public.brain_knowledge_sources s
   SET documento_codigo = d.codigo, documento_revision = d.revision,
       descripcion = coalesce(s.descripcion || ' — ', '') || 'revisión registrada en migración C3'
  FROM public.brain_documents d
 WHERE d.id = s.documento_id;

ALTER TABLE public.audit_trail ADD COLUMN solicitado_por uuid;
ALTER TABLE public.brain_interview_sessions ADD COLUMN actualizado_por uuid;
ALTER TABLE public.brain_documents ADD COLUMN actualizado_por uuid;
ALTER TABLE public.brain_import_batches ADD COLUMN actualizado_por uuid;

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_org_id    UUID;
  v_record_id TEXT;
  v_solicitado UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id    := (to_jsonb(OLD) ->> 'org_id')::UUID;
    v_record_id := (to_jsonb(OLD) ->> 'id');
  ELSE
    v_org_id    := (to_jsonb(NEW) ->> 'org_id')::UUID;
    v_record_id := (to_jsonb(NEW) ->> 'id');
    IF auth.uid() IS NULL THEN
      BEGIN
        v_solicitado := (to_jsonb(NEW) ->> 'actualizado_por')::UUID;
      EXCEPTION WHEN others THEN v_solicitado := NULL;
      END;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    v_org_id := public.get_user_org_id();
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, solicitado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_solicitado);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo, solicitado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW), v_solicitado);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$function$;