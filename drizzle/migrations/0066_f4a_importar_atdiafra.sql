CREATE OR REPLACE FUNCTION public.tend_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r text[]; sistema boolean; migracion boolean; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Tendencias: retirar o anular, nunca borrar'; END IF;
 migracion := coalesce(current_setting('tracea.migracion',true),'')='1'
   AND coalesce(current_setting('tracea.motivo',true),'')<>'' AND coalesce(current_setting('tracea.autorizado_por',true),'')<>'';
 sistema := NOT migracion AND auth.uid() IS NULL AND coalesce(current_setting('tracea.origen',true),'')='sistema'
   AND coalesce(current_setting('tracea.motivo',true),'')<>'' AND coalesce(current_setting('tracea.autorizado_por',true),'')<>'';
 r:=CASE WHEN TG_TABLE_NAME IN ('tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_formato','tend_config') THEN ARRAY['admin','responsable_sanitario'] ELSE ARRAY['operador','comite_tecnico','admin','responsable_sanitario'] END;
 IF NOT sistema AND NOT migracion AND NOT public.tend_acceso(NEW.org_id,true,r) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Identidad y autor originales inmutables'; END IF;
 IF TG_OP='INSERT' AND NOT migracion THEN NEW.created_by:=auth.uid(); NEW.created_at:=now(); END IF;
 IF NOT migracion THEN NEW.updated_by:=auth.uid(); NEW.updated_at:=now(); END IF;
 IF TG_TABLE_NAME='tend_semanas' AND coalesce(to_jsonb(NEW)->>'foto_path','')<>'' AND (split_part(to_jsonb(NEW)->>'foto_path','/',1)<>NEW.org_id::text OR (to_jsonb(NEW)->>'foto_path') ~ '(^|/)\.\.(/|$)') THEN RAISE EXCEPTION 'Foto fuera de empresa'; END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tend_importar_atdiafra(_org uuid, _paquete jsonb, _conteos jsonb, _motivo text, _autorizado_por text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  tablas CONSTANT text[] := ARRAY['tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_cambios_filtro','tend_registros','tend_semanas','tend_registros_at','tend_registros_at_historial','tend_extracciones','tend_formato'];
  t text; filas jsonb; n int; esperado int; resultado jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Solo super_admin puede importar respaldos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id=_org) THEN RAISE EXCEPTION 'Empresa destino inexistente'; END IF;
  IF coalesce(btrim(_motivo),'')='' OR coalesce(btrim(_autorizado_por),'')='' THEN RAISE EXCEPTION 'La migración requiere motivo y quién la autorizó'; END IF;
  PERFORM set_config('tracea.origen','sistema',true), set_config('tracea.migracion','1',true),
          set_config('tracea.motivo',btrim(_motivo),true), set_config('tracea.autorizado_por',btrim(_autorizado_por),true);
  FOREACH t IN ARRAY tablas LOOP
    filas := coalesce(_paquete->t,'[]'::jsonb);
    esperado := coalesce((_conteos->>t)::int, 0);
    IF jsonb_array_length(filas) <> esperado THEN
      RAISE EXCEPTION 'Conteo no cuadra en %: esperado %, en paquete %', t, esperado, jsonb_array_length(filas);
    END IF;
    IF esperado > 0 THEN
      filas := (SELECT jsonb_agg(f || jsonb_build_object('org_id', _org::text, 'migrado_desde','atdiafra')) FROM jsonb_array_elements(filas) f);
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(null::public.%I, $1)', t, t) USING filas;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> esperado THEN RAISE EXCEPTION 'Conteo no cuadra en %: esperado %, insertado %', t, esperado, n; END IF;
    END IF;
    resultado := resultado || jsonb_build_object(t, esperado);
  END LOOP;
  PERFORM set_config('tracea.migracion','',true);
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.tend_importar_atdiafra(uuid,jsonb,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_importar_atdiafra(uuid,jsonb,jsonb,text,text) TO authenticated;
COMMENT ON FUNCTION public.tend_importar_atdiafra(uuid,jsonb,jsonb,text,text) IS 'F4a: importa respaldo atdiafra en una sola transacción; solo super_admin; si un conteo no cuadra se revierte todo.';

DROP POLICY IF EXISTS "Public read org logos" ON storage.objects;