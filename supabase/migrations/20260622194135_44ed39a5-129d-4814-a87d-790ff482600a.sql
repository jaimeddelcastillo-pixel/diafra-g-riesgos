
-- 1) curso_diplomas: remove public read, add owner read + RPC for hash verification
DROP POLICY IF EXISTS "Verificación pública por hash" ON public.curso_diplomas;

CREATE POLICY "Usuarios ven sus propios diplomas"
  ON public.curso_diplomas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin() OR (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'::app_role)));

CREATE OR REPLACE FUNCTION public.verificar_diploma(p_hash text)
RETURNS TABLE (
  folio text,
  alumno_nombre text,
  curso_titulo text,
  curso_norma text,
  fecha_emision timestamptz,
  calificacion numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.folio, d.alumno_nombre, d.curso_titulo, d.curso_norma, d.fecha_emision, d.calificacion
  FROM public.curso_diplomas d
  WHERE p_hash IS NOT NULL
    AND length(p_hash) >= 16
    AND d.hash_verificacion = p_hash
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_diploma(text) TO anon, authenticated;

-- 2) curso_evaluacion_preguntas: restrict reads to super_admin only (hide correct answers from org admins)
DROP POLICY IF EXISTS "Admin read curso_evaluacion_preguntas" ON public.curso_evaluacion_preguntas;

CREATE POLICY "Super admin read curso_evaluacion_preguntas"
  ON public.curso_evaluacion_preguntas FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 3) realtime: remove the "topic without colon" bypass; enforce strict {tabla}:{org_id}:{folio_id} format
DROP POLICY IF EXISTS "Authenticated can read own org realtime" ON realtime.messages;

CREATE POLICY "Authenticated can read own org realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.topic() IS NOT NULL
    AND POSITION(':' IN realtime.topic()) > 0
    AND split_part(realtime.topic(), ':', 2) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = public.get_user_org_id()
  );
