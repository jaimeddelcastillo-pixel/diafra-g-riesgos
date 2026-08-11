-- Fase 1 · Tabla 7/14: sesiones de entrevista del Cerebro Institucional
CREATE TABLE public.brain_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.brain_interview_assignments(id) ON DELETE SET NULL,
  entrevistado_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entrevistado_nombre text,
  interview_thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  estado text NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso','pausada','finalizada','cancelada')),
  objetivo_actual text,
  resumen text,
  preguntas_realizadas integer NOT NULL DEFAULT 0,
  items_capturados integer NOT NULL DEFAULT 0,
  iniciada_en timestamptz NOT NULL DEFAULT now(),
  finalizada_en timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brain_interview_sessions_org_idx ON public.brain_interview_sessions (org_id, estado);
CREATE INDEX brain_interview_sessions_assignment_idx ON public.brain_interview_sessions (assignment_id);
CREATE INDEX brain_interview_sessions_thread_idx ON public.brain_interview_sessions (interview_thread_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_interview_sessions TO authenticated;
GRANT ALL ON public.brain_interview_sessions TO service_role;

ALTER TABLE public.brain_interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_sessions_select_org_members"
ON public.brain_interview_sessions FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_sessions_insert_captura"
ON public.brain_interview_sessions FOR INSERT TO authenticated
WITH CHECK (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')
  ))
  OR public.is_super_admin()
);

CREATE POLICY "brain_sessions_update_captura"
ON public.brain_interview_sessions FOR UPDATE TO authenticated
USING (
  (org_id = public.get_user_org_id() AND (
    public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'responsable_sanitario')
  ))
  OR public.is_super_admin()
)
WITH CHECK (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "brain_sessions_delete_admin"
ON public.brain_interview_sessions FOR DELETE TO authenticated
USING ((org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin')) OR public.is_super_admin());

CREATE TRIGGER brain_interview_sessions_updated_at
BEFORE UPDATE ON public.brain_interview_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();