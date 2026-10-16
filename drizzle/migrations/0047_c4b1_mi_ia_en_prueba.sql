CREATE OR REPLACE FUNCTION public.mi_ia_en_prueba() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM ia_config_org c JOIN organizations o ON o.id=c.org_id
    WHERE c.org_id = public.get_user_org_id() AND c.composicion_riesgos='bloques_borrador' AND o.es_prueba)
$$;
REVOKE ALL ON FUNCTION public.mi_ia_en_prueba() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mi_ia_en_prueba() TO authenticated;