-- C2b Parte F: nombres de exmiembros sin ampliar la lectura de profiles.
CREATE OR REPLACE FUNCTION public.nombres_personas(_ids uuid[])
 RETURNS TABLE(id uuid, nombre text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.nombre
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_ids)
    AND public.get_user_org_id() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = p.id AND m.org_id = public.get_user_org_id())
      OR EXISTS (SELECT 1 FROM public.audit_trail a WHERE a.org_id = public.get_user_org_id()
                 AND (a.user_id = p.id OR (a.tabla = 'profiles' AND a.registro_id = p.id::text)))
    )
$function$;
REVOKE ALL ON FUNCTION public.nombres_personas(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nombres_personas(uuid[]) TO authenticated;