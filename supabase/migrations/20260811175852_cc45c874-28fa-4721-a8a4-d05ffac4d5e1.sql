-- Cerebro Institucional: relación muchos-a-muchos entre procesos y áreas participantes.
CREATE TABLE public.brain_process_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES public.brain_processes(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.brain_areas(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'participante'
    CHECK (rol IN ('responsable','participante','soporte')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (process_id, area_id)
);

CREATE INDEX brain_process_areas_org_idx ON public.brain_process_areas(org_id);
CREATE INDEX brain_process_areas_area_idx ON public.brain_process_areas(area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_process_areas TO authenticated;
GRANT ALL ON public.brain_process_areas TO service_role;

ALTER TABLE public.brain_process_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_process_areas_select_org"
ON public.brain_process_areas FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_process_areas_insert_captura"
ON public.brain_process_areas FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
);

CREATE POLICY "brain_process_areas_delete_captura"
ON public.brain_process_areas FOR DELETE TO authenticated
USING (
  (
    org_id = public.get_user_org_id()
    AND (
      public.has_role(auth.uid(), 'operador'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
    )
  )
  OR public.is_super_admin()
);