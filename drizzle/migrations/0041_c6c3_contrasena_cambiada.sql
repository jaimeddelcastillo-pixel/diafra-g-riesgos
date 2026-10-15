CREATE OR REPLACE FUNCTION public.registrar_cambio_contrasena(_origen text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sin sesión'; END IF;
  IF _origen NOT IN ('invitacion','recuperacion','perfil') THEN RAISE EXCEPTION 'Origen inválido'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
  VALUES (_uid, public.get_user_org_id(), 'auth.users', _uid::text, 'CONTRASENA_CAMBIADA',
    jsonb_build_object('origen', _origen, 'cuenta', _email,
      'amr', COALESCE(auth.jwt()->'amr', 'null'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION public.registrar_cambio_contrasena(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_cambio_contrasena(text) TO authenticated;