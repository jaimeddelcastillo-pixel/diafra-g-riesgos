CREATE OR REPLACE FUNCTION public.cursos_ids_modulo(p_modulo text)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT c.id FROM public.cursos c
 WHERE c.modulo_clave = p_modulo AND auth.uid() IS NOT NULL
 AND (public.is_super_admin() OR public.org_tiene_modulo(public.get_user_org_id(), p_modulo))
$$;
REVOKE ALL ON FUNCTION public.cursos_ids_modulo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cursos_ids_modulo(text) TO authenticated, service_role;
COMMENT ON FUNCTION public.cursos_ids_modulo(text) IS 'Identifiers only, no course content. Allows module filtering of previously issued diplomas without requiring a still-paid course. Existing diploma and attempt RLS remain unchanged.';