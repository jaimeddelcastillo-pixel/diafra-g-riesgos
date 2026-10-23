CREATE OR REPLACE FUNCTION public.kpi_semaforo_cumplimiento(_c numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$
SELECT CASE WHEN _c IS NULL THEN 'sin base' WHEN _c>=0.9 THEN 'verde' WHEN _c>0.8 THEN 'amarillo' ELSE 'rojo' END $$;

-- Internal (no client grant): accumulated result per validated active KPI in [_ini,_fin]. Σnum/Σden via kpi_calcular, last copied meta; «sin base» excluded.
CREATE OR REPLACE FUNCTION public.kpi_acumulado_interno(_org uuid, _ini date, _fin date)
RETURNS TABLE(kid uuid, tabla text, codigo text, nombre text, proceso text, nivel text, puesto_id uuid, frecuencia text, unidad text, tendencia text, peso numeric, meta numeric, subperiodos jsonb, metas numeric[], n_res int, valor numeric, cumplimiento numeric, semaforo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH k AS (
  SELECT d.id, 'kpi_definiciones'::text tabla, d.codigo, d.nombre, d.proceso, d.nivel, d.puesto_id, d.frecuencia, d.unidad, d.tendencia, coalesce(d.peso,0) peso, d.meta
  FROM kpi_definiciones d WHERE d.org_id=_org AND d.activo AND d.estado='validado'
  UNION ALL
  SELECT p.id, 'kpi_puesto', p.codigo, p.nombre, NULL, NULL, p.puesto_id, p.frecuencia, p.unidad, p.tendencia, coalesce(p.peso,0), p.meta
  FROM kpi_puesto p WHERE p.org_id=_org AND p.activo AND p.estado='validado'
), r AS (
  SELECT coalesce(x.kpi_definicion_id,x.kpi_puesto_id) kid, x.* FROM kpi_resultados x
  WHERE x.org_id=_org AND x.activo AND x.estado<>'anulado' AND x.periodo_inicio>=_ini AND coalesce(x.periodo_fin,x.periodo_inicio)<=_fin
), a AS (
  SELECT r.kid,
    jsonb_agg(jsonb_build_object('inicio',r.periodo_inicio,'fin',r.periodo_fin,'numerador',r.numerador,'denominador',r.denominador,'valor',r.valor,'cumplimiento',r.cumplimiento,'semaforo',r.semaforo,'meta',r.meta_copia) ORDER BY r.periodo_inicio) sub,
    array_agg(DISTINCT r.meta_copia) metas, count(*)::int n,
    sum(r.numerador) FILTER (WHERE r.semaforo<>'sin base') sn, sum(r.denominador) FILTER (WHERE r.semaforo<>'sin base') sd,
    count(*) FILTER (WHERE r.semaforo<>'sin base') nv,
    (array_agg(r.meta_copia ORDER BY r.periodo_inicio DESC))[1] um,
    (array_agg(r.tendencia_copia ORDER BY r.periodo_inicio DESC))[1] ut,
    (array_agg(r.unidad_copia ORDER BY r.periodo_inicio DESC))[1] uu
  FROM r GROUP BY r.kid
)
SELECT k.id, k.tabla, k.codigo, k.nombre, k.proceso, k.nivel, k.puesto_id, k.frecuencia, k.unidad, k.tendencia, k.peso,
  coalesce(a.um,k.meta), coalesce(a.sub,'[]'::jsonb), coalesce(a.metas,ARRAY[]::numeric[]), coalesce(a.n,0),
  c.valor, c.cumplimiento,
  CASE WHEN a.kid IS NULL THEN 'sin captura' WHEN coalesce(a.nv,0)=0 THEN 'sin base' ELSE c.semaforo END
FROM k LEFT JOIN a ON a.kid=k.id
LEFT JOIN LATERAL (SELECT * FROM kpi_calcular(a.uu,a.ut,a.um,a.sn,a.sd) WHERE coalesce(a.nv,0)>0) c ON true $$;
REVOKE ALL ON FUNCTION public.kpi_acumulado_interno(uuid,date,date) FROM PUBLIC, anon, authenticated;

-- K3-a: period summary. Access checked once (kpi_acceso, active company); no per-row role checks.
CREATE OR REPLACE FUNCTION public.kpi_resumen_periodo(_tipo text, _inicio date, _filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _org uuid := public.get_user_org_id(); _f text; p record; pa record; _kpis jsonb; _puestos jsonb; _sgc jsonb; _proc jsonb;
  _proceso text := nullif(_filtros->>'proceso',''); _nivel text := nullif(_filtros->>'nivel',''); _puesto uuid := nullif(_filtros->>'puesto_id','')::uuid;
BEGIN
  IF _org IS NULL OR NOT public.kpi_acceso(_org) THEN RAISE EXCEPTION 'Sin acceso a Indicadores'; END IF;
  _f := CASE lower(_tipo) WHEN 'trimestre' THEN 'trimestral' WHEN 'semestre' THEN 'semestral' WHEN 'año' THEN 'anual' WHEN 'anio' THEN 'anual' ELSE NULL END;
  IF _f IS NULL OR _inicio IS NULL THEN RAISE EXCEPTION 'Tipo de periodo inválido: %', _tipo; END IF;
  SELECT * INTO p FROM public.kpi_periodo(_f,_inicio);
  SELECT * INTO pa FROM public.kpi_periodo(_f,p.inicio-1);
  CREATE TEMP TABLE IF NOT EXISTS _k3a_cur ON COMMIT DROP AS SELECT * FROM public.kpi_acumulado_interno(_org,p.inicio,p.fin) WITH NO DATA;
  CREATE TEMP TABLE IF NOT EXISTS _k3a_ant ON COMMIT DROP AS SELECT * FROM public.kpi_acumulado_interno(_org,p.inicio,p.fin) WITH NO DATA;
  TRUNCATE _k3a_cur; TRUNCATE _k3a_ant;
  INSERT INTO _k3a_cur SELECT * FROM public.kpi_acumulado_interno(_org,p.inicio,p.fin) x
    WHERE (_proceso IS NULL OR x.proceso=_proceso) AND (_nivel IS NULL OR x.nivel=_nivel) AND (_puesto IS NULL OR x.puesto_id=_puesto);
  INSERT INTO _k3a_ant SELECT * FROM public.kpi_acumulado_interno(_org,pa.inicio,pa.fin) x WHERE x.kid IN (SELECT kid FROM _k3a_cur);

  SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.kid,'tabla',c.tabla,'tipo',CASE c.tabla WHEN 'kpi_definiciones' THEN 'SGC' ELSE 'Puesto' END,
    'codigo',c.codigo,'nombre',c.nombre,'proceso',c.proceso,'nivel',c.nivel,'puesto_id',c.puesto_id,'frecuencia',c.frecuencia,'unidad',c.unidad,'tendencia',c.tendencia,
    'peso',c.peso,'meta',c.meta,'meta_cambio',cardinality(c.metas)>1,'metas',to_jsonb(c.metas),'subperiodos',c.subperiodos,'resultados',c.n_res,
    'valor',c.valor,'cumplimiento',c.cumplimiento,'semaforo',c.semaforo,'valor_anterior',a.valor,
    'tendencia_periodo',CASE WHEN c.valor IS NULL OR a.valor IS NULL THEN NULL WHEN c.valor>a.valor THEN 'sube' WHEN c.valor<a.valor THEN 'baja' ELSE 'igual' END)
    ORDER BY c.tabla, c.proceso NULLS LAST, c.codigo),'[]'::jsonb)
  INTO _kpis FROM _k3a_cur c LEFT JOIN _k3a_ant a ON a.kid=c.kid;

  SELECT coalesce(jsonb_agg(jsonb_build_object('puesto_id',s.puesto_id,'codigo',pu.codigo,'nombre',pu.nombre,'calificacion',s.cal,'semaforo',public.kpi_semaforo_cumplimiento(s.cal),'con_dato',s.cd,'total',s.tot,'calificacion_anterior',s.cal_ant) ORDER BY pu.codigo),'[]'::jsonb)
  INTO _puestos FROM (
    SELECT c.puesto_id,
      sum(c.cumplimiento*c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL) / nullif(sum(c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL),0) cal,
      count(*) FILTER (WHERE c.cumplimiento IS NOT NULL)::int cd, count(*)::int tot,
      sum(a.cumplimiento*a.peso) FILTER (WHERE a.cumplimiento IS NOT NULL) / nullif(sum(a.peso) FILTER (WHERE a.cumplimiento IS NOT NULL),0) cal_ant
    FROM _k3a_cur c LEFT JOIN _k3a_ant a ON a.kid=c.kid WHERE c.tabla='kpi_puesto' GROUP BY c.puesto_id) s
  JOIN puestos pu ON pu.id=s.puesto_id;

  SELECT jsonb_build_object('indice',x.ind,'semaforo',public.kpi_semaforo_cumplimiento(x.ind),'indice_anterior',x.ind_ant,
    'semaforo_anterior',CASE WHEN x.ind_ant IS NULL THEN NULL ELSE public.kpi_semaforo_cumplimiento(x.ind_ant) END,
    'con_dato',x.cd,'total',x.tot,'verde',x.v,'amarillo',x.am,'rojo',x.ro,'sin_base',x.sb,'sin_captura',x.sc)
  INTO _sgc FROM (
    SELECT sum(c.cumplimiento*c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL) / nullif(sum(c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL),0) ind,
      sum(a.cumplimiento*a.peso) FILTER (WHERE a.cumplimiento IS NOT NULL) / nullif(sum(a.peso) FILTER (WHERE a.cumplimiento IS NOT NULL),0) ind_ant,
      count(*) FILTER (WHERE c.cumplimiento IS NOT NULL)::int cd, count(*)::int tot,
      count(*) FILTER (WHERE c.semaforo='verde')::int v, count(*) FILTER (WHERE c.semaforo='amarillo')::int am, count(*) FILTER (WHERE c.semaforo='rojo')::int ro,
      count(*) FILTER (WHERE c.semaforo='sin base')::int sb, count(*) FILTER (WHERE c.semaforo='sin captura')::int sc
    FROM _k3a_cur c LEFT JOIN _k3a_ant a ON a.kid=c.kid WHERE c.tabla='kpi_definiciones' AND c.nivel='SGC') x;

  SELECT coalesce(jsonb_agg(jsonb_build_object('proceso',s.proceso,'indice',s.ind,'semaforo',public.kpi_semaforo_cumplimiento(s.ind),'con_dato',s.cd,'total',s.tot) ORDER BY s.proceso),'[]'::jsonb)
  INTO _proc FROM (
    SELECT coalesce(c.proceso,'Sin proceso') proceso,
      sum(c.cumplimiento*c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL AND c.nivel='SGC') / nullif(sum(c.peso) FILTER (WHERE c.cumplimiento IS NOT NULL AND c.nivel='SGC'),0) ind,
      count(*) FILTER (WHERE c.cumplimiento IS NOT NULL)::int cd, count(*)::int tot
    FROM _k3a_cur c WHERE c.tabla='kpi_definiciones' GROUP BY 1) s;

  RETURN jsonb_build_object('tipo',lower(_tipo),'inicio',p.inicio,'fin',p.fin,'anterior',jsonb_build_object('inicio',pa.inicio,'fin',pa.fin),
    'kpis',_kpis,'puestos',_puestos,'indice_sgc',_sgc,'procesos',_proc);
END $$;
REVOKE ALL ON FUNCTION public.kpi_resumen_periodo(text,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kpi_resumen_periodo(text,date,jsonb) TO authenticated;