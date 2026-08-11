-- Tabla 8/14 Cerebro Institucional: ítems de conocimiento
CREATE TABLE public.brain_knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  proceso_id uuid REFERENCES public.brain_processes(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN (
    'identidad_organizacional','producto_proceso','rol_responsabilidad',
    'requisito_regulatorio','arquitectura_sgc','criterio_documental',
    'conocimiento_operativo','riesgo_control','validacion_calificacion',
    'desviacion_capa','auditoria_aprendizaje','regla_pno')),
  contenido text NOT NULL,
  contexto jsonb,
  estado text NOT NULL DEFAULT 'capturado' CHECK (estado IN (
    'no_explorado','en_entrevista','capturado','contrastado',
    'validado','por_validar','contradictorio','brecha')),
  marco_validado boolean NOT NULL DEFAULT false,
  validado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  validado_en timestamptz,
  motivo_invalidacion text,
  afecta_cumplimiento boolean,
  folio_id uuid REFERENCES public.folios(id) ON DELETE SET NULL,
  riesgo_id uuid REFERENCES public.riesgos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brain_knowledge_items_org ON public.brain_knowledge_items(org_id);
CREATE INDEX idx_brain_knowledge_items_estado ON public.brain_knowledge_items(org_id, estado);
CREATE INDEX idx_brain_knowledge_items_proceso ON public.brain_knowledge_items(proceso_id);
CREATE INDEX idx_brain_knowledge_items_area ON public.brain_knowledge_items(area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_knowledge_items TO authenticated;
GRANT ALL ON public.brain_knowledge_items TO service_role;

ALTER TABLE public.brain_knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_knowledge_items_select_org"
ON public.brain_knowledge_items FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_knowledge_items_insert_captura"
ON public.brain_knowledge_items FOR INSERT TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_knowledge_items_update_gobernanza"
ON public.brain_knowledge_items FOR UPDATE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
)
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_knowledge_items_delete_admin"
ON public.brain_knowledge_items FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin()
);

-- Gobernanza: estado inicial forzado en INSERT y trazabilidad de validación
CREATE OR REPLACE FUNCTION public.brain_knowledge_items_governance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado NOT IN ('capturado','en_entrevista','no_explorado') THEN
      NEW.estado := 'capturado';
    END IF;
    NEW.validado_por := NULL;
    NEW.validado_en := NULL;
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.marco_validado IS DISTINCT FROM OLD.marco_validado
     OR NEW.motivo_invalidacion IS DISTINCT FROM OLD.motivo_invalidacion
     OR NEW.afecta_cumplimiento IS DISTINCT FROM OLD.afecta_cumplimiento THEN
    IF NOT (has_role(auth.uid(), 'admin')
            OR has_role(auth.uid(), 'responsable_sanitario')
            OR is_super_admin()) THEN
      RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden cambiar el estado de validación';
    END IF;
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
$$;

CREATE TRIGGER brain_knowledge_items_governance_trg
BEFORE INSERT OR UPDATE ON public.brain_knowledge_items
FOR EACH ROW EXECUTE FUNCTION public.brain_knowledge_items_governance();

CREATE TRIGGER brain_knowledge_items_updated_at
BEFORE UPDATE ON public.brain_knowledge_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();