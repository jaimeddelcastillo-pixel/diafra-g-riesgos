CREATE OR REPLACE FUNCTION public.documento_tipos_config_revision_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('tracea.catalogo_rpc', true), '') <> '1'
     AND auth.uid() IS NOT NULL
     AND (NEW.revisado_por IS DISTINCT FROM OLD.revisado_por OR NEW.revisado_en IS DISTINCT FROM OLD.revisado_en) THEN
    RAISE EXCEPTION 'La revisión del catálogo solo se confirma con «Confirmar catálogo revisado»';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documento_tipos_config_revision_guard BEFORE UPDATE ON public.documento_tipos_config
  FOR EACH ROW EXECUTE FUNCTION public.documento_tipos_config_revision_guard();

CREATE OR REPLACE FUNCTION public.confirmar_catalogo_documentos()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.get_user_org_id(); v_rol text; v_old record; v_pos int; v_activos jsonb; v_now timestamptz := now();
BEGIN
  SELECT c.rol_en_org INTO v_rol FROM public.contexto_org_actual() c LIMIT 1;
  IF v_org IS NULL OR v_rol IS NULL OR v_rol NOT IN ('admin','responsable_sanitario') THEN
    RAISE EXCEPTION 'Solo el administrador o el Responsable Sanitario confirman el catálogo';
  END IF;
  PERFORM set_config('tracea.catalogo_rpc', '1', true);
  SELECT * INTO v_old FROM public.documento_tipos_config WHERE org_id = v_org;
  INSERT INTO public.documento_tipos_config(org_id, revisado_por, revisado_en)
  VALUES (v_org, auth.uid(), v_now)
  ON CONFLICT (org_id) DO UPDATE SET revisado_por = auth.uid(), revisado_en = v_now, updated_at = v_now
  RETURNING posicion_tipo_en_codigo INTO v_pos;
  PERFORM set_config('tracea.catalogo_rpc', '', true);
  SELECT coalesce(jsonb_agg(clave ORDER BY clave), '[]'::jsonb) INTO v_activos
    FROM public.documento_tipos WHERE org_id = v_org AND activo;
  INSERT INTO public.audit_trail(user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, org_id)
  VALUES (auth.uid(), 'documento_tipos_config', v_org::text, 'CATALOGO_REVISADO',
    CASE WHEN v_old.id IS NULL THEN NULL ELSE jsonb_build_object('revisado_por', v_old.revisado_por, 'revisado_en', v_old.revisado_en) END,
    jsonb_build_object('revisado_por', auth.uid(), 'revisado_en', v_now, 'posicion_tipo_en_codigo', v_pos, 'tipos_activos', v_activos), v_org);
  RETURN v_now;
END $$;