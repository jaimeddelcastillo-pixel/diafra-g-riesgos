DO $k1$ DECLARE d text;BEGIN SELECT pg_get_functiondef('public.kpi_aplicar_interno(jsonb,text,boolean)'::regprocedure) INTO d;
d:=replace(d,'GROUP BY s.key,x->>''codigo''','GROUP BY s.key,btrim(x->>''codigo'')');
d:=replace(d,'regla_actuacion=excluded.regla_actuacion,estado=excluded.estado','regla_actuacion=excluded.regla_actuacion,estado=CASE WHEN _borrador THEN ''borrador'' ELSE kpi_definiciones.estado END');
d:=replace(d,'peso=excluded.peso,estado=excluded.estado,activo=excluded.activo WHERE kpi_puesto.org_id','peso=excluded.peso,estado=CASE WHEN _borrador THEN ''borrador'' ELSE kpi_puesto.estado END,activo=excluded.activo WHERE kpi_puesto.org_id');
EXECUTE d;END $k1$;