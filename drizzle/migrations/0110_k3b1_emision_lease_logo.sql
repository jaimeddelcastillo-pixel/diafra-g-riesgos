CREATE OR REPLACE FUNCTION public.reclamar_emision_kpi_word(_id uuid,_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r kpi_reportes; BEGIN
 SELECT * INTO r FROM kpi_reportes WHERE id=_id FOR UPDATE;
 IF r.estado<>'borrador' OR r.emision_preparada->>'token' IS DISTINCT FROM _token::text THEN RETURN false; END IF;
 IF coalesce((r.emision_preparada->>'lease_hasta')::timestamptz,'-infinity')>now() THEN RETURN false; END IF;
 PERFORM set_config('tracea.kpi_reportes_rpc','1',true);
 UPDATE kpi_reportes SET emision_preparada=emision_preparada||jsonb_build_object('lease_hasta',now()+interval '2 minutes') WHERE id=_id;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.congelar_logo_kpi_word(_id uuid,_token uuid,_logo jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r kpi_reportes; BEGIN
 SELECT * INTO r FROM kpi_reportes WHERE id=_id FOR UPDATE;
 IF r.estado<>'borrador' OR r.emision_preparada->>'token' IS DISTINCT FROM _token::text THEN RAISE EXCEPTION 'Reserva inválida'; END IF;
 IF r.emision_preparada ? 'logo' THEN
  IF r.emision_preparada->'logo' IS DISTINCT FROM coalesce(_logo,'null'::jsonb) THEN RAISE EXCEPTION 'Logo ya congelado'; END IF; RETURN;
 END IF;
 PERFORM set_config('tracea.kpi_reportes_rpc','1',true);
 UPDATE kpi_reportes SET emision_preparada=emision_preparada||jsonb_build_object('logo',_logo) WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.reclamar_emision_kpi_word(uuid,uuid),public.congelar_logo_kpi_word(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_emision_kpi_word(uuid,uuid),public.congelar_logo_kpi_word(uuid,uuid,jsonb) TO service_role;
-- Frozen reservations cannot be mutated by normal report RPCs, including return-to-edit or cancellation.
CREATE OR REPLACE FUNCTION public.kpi_reportes_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Nunca se borra: usa anular'; END IF;
 IF TG_TABLE_NAME IN ('kpi_reportes_historial','kpi_reporte_config') THEN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Registro inmutable'; END IF;
  IF coalesce(current_setting('tracea.kpi_reportes_rpc',true),'')<>'1' THEN RAISE EXCEPTION 'Solo mediante las funciones de reportes'; END IF; RETURN NEW;
 END IF;
 IF coalesce(current_setting('tracea.kpi_reportes_rpc',true),'')<>'1' THEN RAISE EXCEPTION 'Solo mediante las funciones de reportes'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.estado='anulado' THEN RAISE EXCEPTION 'Un reporte anulado no cambia'; END IF;
  IF OLD.estado='emitido' AND coalesce(current_setting('tracea.kpi_reportes_transicion',true),'')<>'1' THEN RAISE EXCEPTION 'Un reporte emitido no se edita'; END IF;
  IF OLD.emision_preparada IS NOT NULL AND coalesce(current_setting('tracea.kpi_reportes_transicion',true),'')<>'1' AND (to_jsonb(NEW)-'emision_preparada'-'updated_at'-'updated_by') IS DISTINCT FROM (to_jsonb(OLD)-'emision_preparada'-'updated_at'-'updated_by') THEN RAISE EXCEPTION 'La emisión está en curso'; END IF;
 END IF;
 NEW.updated_at:=now(); NEW.updated_by:=auth.uid(); RETURN NEW;
END $$;