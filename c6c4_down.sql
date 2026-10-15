-- Reversión C6c.4: vuelve auditoria_actividad a su forma de C6c.1 (sin persona ni grupo).
DROP FUNCTION IF EXISTS public.auditoria_actividad(uuid);
CREATE FUNCTION public.auditoria_actividad(p_auditoria_id uuid)
 RETURNS TABLE(fecha timestamptz, accion text, tipo text, item_id text, archivo text, sha256 text, modo text, ip text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT a.org_id INTO v_org FROM public.auditorias_externas a WHERE a.id = p_auditoria_id;
  IF v_org IS NULL OR NOT (public.is_super_admin() OR (v_org = public.get_user_org_id()
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable_sanitario')))) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT t.created_at, t.accion, t.valor_nuevo->>'tipo', t.registro_id, t.valor_nuevo->>'archivo',
         t.valor_nuevo->>'sha256', t.valor_nuevo->>'modo', t.ip
    FROM public.audit_trail t
   WHERE t.org_id = v_org AND t.accion IN ('AUDITOR_CONSULTO','AUDITOR_DESCARGO','AUDITORIA_ACTIVADA','AUDITORIA_DUPLICADA')
     AND t.valor_nuevo->>'auditoria_id' = p_auditoria_id::text
   ORDER BY t.created_at DESC;
END $function$;
GRANT EXECUTE ON FUNCTION public.auditoria_actividad(uuid) TO authenticated;
