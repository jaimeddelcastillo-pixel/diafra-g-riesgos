-- Cerebro Institucional: procesos institucionales identificados por empresa.
CREATE TABLE public.brain_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_area_id UUID REFERENCES public.brain_areas(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  marco_regulatorio TEXT,
  tiene_folio BOOLEAN NOT NULL DEFAULT false,
  folio_id UUID REFERENCES public.folios(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brain_processes_org_idx ON public.brain_processes(org_id);
CREATE INDEX brain_processes_area_idx ON public.brain_processes(owner_area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_processes TO authenticated;
GRANT ALL ON public.brain_processes TO service_role;

ALTER TABLE public.brain_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_processes_select_org"
ON public.brain_processes FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_processes_insert_captura"
ON public.brain_processes FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
);

CREATE POLICY "brain_processes_update_captura"
ON public.brain_processes FOR UPDATE TO authenticated
USING (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
)
WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "brain_processes_delete_admin"
ON public.brain_processes FOR DELETE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.is_super_admin()
);

CREATE TRIGGER brain_processes_updated_at
BEFORE UPDATE ON public.brain_processes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();