-- C2b.1: empresas canceladas no se ofrecen, no se activan y no se eligen como respaldo.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT il.org_id FROM public.impersonation_logs il
      WHERE public.is_super_admin() AND il.super_admin_id = auth.uid()
        AND il.ended_at IS NULL AND il.started_at > now() - interval '8 hours'
      ORDER BY il.started_at DESC LIMIT 1),
    (SELECT p.org_activa_id FROM public.profiles p
      JOIN public.org_members m ON m.user_id = p.id AND m.org_id = p.org_activa_id
      JOIN public.organizations o ON o.id = m.org_id AND o.estado IS DISTINCT FROM 'cancelado'
      WHERE p.id = auth.uid() LIMIT 1),
    (SELECT m.org_id FROM public.org_members m
      JOIN public.organizations o ON o.id = m.org_id AND o.estado IS DISTINCT FROM 'cancelado'
      WHERE m.user_id = auth.uid() ORDER BY m.created_at ASC LIMIT 1)
  )
$function$;

CREATE OR REPLACE FUNCTION public.mis_organizaciones()
 RETURNS TABLE(org_id uuid, nombre text, rol text, es_activa boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT m.org_id, o.nombre, m.role::text, (m.org_id = public.get_user_org_id())
  FROM public.org_members m JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = auth.uid() AND o.estado IS DISTINCT FROM 'cancelado'
  ORDER BY m.created_at
$function$;

CREATE OR REPLACE FUNCTION public.set_org_activa(_org uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid() AND org_id = _org) THEN
    RAISE EXCEPTION 'No perteneces a esa organización';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = _org AND estado = 'cancelado') THEN
    RAISE EXCEPTION 'Esta empresa está cancelada';
  END IF;
  UPDATE public.profiles SET org_activa_id = _org WHERE id = auth.uid();
  INSERT INTO public.audit_trail (user_id, tabla, registro_id, accion, valor_nuevo, org_id)
  VALUES (auth.uid(), 'profiles', auth.uid()::text, 'CAMBIO_EMPRESA_ACTIVA', jsonb_build_object('org_activa_id', _org), _org);
END $function$;