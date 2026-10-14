-- Reversión P1c.1 (ejecutar antes de p1c_down.sql). Restaurar primero el código anterior a P1c.1.
DROP TRIGGER IF EXISTS trg_examen_intentos_acceso ON public.curso_examen_intentos;
DROP FUNCTION IF EXISTS public.examen_intentos_acceso_guard();
CREATE OR REPLACE FUNCTION public.examen_validar_banco(p_curso_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$ DECLARE v_counts jsonb; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT jsonb_object_agg(bloque, n) INTO v_counts FROM (SELECT bloque, COUNT(*)::int AS n
    FROM public.curso_evaluacion_preguntas WHERE curso_id = p_curso_id AND activo = true GROUP BY bloque) t;
  RETURN COALESCE(v_counts, '{}'::jsonb); END; $f$;
DROP POLICY IF EXISTS "Entitled org read cursos" ON public.cursos;
CREATE POLICY "Entitled org read cursos" ON public.cursos FOR SELECT USING (is_super_admin() OR org_has_curso_access(get_user_org_id()));
DROP POLICY IF EXISTS "Entitled org read curso_modulos" ON public.curso_modulos;
CREATE POLICY "Entitled org read curso_modulos" ON public.curso_modulos FOR SELECT USING (is_super_admin() OR org_has_curso_access(get_user_org_id()));
DROP POLICY IF EXISTS "Entitled org read curso_lecciones" ON public.curso_lecciones;
CREATE POLICY "Entitled org read curso_lecciones" ON public.curso_lecciones FOR SELECT USING (is_super_admin() OR org_has_curso_access(get_user_org_id()));
DROP FUNCTION IF EXISTS public.examen_validar_acceso(uuid);
DROP FUNCTION IF EXISTS public.mis_cursos_certificados();
DROP FUNCTION IF EXISTS public.curso_modulo_en_vista_previa(uuid);
DROP FUNCTION IF EXISTS public.mi_acceso_curso(uuid);
DROP FUNCTION IF EXISTS public.acceso_curso_org(uuid, uuid);
