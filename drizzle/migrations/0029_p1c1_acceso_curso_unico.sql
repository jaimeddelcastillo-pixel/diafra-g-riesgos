-- P1c.1: una sola regla de acceso al curso.
CREATE OR REPLACE FUNCTION public.acceso_curso_org(p_org uuid, p_curso_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.cursos c WHERE c.id = p_curso_id AND c.activo) THEN 'ninguno'
    WHEN EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org AND o.activo = true AND (
        (o.estado::text = 'activo' AND COALESCE(o.plan,'') NOT IN ('trial','trial-demo',''))
        OR (o.tiene_curso_pagado = true AND o.curso_expira_en IS NOT NULL AND o.curso_expira_en > now())
      )) THEN 'completo'
    WHEN EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org AND o.activo = true AND o.estado::text = 'activo'
        AND o.plan IN ('trial','trial-demo')) THEN 'vista_previa'
    ELSE 'ninguno'
  END
$$;
REVOKE ALL ON FUNCTION public.acceso_curso_org(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acceso_curso_org(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mi_acceso_curso(p_curso_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'ninguno'
    WHEN public.is_super_admin() AND EXISTS (SELECT 1 FROM public.cursos WHERE id = p_curso_id) THEN 'completo'
    ELSE public.acceso_curso_org(public.get_user_org_id(), p_curso_id)
  END
$$;
REVOKE ALL ON FUNCTION public.mi_acceso_curso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_acceso_curso(uuid) TO authenticated, service_role;

-- Vista previa: Introducción y Módulo 1 = los dos primeros módulos activos por orden.
CREATE OR REPLACE FUNCTION public.curso_modulo_en_vista_previa(p_modulo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT m.id, row_number() OVER (PARTITION BY m.curso_id ORDER BY m.orden, m.id) AS rn
      FROM public.curso_modulos m
      WHERE m.activo AND m.curso_id = (SELECT curso_id FROM public.curso_modulos WHERE id = p_modulo_id)
    ) s WHERE s.id = p_modulo_id AND s.rn <= 2)
$$;
GRANT EXECUTE ON FUNCTION public.curso_modulo_en_vista_previa(uuid) TO authenticated, service_role;

-- Agrupar diplomas por módulo sin ocultarlos: solo id, título y módulo de cursos propios.
CREATE OR REPLACE FUNCTION public.mis_cursos_certificados()
RETURNS TABLE(id uuid, titulo text, modulo_clave text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.titulo, c.modulo_clave FROM public.cursos c
  WHERE auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.curso_diplomas d WHERE d.curso_id = c.id AND d.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.curso_examen_intentos i WHERE i.curso_id = c.id AND i.user_id = auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.mis_cursos_certificados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_cursos_certificados() TO authenticated, service_role;

DROP POLICY IF EXISTS "Entitled org read cursos" ON public.cursos;
CREATE POLICY "Entitled org read cursos" ON public.cursos FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.mi_acceso_curso(id) <> 'ninguno');

DROP POLICY IF EXISTS "Entitled org read curso_modulos" ON public.curso_modulos;
CREATE POLICY "Entitled org read curso_modulos" ON public.curso_modulos FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.mi_acceso_curso(curso_id) <> 'ninguno');

DROP POLICY IF EXISTS "Entitled org read curso_lecciones" ON public.curso_lecciones;
CREATE POLICY "Entitled org read curso_lecciones" ON public.curso_lecciones FOR SELECT TO authenticated
  USING (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.curso_modulos m WHERE m.id = curso_lecciones.modulo_id AND (
      public.mi_acceso_curso(m.curso_id) = 'completo'
      OR (public.mi_acceso_curso(m.curso_id) = 'vista_previa' AND public.curso_modulo_en_vista_previa(m.id)))));

-- Examen: solo con acceso completo.
CREATE OR REPLACE FUNCTION public.examen_validar_acceso(p_curso_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.mi_acceso_curso(p_curso_id) <> 'completo' THEN
    RAISE EXCEPTION 'El examen y el diploma requieren acceso completo al curso' USING ERRCODE = '42501';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.examen_validar_acceso(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.examen_intentos_acceso_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.examen_validar_acceso(NEW.curso_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_examen_intentos_acceso ON public.curso_examen_intentos;
CREATE TRIGGER trg_examen_intentos_acceso BEFORE INSERT OR UPDATE ON public.curso_examen_intentos
  FOR EACH ROW EXECUTE FUNCTION public.examen_intentos_acceso_guard();