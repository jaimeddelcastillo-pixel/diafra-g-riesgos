CREATE OR REPLACE FUNCTION public.guardar_kpi_resultado(_tabla text,_kpi_id uuid,_periodo_inicio date,_fecha_evento date,_descripcion_evento text,_numerador numeric,_denominador numeric,_referencia text,_comentario text,_motivo text,_resultado_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE org uuid:=public.get_user_org_id(); hoy date:=(now() AT TIME ZONE 'America/Mexico_City')::date; k record; r_id uuid; r_unidad text; r_tend text; r_meta numeric; r_ref text; per record; calc record; rid uuid; es_sgc boolean:=false; p_ini date; p_fin date; ref text; unidad text; BEGIN
IF org IS NULL OR _tabla NOT IN ('kpi_definiciones','kpi_puesto') THEN RAISE EXCEPTION 'KPI no encontrado';END IF;
IF _tabla='kpi_definiciones' THEN
  SELECT d.id,d.activo,d.estado,d.capturistas,d.frecuencia,d.unidad,d.tendencia,d.meta,(d.nivel='SGC') sgc INTO k FROM public.kpi_definiciones d WHERE d.id=_kpi_id AND d.org_id=org;
ELSE
  SELECT p.id,p.activo,p.estado,p.capturistas,p.frecuencia,p.unidad,p.tendencia,p.meta,false sgc INTO k FROM public.kpi_puesto p WHERE p.id=_kpi_id AND p.org_id=org;
END IF;
IF k.id IS NULL THEN RAISE EXCEPTION 'KPI no encontrado';END IF;
IF NOT (k.activo AND k.estado='validado') THEN RAISE EXCEPTION 'Solo se capturan KPI validados y activos';END IF;
IF NOT public.kpi_puede_capturar(org,k.capturistas) THEN RAISE EXCEPTION 'Sin permiso de captura de Indicadores';END IF;
es_sgc:=coalesce(k.sgc,false);
IF _numerador IS NULL THEN RAISE EXCEPTION 'Numerador obligatorio';END IF;
IF _resultado_id IS NOT NULL THEN
  SELECT id,unidad_copia,tendencia_copia,meta_copia,referencia_fuente INTO r_id,r_unidad,r_tend,r_meta,r_ref FROM public.kpi_resultados WHERE id=_resultado_id AND org_id=org AND activo AND coalesce(kpi_definicion_id,kpi_puesto_id)=_kpi_id;
  IF r_id IS NULL THEN RAISE EXCEPTION 'Resultado no encontrado';END IF;
END IF;
unidad:=coalesce(r_unidad,k.unidad);
IF unidad<>'número' AND _denominador IS NULL THEN RAISE EXCEPTION 'Denominador obligatorio: la unidad no es «número»';END IF;
ref:=coalesce(nullif(btrim(coalesce(_referencia,'')),''),r_ref,'');
IF es_sgc AND btrim(ref)='' THEN RAISE EXCEPTION 'Referencia de la fuente obligatoria en KPI de nivel SGC';END IF;
IF k.frecuencia='por evento' THEN
  IF _fecha_evento IS NULL OR coalesce(btrim(_descripcion_evento),'')='' THEN RAISE EXCEPTION 'Fecha y descripción del evento obligatorias';END IF;
  IF _fecha_evento>hoy THEN RAISE EXCEPTION 'El periodo aún no cierra';END IF;
  p_ini:=_fecha_evento;p_fin:=_fecha_evento;
ELSE
  IF _periodo_inicio IS NULL THEN RAISE EXCEPTION 'Periodo obligatorio';END IF;
  SELECT p.inicio,p.fin INTO per FROM public.kpi_periodo(k.frecuencia,_periodo_inicio) p;
  p_ini:=per.inicio;p_fin:=per.fin;
  IF _periodo_inicio IS DISTINCT FROM p_ini THEN RAISE EXCEPTION 'El periodo no corresponde a la frecuencia del KPI';END IF;
  IF p_fin>=hoy THEN RAISE EXCEPTION 'El periodo aún no cierra';END IF;
END IF;
PERFORM set_config('tracea.kpi_resultados_rpc','on',true);
IF _resultado_id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.kpi_resultados r WHERE r.org_id=org AND r.activo AND coalesce(r.kpi_definicion_id,r.kpi_puesto_id)=_kpi_id AND r.periodo_inicio=p_ini) THEN RAISE EXCEPTION 'Ya existe un resultado activo para este KPI y periodo; corrígelo';END IF;
  SELECT c.valor,c.cumplimiento,c.semaforo INTO calc FROM public.kpi_calcular(k.unidad,k.tendencia,k.meta,_numerador,_denominador) c;
  INSERT INTO public.kpi_resultados(org_id,kpi_definicion_id,kpi_puesto_id,periodo_inicio,periodo_fin,fecha_evento,descripcion_evento,numerador,denominador,valor,cumplimiento,semaforo,meta_copia,tendencia_copia,unidad_copia,referencia_fuente,comentario,estado,capturado_por,capturado_en)
  VALUES(org,CASE WHEN _tabla='kpi_definiciones' THEN _kpi_id END,CASE WHEN _tabla='kpi_puesto' THEN _kpi_id END,p_ini,p_fin,_fecha_evento,coalesce(_descripcion_evento,''),_numerador,_denominador,calc.valor,calc.cumplimiento,calc.semaforo,k.meta,k.tendencia,k.unidad,btrim(ref),coalesce(_comentario,''),'capturado',auth.uid(),now()) RETURNING id INTO rid;
ELSE
  IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres';END IF;
  PERFORM set_config('tracea.motivo',btrim(_motivo),true);
  SELECT c.valor,c.cumplimiento,c.semaforo INTO calc FROM public.kpi_calcular(r_unidad,r_tend,r_meta,_numerador,_denominador) c;
  UPDATE public.kpi_resultados SET numerador=_numerador,denominador=_denominador,valor=calc.valor,cumplimiento=calc.cumplimiento,semaforo=calc.semaforo,referencia_fuente=btrim(ref),comentario=coalesce(_comentario,''),estado='capturado',revisado_por=NULL,revisado_en=NULL WHERE id=_resultado_id AND org_id=org RETURNING id INTO rid;
END IF;
RETURN rid;END $$;