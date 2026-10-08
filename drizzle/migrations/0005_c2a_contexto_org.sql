ALTER TABLE public.impersonation_logs ADD COLUMN IF NOT EXISTS tipo_cierre text;
ALTER TABLE public.impersonation_logs ADD CONSTRAINT impersonation_logs_tipo_cierre_check
  CHECK (tipo_cierre IS NULL OR tipo_cierre IN ('usuario','administrativo','cierre_sesion','inicio_sesion'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_activa_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT il.org_id FROM public.impersonation_logs il
      WHERE public.is_super_admin() AND il.super_admin_id = auth.uid()
        AND il.ended_at IS NULL AND il.started_at > now() - interval '8 hours'
      ORDER BY il.started_at DESC LIMIT 1),
    (SELECT p.org_activa_id FROM public.profiles p
      JOIN public.org_members m ON m.user_id = p.id AND m.org_id = p.org_activa_id
      WHERE p.id = auth.uid() LIMIT 1),
    (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.contexto_org_actual()
RETURNS TABLE(org_id uuid, rol_en_org text, es_super_admin boolean, soporte_log_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sa boolean; v_log uuid; v_org uuid; v_rol text;
BEGIN
  v_sa := public.is_super_admin();
  IF v_sa THEN
    SELECT il.id INTO v_log FROM public.impersonation_logs il
     WHERE il.super_admin_id = auth.uid() AND il.ended_at IS NULL
       AND il.started_at > now() - interval '8 hours'
     ORDER BY il.started_at DESC LIMIT 1;
  END IF;
  v_org := public.get_user_org_id();
  IF v_log IS NOT NULL THEN
    v_rol := 'super_admin';
  ELSIF v_org IS NOT NULL THEN
    SELECT m.role::text INTO v_rol FROM public.org_members m WHERE m.user_id = auth.uid() AND m.org_id = v_org;
  END IF;
  RETURN QUERY SELECT v_org, v_rol, v_sa, v_log;
END $$;

CREATE OR REPLACE FUNCTION public.set_org_activa(_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid() AND org_id = _org) THEN
    RAISE EXCEPTION 'No perteneces a esa organización';
  END IF;
  UPDATE public.profiles SET org_activa_id = _org WHERE id = auth.uid();
  INSERT INTO public.audit_trail (user_id, tabla, registro_id, accion, valor_nuevo, org_id)
  VALUES (auth.uid(), 'profiles', auth.uid()::text, 'CAMBIO_EMPRESA_ACTIVA', jsonb_build_object('org_activa_id', _org), _org);
END $$;

CREATE OR REPLACE FUNCTION public.mis_organizaciones()
RETURNS TABLE(org_id uuid, nombre text, rol text, es_activa boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.org_id, o.nombre, m.role::text, (m.org_id = public.get_user_org_id())
  FROM public.org_members m JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = auth.uid() ORDER BY m.created_at
$$;

CREATE OR REPLACE FUNCTION public.cerrar_mis_soportes(_tipo text, _log_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF _tipo NOT IN ('usuario','cierre_sesion','inicio_sesion') THEN
    RAISE EXCEPTION 'tipo_cierre inválido';
  END IF;
  UPDATE public.impersonation_logs SET ended_at = now(), tipo_cierre = _tipo
   WHERE super_admin_id = auth.uid() AND ended_at IS NULL
     AND (_log_id IS NULL OR id = _log_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.contexto_org_actual() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_org_activa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mis_organizaciones() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cerrar_mis_soportes(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contexto_org_actual() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_org_activa(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mis_organizaciones() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cerrar_mis_soportes(text, uuid) TO authenticated, service_role;