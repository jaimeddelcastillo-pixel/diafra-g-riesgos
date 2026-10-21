CREATE OR REPLACE FUNCTION public.org_tiene_modulo(_org uuid, _modulo text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
 SELECT NOT EXISTS(SELECT 1 FROM public.modulos mm WHERE mm.clave=_modulo AND mm.estado='proximamente')
 AND NOT EXISTS(SELECT 1 FROM public.organization_features f WHERE f.org_id=_org AND f.feature_key=_modulo AND NOT f.activo)
 AND ((NOT EXISTS(SELECT 1 FROM public.modulos mm WHERE mm.clave=_modulo AND mm.estado='beta') AND EXISTS(SELECT 1 FROM public.organizations o JOIN public.plan_modulos pm ON pm.plan=o.plan AND pm.modulo=_modulo WHERE o.id=_org))
  OR EXISTS(SELECT 1 FROM public.organization_features f WHERE f.org_id=_org AND f.feature_key=_modulo AND f.activo AND (f.expira_en IS NULL OR f.expira_en>now())))
$f$;

CREATE OR REPLACE FUNCTION public.admin_set_modulo(_org uuid, _clave text, _activo boolean, _motivo text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE v_old jsonb; v_new public.organization_features;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Solo super_admin'; END IF;
  IF length(trim(coalesce(_motivo,''))) < 5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.modulos WHERE clave=_clave) THEN RAISE EXCEPTION 'Módulo desconocido'; END IF;
  SELECT to_jsonb(f) INTO v_old FROM public.organization_features f WHERE org_id=_org AND feature_key=_clave;
  INSERT INTO public.organization_features(org_id, feature_key, activo, activado_en, notas)
  VALUES (_org, _clave, _activo, now(), trim(_motivo))
  ON CONFLICT (org_id, feature_key) DO UPDATE SET activo=EXCLUDED.activo,
    activado_en=CASE WHEN EXCLUDED.activo AND NOT organization_features.activo THEN now() ELSE organization_features.activado_en END,
    notas=EXCLUDED.notas, updated_at=now()
  RETURNING * INTO v_new;
  INSERT INTO public.audit_trail(user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, motivo, origen)
  VALUES (auth.uid(), _org, 'organization_features', v_new.id, CASE WHEN _activo THEN 'ACTIVAR_MODULO' ELSE 'DESACTIVAR_MODULO' END, v_old, to_jsonb(v_new), trim(_motivo), 'usuario');
END $f$;
REVOKE ALL ON FUNCTION public.admin_set_modulo(uuid,text,boolean,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_modulo(uuid,text,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tend_guardar_norma(_id uuid, _valores jsonb, _motivo text)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $f$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Solo super_admin'; END IF;
  IF length(trim(coalesce(_motivo,''))) < 5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
  PERFORM set_config('tracea.motivo', trim(_motivo), true);
  UPDATE public.tend_norma_especificaciones n SET
    texto = CASE WHEN _valores ? 'texto' THEN _valores->>'texto' ELSE n.texto END,
    lie = CASE WHEN _valores ? 'lie' THEN (_valores->>'lie')::numeric ELSE n.lie END,
    lse = CASE WHEN _valores ? 'lse' THEN (_valores->>'lse')::numeric ELSE n.lse END,
    lie_estricto = CASE WHEN _valores ? 'lie_estricto' THEN (_valores->>'lie_estricto')::boolean ELSE n.lie_estricto END,
    nota = CASE WHEN _valores ? 'nota' THEN _valores->>'nota' ELSE n.nota END,
    activo = CASE WHEN _valores ? 'activo' THEN (_valores->>'activo')::boolean ELSE n.activo END
  WHERE n.id = _id;
END $f$;
REVOKE ALL ON FUNCTION public.tend_guardar_norma(uuid,jsonb,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tend_guardar_norma(uuid,jsonb,text) TO authenticated;