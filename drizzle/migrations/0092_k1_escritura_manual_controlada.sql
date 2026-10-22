DO $k1$ DECLARE d text;BEGIN SELECT pg_get_functiondef('public.aplicar_kpis_excel(jsonb,text,boolean)'::regprocedure) INTO d;d:=replace(d,'FUNCTION public.aplicar_kpis_excel(', 'FUNCTION public.kpi_aplicar_interno(');EXECUTE d;END $k1$;
REVOKE ALL ON FUNCTION public.kpi_aplicar_interno(jsonb,text,boolean) FROM PUBLIC,authenticated,anon;
CREATE OR REPLACE FUNCTION public.aplicar_kpis_excel(_paquete jsonb,_motivo text,_borrador boolean DEFAULT true) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.kpi_aplicar_interno(_paquete,_motivo,true);END $$;
CREATE OR REPLACE FUNCTION public.guardar_kpis(_paquete jsonb,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.kpi_aplicar_interno(_paquete,_motivo,false);END $$;
REVOKE ALL ON FUNCTION public.guardar_kpis(jsonb,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.guardar_kpis(jsonb,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.validar_kpi(_tabla text,_id uuid,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); n integer;BEGIN
IF _tabla NOT IN ('kpi_definiciones','kpi_puesto') OR NOT public.kpi_acceso(org,true,true) THEN RAISE EXCEPTION 'Solo RS o AC validan';END IF;
IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres';END IF;
PERFORM set_config('tracea.motivo',btrim(_motivo),true);
EXECUTE format('UPDATE public.%I SET estado=''validado'' WHERE id=$1 AND org_id=$2 AND activo AND estado=''borrador''',_tabla) USING _id,org;
GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'KPI activo en borrador no encontrado';END IF; END $$;