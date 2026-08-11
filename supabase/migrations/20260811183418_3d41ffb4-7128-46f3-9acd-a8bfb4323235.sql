-- Tabla 11/14 Cerebro Institucional: brechas de conocimiento
CREATE TABLE public.brain_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  por_que_importa text,
  tipo_conocimiento text,
  proceso_id uuid REFERENCES public.brain_processes(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.brain_interview_sessions(id) ON DELETE SET NULL,
  assignment_sugerido_id uuid REFERENCES public.brain_interview_assignments(id) ON DELETE SET NULL,
  rol_sugerido text,
  prioridad text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','asignada','cerrada','descartada')),
  cerrada_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brain_gaps_org ON public.brain_gaps(org_id, estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_gaps TO authenticated;
GRANT ALL ON public.brain_gaps TO service_role;

ALTER TABLE public.brain_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_gaps_select_org"
ON public.brain_gaps FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_gaps_insert_captura"
ON public.brain_gaps FOR INSERT TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_gaps_update_captura"
ON public.brain_gaps FOR UPDATE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
)
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')))
  OR public.is_super_admin()
);

CREATE POLICY "brain_gaps_delete_admin"
ON public.brain_gaps FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
  OR public.is_super_admin()
);

CREATE OR REPLACE FUNCTION public.brain_gaps_governance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.estado := 'abierta';
    NEW.cerrada_en := NULL;
    RETURN NEW;
  END IF;

  IF NEW.estado IN ('cerrada','descartada') AND OLD.estado NOT IN ('cerrada','descartada') THEN
    NEW.cerrada_en := now();
  ELSIF NEW.estado IN ('abierta','asignada') THEN
    NEW.cerrada_en := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER brain_gaps_governance_trg
BEFORE INSERT OR UPDATE ON public.brain_gaps
FOR EACH ROW EXECUTE FUNCTION public.brain_gaps_governance();