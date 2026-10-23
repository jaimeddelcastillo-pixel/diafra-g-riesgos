CREATE OR REPLACE FUNCTION public.kpi_excel_numero(_valor text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ BEGIN IF _valor IS NULL OR btrim(_valor)='' OR _valor !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' THEN RETURN NULL; END IF; RETURN _valor::numeric; EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION public.kpi_excel_fecha(_valor text) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ BEGIN IF _valor IS NULL OR _valor !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF; RETURN _valor::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION public.previsualizar_resultados_excel(_celdas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.get_user_org_id(); hoy date:=(now() AT TIME ZONE 'America/Mexico_City')::date; salida jsonb;
BEGIN
IF org IS NULL OR auth.uid() IS NULL OR NOT public.org_tiene_modulo(org,'indicadores') THEN RAISE EXCEPTION 'Sin acceso a Indicadores'; END IF;
IF jsonb_typeof(_celdas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Archivo de resultados inválido'; END IF;
IF jsonb_array_length(_celdas)>5000 THEN RAISE EXCEPTION 'Límite de 5 000 celdas'; END IF;
WITH entrada AS MATERIALIZED (
 SELECT e.value celda,e.ordinality orden, e.value->>'tipo' tipo,e.value->>'codigo' codigo,public.kpi_excel_fecha(e.value->>'inicio') inicio,public.kpi_excel_numero(e.value->>'numerador') num,public.kpi_excel_numero(e.value->>'denominador') den,btrim(coalesce(e.value->>'referencia','')) referencia FROM jsonb_array_elements(_celdas) WITH ORDINALITY e
), catalogo AS MATERIALIZED (
 SELECT d.id,'SGC'::text tipo,'kpi_definiciones'::text tabla,d.codigo,d.activo,d.estado,d.frecuencia,d.unidad,d.meta,d.tendencia,d.nivel='SGC' sgc,d.capturistas FROM public.kpi_definiciones d WHERE d.org_id=org AND EXISTS(SELECT 1 FROM entrada e WHERE e.tipo='SGC' AND e.codigo=d.codigo)
 UNION ALL SELECT p.id,'puesto','kpi_puesto',p.codigo,p.activo,p.estado,p.frecuencia,p.unidad,p.meta,p.tendencia,false,p.capturistas FROM public.kpi_puesto p WHERE p.org_id=org AND EXISTS(SELECT 1 FROM entrada e WHERE e.tipo='puesto' AND e.codigo=p.codigo)
), permisos AS MATERIALIZED (SELECT k.*,public.kpi_puede_capturar(org,k.capturistas) permiso FROM catalogo k), filas AS (
 SELECT e.*,k.id kpi_id,k.tabla,k.unidad,k.meta,k.tendencia,r.id resultado_id,r.numerador anterior_num,r.denominador anterior_den,r.referencia_fuente anterior_ref,r.comentario,coalesce(r.unidad_copia,k.unidad) unidad_calculo,coalesce(r.meta_copia,k.meta) meta_calculo,coalesce(r.tendencia_copia,k.tendencia) tendencia_calculo,
 concat_ws('; ',CASE WHEN k.id IS NULL THEN 'KPI inexistente' WHEN NOT k.activo OR k.estado<>'validado' THEN 'KPI en borrador o inactivo' END,CASE WHEN k.id IS NOT NULL AND NOT k.permiso THEN 'Sin permiso de captura' END,
 CASE WHEN e.inicio IS NULL OR per.inicio IS NULL OR e.inicio IS DISTINCT FROM per.inicio THEN 'Periodo inválido para la frecuencia' WHEN per.fin>=hoy OR e.inicio>uc.inicio THEN 'Periodo abierto' END,
 CASE WHEN e.num IS NULL THEN 'Numerador inválido' END,
 CASE WHEN coalesce(r.unidad_copia,k.unidad)<>'número' AND e.den IS NULL THEN 'Denominador faltante o inválido' WHEN btrim(coalesce(e.celda->>'denominador',''))<>'' AND e.den IS NULL THEN 'Denominador inválido' END,
 CASE WHEN k.sgc AND e.referencia='' THEN 'SGC sin referencia de la fuente' END,
 CASE WHEN count(*) OVER(PARTITION BY e.tipo,e.codigo,e.celda->>'inicio')>1 THEN 'Celda duplicada' END) error
 FROM entrada e LEFT JOIN permisos k ON k.tipo=e.tipo AND k.codigo=e.codigo LEFT JOIN LATERAL public.kpi_periodo(k.frecuencia,e.inicio) per ON true LEFT JOIN LATERAL public.kpi_ultimo_cerrado(k.frecuencia,hoy) uc ON true LEFT JOIN public.kpi_resultados r ON r.org_id=org AND r.activo AND ((k.tabla='kpi_definiciones' AND r.kpi_definicion_id=k.id) OR (k.tabla='kpi_puesto' AND r.kpi_puesto_id=k.id)) AND r.periodo_inicio=e.inicio
)
SELECT coalesce(jsonb_agg(jsonb_build_object('celda',f.celda,'tabla',f.tabla,'kpi_id',f.kpi_id,'resultado_id',f.resultado_id,'estado',CASE WHEN f.error<>'' THEN 'error' WHEN f.resultado_id IS NULL THEN 'nuevo' WHEN f.num IS NOT DISTINCT FROM f.anterior_num AND f.den IS NOT DISTINCT FROM f.anterior_den AND f.referencia IS NOT DISTINCT FROM f.anterior_ref THEN 'sin cambio' ELSE 'cambia' END,'error',f.error,'antes',CASE WHEN f.resultado_id IS NOT NULL THEN jsonb_build_object('numerador',f.anterior_num,'denominador',f.anterior_den,'referencia',f.anterior_ref) END,'despues',jsonb_build_object('numerador',f.num,'denominador',f.den,'referencia',f.referencia),'comentario',coalesce(f.comentario,''),'valor',calc.valor,'cumplimiento',calc.cumplimiento,'semaforo',calc.semaforo) ORDER BY f.orden),'[]'::jsonb) INTO salida FROM filas f LEFT JOIN LATERAL public.kpi_calcular(f.unidad_calculo,f.tendencia_calculo,f.meta_calculo,f.num,f.den) calc ON f.error='';
RETURN salida; END $$;
CREATE OR REPLACE FUNCTION public.aplicar_resultados_excel(_celdas jsonb,_motivo text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE vista jsonb; n integer; org uuid:=public.get_user_org_id();
BEGIN
IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio de al menos 5 caracteres'; END IF;
-- Stable locks protect the validated preview and preserve explicit corrections, never upserting blindly.
LOCK TABLE public.kpi_resultados IN SHARE ROW EXCLUSIVE MODE;
PERFORM d.id FROM public.kpi_definiciones d WHERE d.org_id=org AND EXISTS(SELECT 1 FROM jsonb_array_elements(_celdas) e WHERE e->>'tipo'='SGC' AND e->>'codigo'=d.codigo) ORDER BY d.id FOR SHARE;
PERFORM p.id FROM public.kpi_puesto p WHERE p.org_id=org AND EXISTS(SELECT 1 FROM jsonb_array_elements(_celdas) e WHERE e->>'tipo'='puesto' AND e->>'codigo'=p.codigo) ORDER BY p.id FOR SHARE;
vista:=public.previsualizar_resultados_excel(_celdas);
IF EXISTS(SELECT 1 FROM jsonb_array_elements(vista) e WHERE e->>'estado'='error') THEN RAISE EXCEPTION 'El archivo contiene errores; no se aplicó ninguna celda'; END IF;
PERFORM set_config('tracea.motivo',btrim(_motivo),true);
-- A single set-based statement invokes the same guarded writer as manual capture, including snapshots and calculation.
SELECT count(public.guardar_kpi_resultado(e->>'tabla',(e->>'kpi_id')::uuid,public.kpi_excel_fecha(e->'celda'->>'inicio'),NULL,'',public.kpi_excel_numero(e->'despues'->>'numerador'),public.kpi_excel_numero(e->'despues'->>'denominador'),e->'despues'->>'referencia',e->>'comentario',_motivo,(e->>'resultado_id')::uuid))::integer INTO n FROM jsonb_array_elements(vista) e WHERE e->>'estado' IN ('nuevo','cambia');
RETURN n; END $$;
REVOKE ALL ON FUNCTION public.kpi_excel_numero(text),public.kpi_excel_fecha(text),public.previsualizar_resultados_excel(jsonb),public.aplicar_resultados_excel(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.previsualizar_resultados_excel(jsonb),public.aplicar_resultados_excel(jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kpi_excel_numero(text),public.kpi_excel_fecha(text),public.previsualizar_resultados_excel(jsonb),public.aplicar_resultados_excel(jsonb,text) TO service_role;