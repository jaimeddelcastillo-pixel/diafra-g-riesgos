
CREATE TABLE public.capacitacion_progreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.get_user_org_id(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  curso_id text NOT NULL,
  leccion_id text NOT NULL,
  completado boolean NOT NULL DEFAULT false,
  completado_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, curso_id, leccion_id)
);

ALTER TABLE public.capacitacion_progreso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own progreso"
ON public.capacitacion_progreso FOR SELECT TO authenticated
USING ((org_id = public.get_user_org_id() AND user_id = auth.uid()) OR public.is_super_admin());

CREATE POLICY "Users insert own progreso"
ON public.capacitacion_progreso FOR INSERT TO authenticated
WITH CHECK (org_id = public.get_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users update own progreso"
ON public.capacitacion_progreso FOR UPDATE TO authenticated
USING (org_id = public.get_user_org_id() AND user_id = auth.uid())
WITH CHECK (org_id = public.get_user_org_id() AND user_id = auth.uid());

CREATE TRIGGER capacitacion_progreso_updated_at
BEFORE UPDATE ON public.capacitacion_progreso
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
