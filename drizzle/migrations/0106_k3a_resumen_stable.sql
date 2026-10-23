CREATE OR REPLACE FUNCTION public.kpi_resumen_periodo(_tipo text, _inicio date, _filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _org uuid := public.get_user_org_id(); _f text; p record; pa record; _out jsonb;
  _proceso text := nullif(_filtros->>'proceso',''); _nivel text := nullif(_filtros->>'nivel',''); _puesto uuid := nullif(_filtros->>'puesto_id','')::uuid;
BEGIN
  IF _org IS NULL OR NOT public.kpi_acceso(_org) THEN RAISE EXCEPTION 'Sin acceso a Indicadores'; END IF;
  _f := CASE lower(_tipo) WHEN 'trimestre' THEN 'trimestral' WHEN 'semestre' THEN 'semestral' WHEN 'año' THEN 'anual' WHEN 'anio' THEN 'anual' ELSE NULL END;
  IF _f IS NULL OR _inicio IS NULL THEN RAISE EXCEPTION 'Tipo de periodo inválido: %', _tipo; END IF;
  SELECT * INTO p FROM public.kpi_periodo(_f,_inicio);
  SELECT * INTO pa FROM public.kpi_periodo(_f,p.inicio-1);
  WITH cur AS (SELECT * FROM public.kpi_acumulado_interno(_org,p.inicio,p.fin) x
      WHERE (_proceso IS NULL OR x.proceso=_proceso) AND (_nivel IS NULL OR x.nivel=_nivel) AND (_puesto IS NULL OR x.puesto_id=_puesto)),
    ant AS (SELECT * FROM public.kpi_acumulado_interno(_org,pa.inicio,pa.fin)),
    j AS (SELECT c.*, a.valor valor_ant, a.cumplimiento cumpl_ant FROM cur c LEFT JOIN ant a ON a.kid=c.kid)
  SELECT jsonb_build_object('tipo',lower(_tipo),'inicio',p.inicio,'fin',p.fin,'anterior',jsonb_build_object('inicio',pa.inicio,'fin',pa.fin),
   'kpis',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.kid,'tabla',c.tabla,'tipo',CASE c.tabla WHEN 'kpi_definiciones' THEN 'SGC' ELSE 'Puesto' END,
      'codigo',c.codigo,'nombre',c.nombre,'proceso',c.proceso,'nivel',c.nivel,'puesto_id',c.puesto_id,'frecuencia',c.frecuencia,'unidad',c.unidad,'tendencia',c.tendencia,
      'peso',c.peso,'meta',c.meta,'meta_cambio',cardinality(c.metas)>1,'metas',to_jsonb(c.metas),'subperiodos',c.subperiodos,'resultados',c.n_res,
      'valor',c.valor,'cumplimiento',c.cumplimiento,'semaforo',c.semaforo,'valor_anterior',c.valor_ant,
      'tendencia_periodo',CASE WHEN c.valor IS NULL OR c.valor_ant IS NULL THEN NULL WHEN c.valor>c.valor_ant THEN 'sube' WHEN c.valor<c.valor_ant THEN 'baja' ELSE 'igual' END)
      ORDER BY c.tabla, c.proceso NULLS LAST, c.codigo),'[]'::jsonb) FROM j c),
   'puestos',(SELECT coalesce(jsonb_agg(jsonb_build_object('puesto_id',s.puesto_id,'codigo',pu.codigo,'nombre',pu.nombre,'calificacion',s.cal,'semaforo',public.kpi_semaforo_cumplimiento(s.cal),'con_dato',s.cd,'total',s.tot,'calificacion_anterior',s.cal_ant) ORDER BY pu.codigo),'[]'::jsonb)
      FROM (SELECT c.puesto_id,
        sum(c.cumplimiento*c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL)/nullif(sum(c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL),0) cal,
        count(*) FILTER (WHERE c.cumplimiento IS NOT NULL)::int cd, count(*)::int tot,
        sum(c.cumpl_ant*c.peso) FILTER (WHERE c.cumpl_ant IS NOT NULL)/nullif(sum(c.peso) FILTER (WHERE c.cumpl_ant IS NOT NULL),0) cal_ant
        FROM j c WHERE c.tabla='kpi_puesto' GROUP BY c.puesto_id) s JOIN puestos pu ON pu.id=s.puesto_id),
   'indice_sgc',(SELECT jsonb_build_object('indice',x.ind,'semaforo',public.kpi_semaforo_cumplimiento(x.ind),'indice_anterior',x.ind_ant,
      'semaforo_anterior',CASE WHEN x.ind_ant IS NULL THEN NULL ELSE public.kpi_semaforo_cumplimiento(x.ind_ant) END,
      'con_dato',x.cd,'total',x.tot,'verde',x.v,'amarillo',x.am,'rojo',x.ro,'sin_base',x.sb,'sin_captura',x.sc)
      FROM (SELECT sum(c.cumplimiento*c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL)/nullif(sum(c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL),0) ind,
        sum(c.cumpl_ant*c.peso) FILTER (WHERE c.cumpl_ant IS NOT NULL)/nullif(sum(c.peso) FILTER (WHERE c.cumpl_ant IS NOT NULL),0) ind_ant,
        count(*) FILTER (WHERE c.cumplimiento IS NOT NULL)::int cd, count(*)::int tot,
        count(*) FILTER (WHERE c.semaforo='verde')::int v, count(*) FILTER (WHERE c.semaforo='amarillo')::int am, count(*) FILTER (WHERE c.semaforo='rojo')::int ro,
        count(*) FILTER (WHERE c.semaforo='sin base')::int sb, count(*) FILTER (WHERE c.semaforo='sin captura')::int sc
        FROM j c WHERE c.tabla='kpi_definiciones' AND c.nivel='SGC') x),
   'procesos',(SELECT coalesce(jsonb_agg(jsonb_build_object('proceso',s.proceso,'indice',s.ind,'semaforo',public.kpi_semaforo_cumplimiento(s.ind),'con_dato',s.cd,'total',s.tot) ORDER BY s.proceso),'[]'::jsonb)
      FROM (SELECT coalesce(c.proceso,'Sin proceso') proceso,
        sum(c.cumplimiento*c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL AND c.nivel='SGC')/nullif(sum(c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL AND c.nivel='SGC'),0) ind,
        count(*) FILTER (WHERE c.cumplimiento IS NOT NULL)::int cd, count(*)::int tot
        FROM j c WHERE c.tabla='kpi_definiciones' GROUP BY 1) s))
  INTO _out;
  RETURN _out;
END $$;