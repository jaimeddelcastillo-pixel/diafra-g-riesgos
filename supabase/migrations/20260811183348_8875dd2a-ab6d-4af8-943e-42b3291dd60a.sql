-- Tabla 10/14 Cerebro Institucional: contradicciones
CREATE TABLE public.brain_contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_a_id uuid REFERENCES public.brain_knowledge_items(id) ON DELETE SET NULL,
  item_b_id uuid REFERENCES public.brain_knowledge_items(id) ON DELETE SET NULL,
  afirmacion_a text NOT NULL,
  afirmacion_b text NOT NULL,
  fuente_a text,
  fuente_b text,
  descripcion text,
  proceso_id uuid REFERENCES public.brain_processes(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  afecta_cumplimiento boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','en_analisis','resuelta','descartada')),
  decision_final text,
  fundamento text,
  resuelto_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resuelto_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brain_contradictions_org ON public.brain_contradictions(org_id, estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_contradictions TO authenticated;
GRANT ALL ON public.brain_contradictions TO service_role;

ALTER TABLE public.brain_contradictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_contradictions_select_org"
ON public.brain_contradictions FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_contradictions_insert_captura"
ON public.brain_contradictions FOR INSERT TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_contradictions_update_gobernanza"
ON public.brain_contradictions FOR UPDATE TO authenticated
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

CREATE POLICY "brain_contradictions_delete_admin"
ON public.brain_contradictions FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin()
);

CREATE OR REPLACE FUNCTION public.brain_contradictions_governance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.estado := 'abierta';
    NEW.resuelto_por := NULL;
    NEW.resuelto_en := NULL;
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NOT (has_role(auth.uid(), 'admin')
            OR has_role(auth.uid(), 'responsable_sanitario')
            OR is_super_admin()) THEN
      RAISE EXCEPTION 'Solo administradores o responsable sanitario pueden cambiar el estado de una contradicción';
    END IF;
  END IF;

  IF NEW.estado IN ('resuelta','descartada') AND OLD.estado NOT IN ('resuelta','descartada') THEN
    NEW.resuelto_por := auth.uid();
    NEW.resuelto_en := now();
  ELSIF NEW.estado IN ('abierta','en_analisis') THEN
    NEW.resuelto_por := NULL;
    NEW.resuelto_en := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER brain_contradictions_governance_trg
BEFORE INSERT OR UPDATE ON public.brain_contradictions
FOR EACH ROW EXECUTE FUNCTION public.brain_contradictions_governance();