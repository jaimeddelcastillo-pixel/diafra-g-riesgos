DROP POLICY IF EXISTS "Authenticated read curso_evaluacion_preguntas" ON public.curso_evaluacion_preguntas;

CREATE POLICY "Admin read curso_evaluacion_preguntas"
ON public.curso_evaluacion_preguntas
FOR SELECT
TO authenticated
USING (
  is_super_admin() OR has_role(auth.uid(), 'admin'::app_role)
);