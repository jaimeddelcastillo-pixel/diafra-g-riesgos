-- Cerebro Institucional: procesos que cubre cada asignación de entrevista.
CREATE TABLE public.brain_assignment_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.brain_interview_assignments(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES public.brain_processes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, process_id)
);

CREATE INDEX brain_assignment_processes_org_idx ON public.brain_assignment_processes(org_id);
CREATE INDEX brain_assignment_processes_proc_idx ON public.brain_assignment_processes(process_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_assignment_processes TO authenticated;
GRANT ALL ON public.brain_assignment_processes TO service_role;

ALTER TABLE public.brain_assignment_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_assignment_processes_select_org"
ON public.brain_assignment_processes FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_assignment_processes_insert_captura"
ON public.brain_assignment_processes FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
  )
);

CREATE POLICY "brain_assignment_processes_delete_captura"
ON public.brain_assignment_processes FOR DELETE TO authenticated
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