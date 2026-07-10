
CREATE OR REPLACE FUNCTION public.org_has_curso_access(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id
      AND o.activo = true
      AND (
        (o.tiene_curso_pagado = true
         AND (o.curso_expira_en IS NULL OR o.curso_expira_en > now()))
        OR
        (o.estado::text = 'activo'
         AND COALESCE(o.plan, '') NOT IN ('trial', 'trial-demo', ''))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.org_has_curso_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_has_curso_access(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated read cursos" ON public.cursos;
DROP POLICY IF EXISTS "Authenticated read curso_modulos" ON public.curso_modulos;
DROP POLICY IF EXISTS "Authenticated read curso_lecciones" ON public.curso_lecciones;

CREATE POLICY "Entitled org read cursos"
ON public.cursos FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.org_has_curso_access(public.get_user_org_id()));

CREATE POLICY "Entitled org read curso_modulos"
ON public.curso_modulos FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.org_has_curso_access(public.get_user_org_id()));

CREATE POLICY "Entitled org read curso_lecciones"
ON public.curso_lecciones FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.org_has_curso_access(public.get_user_org_id()));
