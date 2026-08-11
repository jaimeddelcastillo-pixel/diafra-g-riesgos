-- Cerebro Institucional: catálogo de áreas organizacionales por empresa.
CREATE TABLE public.brain_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  responsable_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brain_areas_org_idx ON public.brain_areas(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_areas TO authenticated;
GRANT ALL ON public.brain_areas TO service_role;

ALTER TABLE public.brain_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_areas_select_org"
ON public.brain_areas FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_areas_insert_captura"
ON public.brain_areas FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
);

CREATE POLICY "brain_areas_update_captura"
ON public.brain_areas FOR UPDATE TO authenticated
USING (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
)
WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "brain_areas_delete_admin"
ON public.brain_areas FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

CREATE TRIGGER brain_areas_updated_at
BEFORE UPDATE ON public.brain_areas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();