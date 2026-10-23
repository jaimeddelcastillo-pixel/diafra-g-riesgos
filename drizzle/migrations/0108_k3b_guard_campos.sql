-- Fix: the shared guard read OLD.estado on tables without that column (kpi_reporte_config / kpi_reportes_historial). Full rewrite with per-table branches.
CREATE OR REPLACE FUNCTION public.kpi_reportes_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Nunca se borra: usa anular'; END IF;
  IF TG_TABLE_NAME IN ('kpi_reportes_historial','kpi_reporte_config') THEN
    IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Registro inmutable'; END IF;
    IF coalesce(current_setting('tracea.kpi_reportes_rpc', true),'')<>'1' THEN RAISE EXCEPTION 'Solo mediante las funciones de reportes'; END IF;
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('tracea.kpi_reportes_rpc', true),'')<>'1' THEN RAISE EXCEPTION 'Solo mediante las funciones de reportes'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.estado='anulado' THEN RAISE EXCEPTION 'Un reporte anulado no cambia'; END IF;
    IF OLD.estado='emitido' AND coalesce(current_setting('tracea.kpi_reportes_transicion', true),'')<>'1' THEN RAISE EXCEPTION 'Un reporte emitido no se edita'; END IF;
  END IF;
  NEW.updated_at:=now(); NEW.updated_by:=auth.uid();
  RETURN NEW;
END $$;