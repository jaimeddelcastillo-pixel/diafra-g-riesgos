ALTER TABLE public.kpi_definiciones ADD COLUMN capturistas uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.kpi_puesto ADD COLUMN capturistas uuid[] NOT NULL DEFAULT '{}';
CREATE TABLE public.kpi_resultados(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL DEFAULT public.get_user_org_id() REFERENCES public.organizations(id),kpi_definicion_id uuid,kpi_puesto_id uuid,periodo_inicio date NOT NULL,periodo_fin date,fecha_evento date,descripcion_evento text NOT NULL DEFAULT '',numerador numeric NOT NULL DEFAULT 0,denominador numeric,valor numeric,cumplimiento numeric,semaforo text NOT NULL DEFAULT 'sin base',meta_copia numeric NOT NULL,tendencia_copia text NOT NULL,unidad_copia text NOT NULL,evidencia_path text,comentario text NOT NULL DEFAULT '',estado text NOT NULL DEFAULT 'capturado',capturado_por uuid NOT NULL,capturado_en timestamptz NOT NULL DEFAULT now(),revisado_por uuid,revisado_en timestamptz,activo boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid,updated_by uuid,FOREIGN KEY(org_id,kpi_definicion_id) REFERENCES public.kpi_definiciones(org_id,id),FOREIGN KEY(org_id,kpi_puesto_id) REFERENCES public.kpi_puesto(org_id,id));
GRANT SELECT ON public.kpi_resultados TO authenticated; GRANT ALL ON public.kpi_resultados TO service_role;
ALTER TABLE public.kpi_resultados ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_resultados_lectura ON public.kpi_resultados FOR SELECT TO authenticated USING(public.kpi_acceso(org_id));
CREATE UNIQUE INDEX kpi_resultados_unico ON public.kpi_resultados(org_id,coalesce(kpi_definicion_id,kpi_puesto_id),periodo_inicio) WHERE activo;
CREATE INDEX kpi_resultados_org_periodo ON public.kpi_resultados(org_id,periodo_inicio) WHERE activo;
CREATE OR REPLACE FUNCTION public.kpi_puede_capturar(_org uuid,_capturistas uuid[]) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE c record; BEGIN
IF auth.uid() IS NULL THEN RETURN false;END IF; SELECT * INTO c FROM public.contexto_org_actual();
IF c.org_id IS DISTINCT FROM _org OR NOT public.org_tiene_modulo(_org,'indicadores') THEN RETURN false;END IF;
IF c.es_super_admin THEN RETURN false;END IF;
IF NOT EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id AND p.activo WHERE m.org_id=_org AND m.user_id=auth.uid()) THEN RETURN false;END IF;
RETURN auth.uid()=ANY(coalesce(_capturistas,'{}')) OR public.rol_efectivo(auth.uid(),'admin') OR public.rol_efectivo(auth.uid(),'responsable_sanitario') OR public.rol_efectivo(auth.uid(),'aseguramiento_calidad'); END $$;
REVOKE ALL ON FUNCTION public.kpi_puede_capturar(uuid,uuid[]) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.kpi_puede_capturar(uuid,uuid[]) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.kpi_periodo(_frecuencia text,_fecha date,OUT inicio date,OUT fin date) LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN
IF _frecuencia='mensual' THEN inicio:=date_trunc('month',_fecha)::date; fin:=(date_trunc('month',_fecha)+interval '1 month -1 day')::date;
ELSIF _frecuencia='trimestral' THEN inicio:=date_trunc('quarter',_fecha)::date; fin:=(date_trunc('quarter',_fecha)+interval '3 months -1 day')::date;
ELSIF _frecuencia='semestral' THEN inicio:=make_date(extract(year FROM _fecha)::int,CASE WHEN extract(month FROM _fecha)>=7 THEN 7 ELSE 1 END,1); fin:=(inicio+interval '6 months -1 day')::date;
ELSIF _frecuencia='anual' THEN inicio:=make_date(extract(year FROM _fecha)::int,1,1); fin:=make_date(extract(year FROM _fecha)::int,12,31);
ELSE RAISE EXCEPTION 'Frecuencia sin periodo: %',_frecuencia;END IF; END $$;
CREATE OR REPLACE FUNCTION public.kpi_calcular(_unidad text,_tendencia text,_meta numeric,_num numeric,_den numeric,OUT valor numeric,OUT cumplimiento numeric,OUT semaforo text) LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN
IF _unidad='número' THEN valor:=_num;
ELSIF _den IS NULL OR _den=0 THEN valor:=NULL;cumplimiento:=NULL;semaforo:='sin base';RETURN;
ELSIF _unidad='%' THEN valor:=_num/_den*100;
ELSE valor:=_num/_den;END IF;
IF _meta IS NULL OR _meta<=0 THEN cumplimiento:=NULL;semaforo:='sin base';RETURN;END IF;
IF _tendencia='negativa' THEN cumplimiento:=CASE WHEN valor<=_meta THEN 1 ELSE _meta/valor END;
ELSE cumplimiento:=least(valor/_meta,1);END IF;
semaforo:=CASE WHEN cumplimiento>=0.9 THEN 'verde' WHEN cumplimiento>0.8 THEN 'amarillo' ELSE 'rojo' END; END $$;
CREATE OR REPLACE FUNCTION public.kpi_resultados_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se borran resultados: anular con activo = No';END IF;
IF coalesce(current_setting('tracea.kpi_resultados_rpc',true),'')<>'on' THEN RAISE EXCEPTION 'Escritura solo vía funciones del servidor';END IF;
IF TG_OP='UPDATE' THEN
IF NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.kpi_definicion_id IS DISTINCT FROM OLD.kpi_definicion_id OR NEW.kpi_puesto_id IS DISTINCT FROM OLD.kpi_puesto_id OR NEW.periodo_inicio IS DISTINCT FROM OLD.periodo_inicio OR NEW.meta_copia IS DISTINCT FROM OLD.meta_copia OR NEW.tendencia_copia IS DISTINCT FROM OLD.tendencia_copia OR NEW.unidad_copia IS DISTINCT FROM OLD.unidad_copia OR NEW.capturado_por IS DISTINCT FROM OLD.capturado_por OR NEW.capturado_en IS DISTINCT FROM OLD.capturado_en OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'Identidad, periodo y copia del KPI inmutables';END IF;
IF (NEW.numerador IS DISTINCT FROM OLD.numerador OR NEW.denominador IS DISTINCT FROM OLD.denominador OR NEW.evidencia_path IS DISTINCT FROM OLD.evidencia_path OR NEW.comentario IS DISTINCT FROM OLD.comentario OR NEW.activo IS DISTINCT FROM OLD.activo) AND length(btrim(coalesce(current_setting('tracea.motivo',true),'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres';END IF;
END IF;
IF NEW.estado NOT IN ('capturado','revisado') OR NEW.semaforo NOT IN ('verde','amarillo','rojo','sin base') THEN RAISE EXCEPTION 'Estado o semáforo inválido';END IF;
IF (NEW.kpi_definicion_id IS NULL)=(NEW.kpi_puesto_id IS NULL) THEN RAISE EXCEPTION 'Liga a un solo KPI';END IF;
IF TG_OP='INSERT' THEN NEW.created_at:=now();NEW.created_by:=auth.uid();END IF;
NEW.updated_at:=now();NEW.updated_by:=auth.uid();RETURN NEW;END $$;
CREATE TRIGGER kpi_resultados_guard BEFORE INSERT OR UPDATE OR DELETE ON public.kpi_resultados FOR EACH ROW EXECUTE FUNCTION public.kpi_resultados_guard();
CREATE TRIGGER kpi_resultados_audit AFTER INSERT OR UPDATE ON public.kpi_resultados FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER kpi_resultados_no_truncate BEFORE TRUNCATE ON public.kpi_resultados EXECUTE FUNCTION public.kpi_bloquear_truncate();
CREATE OR REPLACE FUNCTION public.capturar_kpi_resultado(_tabla text,_kpi_id uuid,_periodo_inicio date,_periodo_fin date,_fecha_evento date,_descripcion_evento text,_numerador numeric,_denominador numeric,_evidencia_path text,_comentario text,_motivo text,_resultado_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); k record; r0 record; per record; calc record; rid uuid; es_sgc boolean; p_ini date; p_fin date; BEGIN
IF org IS NULL OR _tabla NOT IN ('kpi_definiciones','kpi_puesto') THEN RAISE EXCEPTION 'KPI no encontrado';END IF;
IF _tabla='kpi_definiciones' THEN SELECT * INTO k FROM public.kpi_definiciones WHERE id=_kpi_id AND org_id=org; ELSE SELECT * INTO k FROM public.kpi_puesto WHERE id=_kpi_id AND org_id=org;END IF;
IF k.id IS NULL THEN RAISE EXCEPTION 'KPI no encontrado';END IF;
IF NOT (k.activo AND k.estado='validado') THEN RAISE EXCEPTION 'Solo se capturan KPI validados y activos';END IF;
IF NOT public.kpi_puede_capturar(org,k.capturistas) THEN RAISE EXCEPTION 'Sin permiso de captura de Indicadores';END IF;
es_sgc:=(_tabla='kpi_definiciones' AND k.nivel='SGC');
IF es_sgc AND coalesce(btrim(_evidencia_path),'')='' THEN RAISE EXCEPTION 'Evidencia obligatoria en KPI de nivel SGC';END IF;
IF k.frecuencia='por evento' THEN
IF _fecha_evento IS NULL OR coalesce(btrim(_descripcion_evento),'')='' THEN RAISE EXCEPTION 'Fecha y descripción del evento obligatorias';END IF;
p_ini:=_fecha_evento;p_fin:=_fecha_evento;
ELSE
SELECT p.inicio,p.fin INTO per FROM public.kpi_periodo(k.frecuencia,coalesce(_periodo_inicio,(now() AT TIME ZONE 'America/Mexico_City')::date)) p;
p_ini:=per.inicio;p_fin:=per.fin;
IF _periodo_inicio IS DISTINCT FROM p_ini OR (_periodo_fin IS NOT NULL AND _periodo_fin IS DISTINCT FROM p_fin) THEN RAISE EXCEPTION 'El periodo no corresponde a la frecuencia del KPI';END IF;
END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);
IF _resultado_id IS NULL THEN
IF EXISTS(SELECT 1 FROM public.kpi_resultados r WHERE r.org_id=org AND r.activo AND coalesce(r.kpi_definicion_id,r.kpi_puesto_id)=_kpi_id AND r.periodo_inicio=p_ini) THEN RAISE EXCEPTION 'Ya existe un resultado activo para este KPI y periodo; corrígelo';END IF;
SELECT c.valor,c.cumplimiento,c.semaforo INTO calc FROM public.kpi_calcular(k.unidad,k.tendencia,k.meta,_numerador,_denominador) c;
INSERT INTO public.kpi_resultados(org_id,kpi_definicion_id,kpi_puesto_id,periodo_inicio,periodo_fin,fecha_evento,descripcion_evento,numerador,denominador,valor,cumplimiento,semaforo,meta_copia,tendencia_copia,unidad_copia,evidencia_path,comentario,estado,capturado_por,capturado_en)
VALUES(org,CASE WHEN _tabla='kpi_definiciones' THEN _kpi_id END,CASE WHEN _tabla='kpi_puesto' THEN _kpi_id END,p_ini,p_fin,_fecha_evento,coalesce(_descripcion_evento,''),_numerador,_denominador,calc.valor,calc.cumplimiento,calc.semaforo,k.meta,k.tendencia,k.unidad,nullif(btrim(coalesce(_evidencia_path,'')),''),coalesce(_comentario,''),'capturado',auth.uid(),now()) RETURNING id INTO rid;
ELSE
SELECT * INTO r0 FROM public.kpi_resultados WHERE id=_resultado_id AND org_id=org AND activo;
IF r0.id IS NULL THEN RAISE EXCEPTION 'Resultado no encontrado';END IF;
IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres';END IF;
PERFORM set_config('tracea.motivo',btrim(_motivo),true);
SELECT c.valor,c.cumplimiento,c.semaforo INTO calc FROM public.kpi_calcular(r0.unidad_copia,r0.tendencia_copia,r0.meta_copia,_numerador,_denominador) c;
UPDATE public.kpi_resultados SET numerador=_numerador,denominador=_denominador,valor=calc.valor,cumplimiento=calc.cumplimiento,semaforo=calc.semaforo,evidencia_path=nullif(btrim(coalesce(_evidencia_path,'')),''),comentario=coalesce(_comentario,''),estado='capturado',revisado_por=NULL,revisado_en=NULL WHERE id=_resultado_id RETURNING id INTO rid;
END IF;
RETURN rid;END $$;
REVOKE ALL ON FUNCTION public.capturar_kpi_resultado(text,uuid,date,date,date,text,numeric,numeric,text,text,text,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.capturar_kpi_resultado(text,uuid,date,date,date,text,numeric,numeric,text,text,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.revisar_kpi_resultado(_id uuid,_motivo text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); n integer;BEGIN
IF NOT (public.rol_efectivo(auth.uid(),'responsable_sanitario') OR public.rol_efectivo(auth.uid(),'aseguramiento_calidad')) OR NOT public.org_tiene_modulo(org,'indicadores') THEN RAISE EXCEPTION 'Solo RS o AC revisan resultados';END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);PERFORM set_config('tracea.motivo',nullif(btrim(coalesce(_motivo,'')),'') ,true);
UPDATE public.kpi_resultados SET estado='revisado',revisado_por=auth.uid(),revisado_en=now() WHERE id=_id AND org_id=org AND activo AND estado='capturado';
GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'Resultado capturado no encontrado';END IF;END $$;
REVOKE ALL ON FUNCTION public.revisar_kpi_resultado(uuid,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.revisar_kpi_resultado(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.anular_kpi_resultado(_id uuid,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); n integer;BEGIN
IF NOT public.kpi_acceso(org,true) THEN RAISE EXCEPTION 'Sin permiso de edición de Indicadores';END IF;
IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres';END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);PERFORM set_config('tracea.motivo',btrim(_motivo),true);
UPDATE public.kpi_resultados SET activo=false WHERE id=_id AND org_id=org AND activo;
GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'Resultado no encontrado';END IF;END $$;
REVOKE ALL ON FUNCTION public.anular_kpi_resultado(uuid,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.anular_kpi_resultado(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.asignar_capturistas(_tabla text,_codigo text,_capturistas uuid[],_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); n integer;BEGIN
IF _tabla NOT IN ('kpi_definiciones','kpi_puesto') OR NOT public.kpi_acceso(org,true) THEN RAISE EXCEPTION 'Sin permiso de edición de Indicadores';END IF;
IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres';END IF;
PERFORM set_config('tracea.motivo',btrim(_motivo),true);
EXECUTE format('UPDATE public.%I SET capturistas=$1 WHERE org_id=$2 AND codigo=$3',_tabla) USING coalesce(_capturistas,'{}'),org,_codigo;
GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'KPI no encontrado';END IF;END $$;
REVOKE ALL ON FUNCTION public.asignar_capturistas(text,text,uuid[],text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.asignar_capturistas(text,text,uuid[],text) TO authenticated;
CREATE POLICY kpi_evidencias_lectura ON storage.objects FOR SELECT TO authenticated USING(bucket_id='kpi-evidencias' AND (public.is_super_admin() OR public.kpi_acceso(CASE WHEN split_part(name,'/',1)~'^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid END)));
CREATE POLICY kpi_evidencias_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='kpi-evidencias' AND (public.kpi_acceso(CASE WHEN split_part(name,'/',1)~'^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid END,true) OR EXISTS(SELECT 1 FROM public.kpi_definiciones d WHERE d.org_id=CASE WHEN split_part(name,'/',1)~'^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid END AND auth.uid()=ANY(d.capturistas)) OR EXISTS(SELECT 1 FROM public.kpi_puesto p WHERE p.org_id=CASE WHEN split_part(name,'/',1)~'^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid END AND auth.uid()=ANY(p.capturistas))));
CREATE POLICY kpi_evidencias_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='kpi-evidencias' AND public.kpi_acceso(CASE WHEN split_part(name,'/',1)~'^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid END,true));
CREATE POLICY kpi_evidencias_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='kpi-evidencias' AND (public.is_super_admin() OR public.kpi_acceso(CASE WHEN split_part(name,'/',1)~'^[0-9a-fA-F-]{36}$' THEN split_part(name,'/',1)::uuid END,true)));
DO $k2$ DECLARE d text;BEGIN
SELECT pg_get_functiondef('public.pendientes_usuario(text)'::regprocedure) INTO d;
d:=replace(d,E' )\n SELECT b.modulo',E' UNION ALL\n SELECT ''indicadores'',''kpi_por_capturar'',k.registro,k.n||'' KPI por capturar del periodo ''||k.etiqueta,''/indicadores?hoja=Captura'',k.nace_en,NULL::date,''gestion''\n FROM (SELECT per.inicio,per.fin,to_char(per.inicio,''DD-MM-YYYY'')||'' al ''||to_char(per.fin,''DD-MM-YYYY'') etiqueta,(array_agg(k.id ORDER BY k.codigo))[1] registro,count(*) n,((per.fin+6)::timestamp AT TIME ZONE ''America/Mexico_City'') nace_en\n FROM (SELECT ''mensual''::text frecuencia,date_trunc(''month'',hoy-interval ''1 month'')::date inicio,date_trunc(''month'',hoy)::date-1 fin\n UNION ALL SELECT ''trimestral'',(date_trunc(''quarter'',hoy)-interval ''3 months'')::date,date_trunc(''quarter'',hoy)::date-1\n UNION ALL SELECT ''semestral'',(make_date(extract(year FROM hoy)::int,CASE WHEN extract(month FROM hoy)>=7 THEN 7 ELSE 1 END,1)-interval ''6 months'')::date,make_date(extract(year FROM hoy)::int,CASE WHEN extract(month FROM hoy)>=7 THEN 7 ELSE 1 END,1)-1\n UNION ALL SELECT ''anual'',make_date(extract(year FROM hoy)::int-1,1,1),make_date(extract(year FROM hoy)::int-1,12,31)) per\n JOIN (SELECT id,org_id,codigo,frecuencia,capturistas FROM public.kpi_definiciones WHERE activo AND estado=''validado'' AND frecuencia<>''por evento'' UNION ALL SELECT id,org_id,codigo,frecuencia,capturistas FROM public.kpi_puesto WHERE activo AND estado=''validado'' AND frecuencia<>''por evento'') k ON k.org_id=org AND k.frecuencia=per.frecuencia\n WHERE per.fin+5<=hoy AND (emp OR u=ANY(k.capturistas)) AND NOT EXISTS(SELECT 1 FROM public.kpi_resultados r WHERE r.org_id=org AND r.activo AND coalesce(r.kpi_definicion_id,r.kpi_puesto_id)=k.id AND r.periodo_inicio=per.inicio)\n GROUP BY per.inicio,per.fin) k\n WHERE public.org_tiene_modulo(org,''indicadores'')\n UNION ALL\n SELECT ''indicadores'',''kpi_por_revisar'',r.registro,r.n||'' resultados por revisar'',''/indicadores?hoja=Captura'',r.nace_en,NULL::date,''gestion''\n FROM (SELECT (array_agg(id ORDER BY capturado_en,id))[1] registro,count(*) n,min(capturado_en) nace_en FROM public.kpi_resultados WHERE org_id=org AND activo AND estado=''capturado'' HAVING count(*)>0) r\n WHERE public.org_tiene_modulo(org,''indicadores'') AND (emp OR es_rs OR public.rol_efectivo(u,''aseguramiento_calidad''))\n )\n SELECT b.modulo');
IF position('kpi_por_capturar' in d)=0 THEN RAISE EXCEPTION 'No se pudo extender pendientes';END IF;EXECUTE d;END $k2$;