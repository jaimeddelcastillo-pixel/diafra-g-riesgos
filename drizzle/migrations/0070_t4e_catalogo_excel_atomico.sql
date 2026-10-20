CREATE OR REPLACE FUNCTION public.tend_importar_catalogo_excel(_paquete jsonb, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE org uuid; f jsonb; v jsonb; anterior jsonb; actual jsonb; tabla text; permitidos text[]; columnas text; asignaciones text; id_actual uuid; id_ref uuid; codigo text; n integer:=0; key text; ref_tab text; ref_dest text; ref_code text; repetidos text[]:='{}'; dedup text;
BEGIN
 SELECT c.org_id INTO org FROM public.contexto_org_actual() c;
 IF NOT public.tend_acceso(org,true,ARRAY['admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Solo admin o Responsable Sanitario de la empresa activa'; END IF;
 IF length(trim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
 IF _paquete->>'version' IS DISTINCT FROM 'T4e-1' OR jsonb_typeof(_paquete->'filas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Plantilla de otra versión'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('t4e:'||org::text,0));
 PERFORM set_config('tracea.motivo',trim(_motivo),true);
 FOR f IN SELECT value FROM jsonb_array_elements(_paquete->'filas') ORDER BY CASE value->>'hoja' WHEN 'Sistemas_HVAC' THEN 1 WHEN 'Areas' THEN 2 WHEN 'Instrumentos' THEN 3 WHEN 'Objetivos_presion' THEN 4 ELSE 5 END LOOP
  IF f->>'estado' NOT IN ('nuevo','cambia','sin cambio') OR jsonb_array_length(coalesce(f->'errores','[]'))>0 THEN RAISE EXCEPTION 'Hay errores: no se importa nada'; END IF;
  v:=f->'valores'; anterior:=nullif(f->'anterior','null'::jsonb);
  CASE f->>'hoja'
   WHEN 'Sistemas_HVAC' THEN tabla:='tend_sistemas_hvac'; permitidos:=ARRAY['codigo','nombre_uma','descripcion','activo'];
   WHEN 'Areas' THEN tabla:='tend_areas'; permitidos:=ARRAY['codigo','nombre','iso','hvac_id','activo'];
   WHEN 'Instrumentos' THEN tabla:='tend_instrumentos'; permitidos:=ARRAY['codigo','tipo','clase_instrumento','parametro','area_id','area_libre','descripcion_equipo','codigo_bitacora','escala_unidad','escala_min','escala_max','spec_lie','spec_lie_estricto','spec_lse','spec_lse_estricto','spec_estado','spec_referencia','spec_criterio_interno','spec_nota','spec_lie_hr','spec_lse_hr','op_min_pa','op_max_pa','baseline_pa','baseline_tolerancia_pct','dp_final_fabricante','activo','spec_texto','spec_texto_hr'];
   WHEN 'Objetivos_presion' THEN
    IF v->>'uso'='saturación' THEN tabla:='tend_instrumentos'; permitidos:=ARRAY['dp_final_fabricante','escala_unidad']; ELSE tabla:='tend_objetivos_presion'; permitidos:=ARRAY['codigo','nombre','instrumento_id','cuarto_x_id','cuarto_y_id','limite_normativo_pa','unidad','activo']; END IF;
   ELSE RAISE EXCEPTION 'Hoja no válida';
  END CASE;
  codigo:=trim(coalesce(v->>'codigo',v->>'instrumento_codigo',''));
  IF codigo='' THEN RAISE EXCEPTION 'Código obligatorio'; END IF;
  dedup:=(f->>'hoja')||':'||CASE WHEN v->>'uso'='saturación' THEN 'saturacion:' ELSE '' END||lower(codigo);
  IF dedup=ANY(repetidos) THEN RAISE EXCEPTION 'Código duplicado'; END IF; repetidos:=array_append(repetidos,dedup);
  EXECUTE format('SELECT count(*) FROM public.%I WHERE org_id=$1 AND lower(btrim(codigo))=lower($2)',tabla) INTO n USING org,codigo;
  IF n>1 THEN RAISE EXCEPTION 'Código ambiguo: %',codigo; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE org_id=$1 AND lower(btrim(codigo))=lower($2) FOR UPDATE',tabla) INTO actual USING org,codigo;
  IF actual IS DISTINCT FROM anterior THEN RAISE EXCEPTION 'El catálogo cambió desde la vista previa; vuelve a cargar el archivo (%)',codigo; END IF;
  id_actual:=(actual->>'id')::uuid;
  FOREACH key IN ARRAY ARRAY['hvac_codigo','area_codigo','instrumento_codigo','cuarto_x_codigo','cuarto_y_codigo'] LOOP
   IF v ? key THEN
    ref_code:=nullif(trim(v->>key),'');
    ref_tab:=CASE key WHEN 'hvac_codigo' THEN 'tend_sistemas_hvac' WHEN 'instrumento_codigo' THEN 'tend_instrumentos' ELSE 'tend_areas' END;
    ref_dest:=CASE key WHEN 'hvac_codigo' THEN 'hvac_id' WHEN 'area_codigo' THEN 'area_id' WHEN 'instrumento_codigo' THEN 'instrumento_id' WHEN 'cuarto_x_codigo' THEN 'cuarto_x_id' ELSE 'cuarto_y_id' END;
    id_ref:=null;
    IF ref_code IS NOT NULL THEN
     EXECUTE format('SELECT count(*) FROM public.%I WHERE org_id=$1 AND lower(btrim(codigo))=lower($2)',ref_tab) INTO n USING org,ref_code;
     IF n<>1 THEN RAISE EXCEPTION 'Referencia inexistente o ambigua: %',ref_code; END IF;
     EXECUTE format('SELECT id FROM public.%I WHERE org_id=$1 AND lower(btrim(codigo))=lower($2)',ref_tab) INTO id_ref USING org,ref_code;
    END IF;
    IF v->>'uso'='saturación' AND key='instrumento_codigo' THEN
     IF id_ref IS NULL OR id_ref IS DISTINCT FROM id_actual THEN RAISE EXCEPTION 'Instrumento de saturación inexistente'; END IF;
    ELSE v:=v||jsonb_build_object(ref_dest,id_ref); END IF;
   END IF;
  END LOOP;
  IF f->>'hoja'='Sistemas_HVAC' AND trim(coalesce(v->>'nombre_uma',''))='' OR f->>'hoja'='Areas' AND trim(coalesce(v->>'nombre',''))='' THEN RAISE EXCEPTION 'Nombre obligatorio'; END IF;
  IF f->>'hoja'='Instrumentos' THEN
   IF v->>'parametro' NOT IN ('Presión diferencial','Temperatura','HR','ΔP de filtro') OR v->>'parametro' IS NULL OR v->>'tipo' IS NULL OR v->>'clase_instrumento' IS NULL OR trim(coalesce(v->>'escala_unidad',''))='' THEN RAISE EXCEPTION 'Lista o unidad inválida'; END IF;
   IF v->>'spec_estado'='validada' AND coalesce(v->>'spec_lie',v->>'spec_lse',v->>'spec_lie_hr',v->>'spec_lse_hr') IS NULL THEN RAISE EXCEPTION 'Validada sin ningún límite'; END IF;
   IF v->>'spec_lie' IS NOT NULL AND jsonb_typeof(v->'spec_lie_estricto') IS DISTINCT FROM 'boolean' OR v->>'spec_lse' IS NOT NULL AND jsonb_typeof(v->'spec_lse_estricto') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Límite sin comparación'; END IF;
   IF (v->>'spec_lie')::numeric>(v->>'spec_lse')::numeric OR (v->>'spec_lie_hr')::numeric>(v->>'spec_lse_hr')::numeric THEN RAISE EXCEPTION 'LIE mayor que LSE'; END IF;
   IF v->>'parametro' IN ('Presión diferencial','ΔP de filtro') AND ((v->>'spec_lie')::numeric>=18 AND (v->>'spec_lse')::numeric<=25 OR (v->>'spec_lie')::numeric>=30 AND (v->>'spec_lse')::numeric<=65) THEN RAISE EXCEPTION 'Valores que parecen de temperatura o HR en una presión'; END IF;
   IF actual->>'area_estado'='validada' AND v->>'area_id' IS NULL THEN RAISE EXCEPTION 'Área validada sin área asignada'; END IF;
   v:=v||jsonb_build_object('spec_texto',concat_ws(' y ',CASE WHEN v->>'spec_lie' IS NOT NULL THEN (CASE WHEN (v->>'spec_lie_estricto')::boolean THEN '>' ELSE '≥' END)||' '||(v->>'spec_lie')||' '||(v->>'escala_unidad') END,CASE WHEN v->>'spec_lse' IS NOT NULL THEN (CASE WHEN (v->>'spec_lse_estricto')::boolean THEN '<' ELSE '≤' END)||' '||(v->>'spec_lse')||' '||(v->>'escala_unidad') END));
   IF v->>'spec_texto'='' THEN v:=v||jsonb_build_object('spec_texto',null); END IF;
  END IF;
  IF f->>'hoja'='Objetivos_presion' THEN
   IF v->>'uso' NOT IN ('par de cuartos','saturación') OR v->>'uso' IS NULL THEN RAISE EXCEPTION 'Uso inválido'; END IF;
   IF v->>'uso'='saturación' THEN
    IF actual->>'clase_instrumento'<>'filtro_ducto' OR v->>'dp_final_fabricante' IS NULL THEN RAISE EXCEPTION 'Saturación requiere filtro o ducto y valor'; END IF;
   ELSE IF v->>'instrumento_id' IS NULL OR v->>'limite_normativo_pa' IS NULL OR trim(coalesce(v->>'unidad',''))='' THEN RAISE EXCEPTION 'Objetivo requiere instrumento, valor y unidad'; END IF; END IF;
  END IF;
  IF f->>'estado'='sin cambio' THEN CONTINUE; END IF;
  SELECT jsonb_object_agg(e.key,e.value) INTO v FROM jsonb_each(v) e WHERE e.key=ANY(permitidos);
  SELECT string_agg(format('%I',k),','),string_agg(format('%I=r.%I',k,k),',') INTO columnas,asignaciones FROM jsonb_object_keys(v) k;
  IF actual IS NULL THEN
   v:=v||jsonb_build_object('org_id',org,'id',gen_random_uuid());
   EXECUTE format('INSERT INTO public.%I (%s,org_id,id) SELECT %s,r.org_id,r.id FROM jsonb_populate_record(NULL::public.%I,$1) r',tabla,columnas,columnas,tabla) USING v;
  ELSE
   EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.org_id=$2 AND t.id=$3',tabla,asignaciones,tabla) USING v,org,id_actual;
  END IF;
 END LOOP;
 PERFORM set_config('tracea.motivo','',true);
 RETURN jsonb_build_object('aplicado',true);
END $$;
REVOKE ALL ON FUNCTION public.tend_importar_catalogo_excel(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_importar_catalogo_excel(jsonb,text) TO authenticated;
COMMENT ON FUNCTION public.tend_importar_catalogo_excel(jsonb,text) IS 'IM-23: active-company admin/RS atomic catalog import; optimistic preview lock, row audit reason, never deletes or changes issued snapshots. Saturation maps to instrument manufacturer delta-P.';