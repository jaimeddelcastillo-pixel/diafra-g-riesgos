DROP FUNCTION IF EXISTS public.auditoria_actividad(uuid);
CREATE FUNCTION public.auditoria_actividad(p_auditoria_id uuid)
 RETURNS TABLE(fecha timestamptz, accion text, tipo text, item_id text, archivo text, sha256 text, modo text, ip text, persona text, es_auditor boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_aud uuid;
BEGIN
  SELECT a.org_id, a.auditor_user_id INTO v_org, v_aud FROM public.auditorias_externas a WHERE a.id = p_auditoria_id;
  IF v_org IS NULL OR NOT (public.is_super_admin() OR (v_org = public.get_user_org_id()
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')))) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT t.created_at, t.accion, t.valor_nuevo->>'tipo', t.registro_id::text, t.valor_nuevo->>'archivo',
         t.valor_nuevo->>'sha256', t.valor_nuevo->>'modo', t.ip::text,
         CASE WHEN t.user_id IS NULL THEN 'Sistema' ELSE COALESCE(p.nombre, p.email, 'No registrado') END,
         (t.accion IN ('AUDITOR_CONSULTO','AUDITOR_DESCARGO'))
    FROM public.audit_trail t LEFT JOIN public.profiles p ON p.id = t.user_id
   WHERE t.org_id = v_org AND t.accion IN ('AUDITOR_CONSULTO','AUDITOR_DESCARGO','AUDITORIA_ACTIVADA','AUDITORIA_DUPLICADA')
     AND t.valor_nuevo->>'auditoria_id' = p_auditoria_id::text
   ORDER BY t.created_at DESC;
END $function$;
REVOKE ALL ON FUNCTION public.auditoria_actividad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_actividad(uuid) TO authenticated;