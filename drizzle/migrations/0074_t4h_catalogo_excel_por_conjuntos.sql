-- T4h: importación del catálogo de Tendencias por conjuntos (sin EXECUTE ni FOR UPDATE por renglón).
-- tend_guard y audit_trigger_func reconocen el lote de la importación ya autorizada (misma transacción),
-- para no reevaluar tend_acceso por renglón ni auditar renglón por renglón; la RPC inserta la auditoría en bloque.

-- t4h:guard:inicio
CREATE OR REPLACE FUNCTION public.tend_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r text[]; sistema boolean; migracion boolean; lote boolean; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Tendencias: retirar o anular, nunca borrar'; END IF;
 migracion := coalesce(current_setting('tracea.migracion',true),'')='1'
   AND coalesce(current_setting('tracea.motivo',true),'')<>'' AND coalesce(current_setting('tracea.autorizado_por',true),'')<>'';
 sistema := NOT migracion AND auth.uid() IS NULL AND coalesce(current_setting('tracea.origen',true),'')='sistema'
   AND coalesce(current_setting('tracea.motivo',true),'')<>'' AND coalesce(current_setting('tracea.autorizado_por',true),'')<>'';
 -- Lote T4h: la RPC tend_importar_catalogo_excel ya validó empresa activa y rol admin/RS una sola vez en esta transacción.
 lote := TG_TABLE_NAME IN ('tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion')
   AND auth.uid() IS NOT NULL
   AND coalesce(current_setting('tracea.catalogo_lote',true),'')='t4e:'||NEW.org_id::text||':'||pg_current_xact_id()::text;
 r:=CASE WHEN TG_TABLE_NAME IN ('tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_formato','tend_config') THEN ARRAY['admin','responsable_sanitario'] ELSE ARRAY['operador','comite_tecnico','admin','responsable_sanitario'] END;
 IF NOT sistema AND NOT migracion AND NOT lote AND NOT public.tend_acceso(NEW.org_id,true,r) THEN RAISE EXCEPTION 'Sin permiso de escritura en Tendencias'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Identidad y autor originales inmutables'; END IF;
 IF TG_OP='INSERT' AND NOT migracion THEN NEW.created_by:=auth.uid(); NEW.created_at:=now(); END IF;
 IF NOT migracion THEN NEW.updated_by:=auth.uid(); NEW.updated_at:=now(); END IF;
 IF TG_TABLE_NAME='tend_semanas' AND coalesce(to_jsonb(NEW)->>'foto_path','')<>'' AND (split_part(to_jsonb(NEW)->>'foto_path','/',1)<>NEW.org_id::text OR (to_jsonb(NEW)->>'foto_path') ~ '(^|/)\.\.(/|$)') THEN RAISE EXCEPTION 'Foto fuera de empresa'; END IF;
 RETURN NEW;
END $function$;
-- t4h:guard:fin

-- t4h:audit:inicio
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID; v_record_id TEXT; v_solicitado UUID;
  v_motivo TEXT := coalesce(nullif(current_setting('tracea.motivo', true), ''), nullif(current_setting('tracea.retiro_motivo', true), ''), nullif(current_setting('tracea.semana_motivo', true), ''));
  v_autorizado TEXT := nullif(current_setting('tracea.autorizado_por', true), '');
  v_origen TEXT := CASE WHEN auth.uid() IS NULL OR nullif(current_setting('tracea.origen', true), '') = 'sistema' THEN 'sistema' ELSE 'usuario' END;
BEGIN
  -- Lote T4h: tend_importar_catalogo_excel inserta la auditoría de estas filas en bloque (mismo contenido por renglón).
  IF TG_OP IN ('INSERT','UPDATE') AND TG_TABLE_NAME IN ('tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion')
     AND auth.uid() IS NOT NULL
     AND coalesce(current_setting('tracea.catalogo_lote', true), '') = 't4e:'||(to_jsonb(NEW)->>'org_id')||':'||pg_current_xact_id()::text THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    v_org_id := (to_jsonb(OLD) ->> 'org_id')::UUID; v_record_id := (to_jsonb(OLD) ->> 'id');
  ELSE
    v_org_id := (to_jsonb(NEW) ->> 'org_id')::UUID; v_record_id := (to_jsonb(NEW) ->> 'id');
    IF auth.uid() IS NULL THEN
      BEGIN v_solicitado := (to_jsonb(NEW) ->> 'actualizado_por')::UUID; EXCEPTION WHEN others THEN v_solicitado := NULL; END;
    END IF;
  END IF;
  IF v_org_id IS NULL THEN v_org_id := public.get_user_org_id(); END IF;
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, solicitado_por, motivo, origen, autorizado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_solicitado, v_motivo, v_origen, v_autorizado);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_nuevo, solicitado_por, motivo, origen, autorizado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW), v_solicitado, v_motivo, v_origen, v_autorizado);
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_trail (user_id, org_id, tabla, registro_id, accion, valor_anterior, motivo, origen, autorizado_por)
    VALUES (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), v_motivo, v_origen, v_autorizado);
    RETURN OLD;
  END IF;
END;
$function$;
-- t4h:audit:fin

-- t4h:rpc:inicio
CREATE OR REPLACE FUNCTION public.tend_importar_catalogo_excel(_paquete jsonb, _motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, pg_temp
AS $function$
DECLARE
 v_org uuid; v_uid uuid := auth.uid(); v_h text; v_msg text; v_n integer; v_esperado integer; v_total integer := 0;
 v_motivo text := trim(coalesce(_motivo,''));
 v_autorizado text; v_origen text;
BEGIN
 SELECT c.org_id INTO v_org FROM public.contexto_org_actual() c;
 IF v_org IS NULL OR NOT public.tend_acceso(v_org,true,ARRAY['admin','responsable_sanitario']) THEN RAISE EXCEPTION 'Solo admin o Responsable Sanitario de la empresa activa'; END IF;
 IF length(v_motivo)<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)'; END IF;
 IF _paquete->>'version' IS DISTINCT FROM 'T4e-1' OR jsonb_typeof(_paquete->'filas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Plantilla de otra versión'; END IF;

 -- Un solo bloqueo por empresa y uno por tabla, al inicio.
 PERFORM pg_advisory_xact_lock(hashtextextended('t4e:'||v_org::text,0));
 LOCK TABLE public.tend_sistemas_hvac, public.tend_areas, public.tend_instrumentos, public.tend_objetivos_presion IN SHARE ROW EXCLUSIVE MODE;

 DROP TABLE IF EXISTS pg_temp.t4e_f, pg_temp.t4e_cur, pg_temp.t4e_orig;
 CREATE TEMP TABLE t4e_f(ord integer PRIMARY KEY, hoja text, estado text, nerr integer, anterior jsonb, v jsonb, sat boolean, codigo text, cl text, tabla text, permitidos text[], actual jsonb, id_actual uuid, nuevo_id uuid, rec jsonb) ON COMMIT DROP;
 CREATE TEMP TABLE t4e_cur(tabla text, cl text, id uuid, fila jsonb) ON COMMIT DROP;

 INSERT INTO pg_temp.t4e_f(ord,hoja,estado,nerr,anterior,v,sat,codigo)
 SELECT e.ord::integer, e.f->>'hoja', e.f->>'estado',
  CASE WHEN e.f->'errores' IS NULL OR e.f->'errores'='null'::jsonb THEN 0 WHEN jsonb_typeof(e.f->'errores')='array' THEN jsonb_array_length(e.f->'errores') ELSE 1 END,
  nullif(e.f->'anterior','null'::jsonb), coalesce(nullif(e.f->'valores','null'::jsonb),'{}'::jsonb),
  coalesce(e.f->'valores'->>'uso'='saturación',false),
  trim(coalesce(e.f->'valores'->>'codigo',e.f->'valores'->>'instrumento_codigo',''))
 FROM jsonb_array_elements(_paquete->'filas') WITH ORDINALITY e(f,ord);

 UPDATE pg_temp.t4e_f SET cl=lower(codigo),
  tabla=CASE hoja WHEN 'Sistemas_HVAC' THEN 'tend_sistemas_hvac' WHEN 'Areas' THEN 'tend_areas' WHEN 'Instrumentos' THEN 'tend_instrumentos'
   WHEN 'Objetivos_presion' THEN CASE WHEN sat THEN 'tend_instrumentos' ELSE 'tend_objetivos_presion' END END,
  permitidos=CASE hoja
   WHEN 'Sistemas_HVAC' THEN ARRAY['codigo','nombre_uma','descripcion','activo']
   WHEN 'Areas' THEN ARRAY['codigo','nombre','iso','hvac_id','activo']
   WHEN 'Instrumentos' THEN ARRAY['codigo','tipo','clase_instrumento','parametro','area_id','area_libre','descripcion_equipo','codigo_bitacora','escala_unidad','escala_min','escala_max','spec_lie','spec_lie_estricto','spec_lse','spec_lse_estricto','spec_estado','spec_referencia','spec_criterio_interno','spec_nota','spec_lie_hr','spec_lse_hr','op_min_pa','op_max_pa','baseline_pa','baseline_tolerancia_pct','dp_final_fabricante','activo','spec_texto','spec_texto_hr']
   WHEN 'Objetivos_presion' THEN CASE WHEN sat THEN ARRAY['dp_final_fabricante','escala_unidad','activo'] ELSE ARRAY['codigo','nombre','instrumento_id','cuarto_x_id','cuarto_y_id','limite_normativo_pa','unidad','activo'] END END;

 -- Validaciones de contenido (todas antes de escribir).
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE estado IS NULL OR estado NOT IN ('nuevo','cambia','sin cambio') OR nerr>0) THEN RAISE EXCEPTION 'Hay errores: no se importa nada'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE tabla IS NULL) THEN RAISE EXCEPTION 'Hoja no válida'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE codigo='') THEN RAISE EXCEPTION 'Código obligatorio'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f GROUP BY hoja,sat,cl HAVING count(*)>1) THEN RAISE EXCEPTION 'Código duplicado'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Sistemas_HVAC' AND trim(coalesce(v->>'nombre_uma',''))='' OR hoja='Areas' AND trim(coalesce(v->>'nombre',''))='') THEN RAISE EXCEPTION 'Nombre obligatorio'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Instrumentos' AND (v->>'parametro' IS NULL OR v->>'parametro' NOT IN ('Presión diferencial','Temperatura','HR','ΔP de filtro') OR v->>'tipo' IS NULL OR v->>'clase_instrumento' IS NULL OR trim(coalesce(v->>'escala_unidad',''))='')) THEN RAISE EXCEPTION 'Lista o unidad inválida'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Instrumentos' AND v->>'spec_estado'='validada' AND coalesce(v->>'spec_lie',v->>'spec_lse',v->>'spec_lie_hr',v->>'spec_lse_hr') IS NULL) THEN RAISE EXCEPTION 'Validada sin ningún límite'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Instrumentos' AND (v->>'spec_lie' IS NOT NULL AND jsonb_typeof(v->'spec_lie_estricto') IS DISTINCT FROM 'boolean' OR v->>'spec_lse' IS NOT NULL AND jsonb_typeof(v->'spec_lse_estricto') IS DISTINCT FROM 'boolean')) THEN RAISE EXCEPTION 'Límite sin comparación'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Instrumentos' AND ((v->>'spec_lie')::numeric>(v->>'spec_lse')::numeric OR (v->>'spec_lie_hr')::numeric>(v->>'spec_lse_hr')::numeric)) THEN RAISE EXCEPTION 'LIE mayor que LSE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Instrumentos' AND v->>'parametro' IN ('Presión diferencial','ΔP de filtro') AND ((v->>'spec_lie')::numeric>=18 AND (v->>'spec_lse')::numeric<=25 OR (v->>'spec_lie')::numeric>=30 AND (v->>'spec_lse')::numeric<=65)) THEN RAISE EXCEPTION 'Valores que parecen de temperatura o HR en una presión'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Objetivos_presion' AND (v->>'uso' IS NULL OR v->>'uso' NOT IN ('par de cuartos','saturación'))) THEN RAISE EXCEPTION 'Uso inválido'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Objetivos_presion' AND sat AND trim(coalesce(v->>'escala_unidad',''))='') THEN RAISE EXCEPTION 'Unidad de saturación obligatoria'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f s JOIN pg_temp.t4e_f i ON i.hoja='Instrumentos' AND lower(btrim(i.v->>'codigo'))=s.cl
   WHERE s.hoja='Objetivos_presion' AND s.sat AND (nullif(i.v->'dp_final_fabricante','null'::jsonb) IS NOT NULL AND i.v->'dp_final_fabricante' IS DISTINCT FROM s.v->'dp_final_fabricante' OR i.v->'escala_unidad' IS DISTINCT FROM s.v->'escala_unidad' OR i.v->'activo' IS DISTINCT FROM s.v->'activo')) THEN RAISE EXCEPTION 'Saturación contradice los datos del instrumento'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Objetivos_presion' AND sat AND v->>'dp_final_fabricante' IS NULL) THEN RAISE EXCEPTION 'Saturación requiere filtro o ducto y valor'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja='Objetivos_presion' AND NOT sat AND (v->>'limite_normativo_pa' IS NULL OR trim(coalesce(v->>'unidad',''))='')) THEN RAISE EXCEPTION 'Objetivo requiere instrumento, valor y unidad'; END IF;

 -- Foto del catálogo antes de escribir: concurrencia optimista contra la vista previa.
 INSERT INTO pg_temp.t4e_cur
  SELECT 'tend_sistemas_hvac',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_sistemas_hvac t WHERE t.org_id=v_org
  UNION ALL SELECT 'tend_areas',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_areas t WHERE t.org_id=v_org
  UNION ALL SELECT 'tend_instrumentos',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_instrumentos t WHERE t.org_id=v_org
  UNION ALL SELECT 'tend_objetivos_presion',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_objetivos_presion t WHERE t.org_id=v_org;
 CREATE TEMP TABLE t4e_orig ON COMMIT DROP AS SELECT * FROM pg_temp.t4e_cur;
 SELECT f.codigo INTO v_msg FROM pg_temp.t4e_f f JOIN pg_temp.t4e_orig o ON o.tabla=f.tabla AND o.cl=f.cl GROUP BY f.ord,f.codigo HAVING count(*)>1 ORDER BY f.ord LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION 'Código ambiguo: %',v_msg; END IF;
 SELECT f.codigo INTO v_msg FROM pg_temp.t4e_f f LEFT JOIN pg_temp.t4e_orig o ON o.tabla=f.tabla AND o.cl=f.cl WHERE o.fila IS DISTINCT FROM f.anterior ORDER BY f.ord LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION 'El catálogo cambió desde la vista previa; vuelve a cargar el archivo (%)',v_msg; END IF;

 v_autorizado := nullif(current_setting('tracea.autorizado_por',true),'');
 v_origen := CASE WHEN v_uid IS NULL OR nullif(current_setting('tracea.origen',true),'')='sistema' THEN 'sistema' ELSE 'usuario' END;
 PERFORM set_config('tracea.motivo',v_motivo,true);
 PERFORM set_config('tracea.catalogo_lote','t4e:'||v_org::text||':'||pg_current_xact_id()::text,true);

 -- Cuatro etapas en orden de dependencia; cada una es un conjunto de sentencias, no un ciclo por renglón.
 FOREACH v_h IN ARRAY ARRAY['Sistemas_HVAC','Areas','Instrumentos','Objetivos_presion'] LOOP
  CONTINUE WHEN NOT EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja=v_h);
  IF v_h<>'Sistemas_HVAC' THEN
   TRUNCATE pg_temp.t4e_cur;
   INSERT INTO pg_temp.t4e_cur
    SELECT 'tend_sistemas_hvac',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_sistemas_hvac t WHERE t.org_id=v_org
    UNION ALL SELECT 'tend_areas',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_areas t WHERE t.org_id=v_org
    UNION ALL SELECT 'tend_instrumentos',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_instrumentos t WHERE t.org_id=v_org
    UNION ALL SELECT 'tend_objetivos_presion',lower(btrim(t.codigo)),t.id,to_jsonb(t) FROM public.tend_objetivos_presion t WHERE t.org_id=v_org;
  END IF;
  SELECT f.codigo INTO v_msg FROM pg_temp.t4e_f f JOIN pg_temp.t4e_cur c ON c.tabla=f.tabla AND c.cl=f.cl WHERE f.hoja=v_h GROUP BY f.ord,f.codigo HAVING count(*)>1 ORDER BY f.ord LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Código ambiguo: %',v_msg; END IF;
  UPDATE pg_temp.t4e_f f SET actual=c.fila, id_actual=c.id FROM pg_temp.t4e_cur c WHERE f.hoja=v_h AND c.tabla=f.tabla AND c.cl=f.cl;
  UPDATE pg_temp.t4e_f SET nuevo_id=coalesce(id_actual,gen_random_uuid()) WHERE hoja=v_h;

  -- Referencias por código contra el estado actual (incluye lo creado en etapas previas).
  SELECT nullif(trim(f.v->>m.k),'') INTO v_msg
  FROM pg_temp.t4e_f f CROSS JOIN (VALUES ('hvac_codigo','tend_sistemas_hvac'),('area_codigo','tend_areas'),('instrumento_codigo','tend_instrumentos'),('cuarto_x_codigo','tend_areas'),('cuarto_y_codigo','tend_areas')) m(k,tab)
  WHERE f.hoja=v_h AND f.v ? m.k AND nullif(trim(f.v->>m.k),'') IS NOT NULL
    AND (SELECT count(*) FROM pg_temp.t4e_cur c WHERE c.tabla=m.tab AND c.cl=lower(trim(f.v->>m.k)))<>1
  ORDER BY f.ord LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Referencia inexistente o ambigua: %',v_msg; END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.t4e_f f WHERE f.hoja=v_h AND f.sat AND f.v ? 'instrumento_codigo'
    AND (SELECT c.id FROM pg_temp.t4e_cur c WHERE c.tabla='tend_instrumentos' AND c.cl=lower(nullif(trim(f.v->>'instrumento_codigo'),''))) IS DISTINCT FROM f.id_actual) THEN
   RAISE EXCEPTION 'Instrumento de saturación inexistente'; END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.t4e_f f WHERE f.hoja=v_h AND f.sat AND f.v ? 'instrumento_codigo' AND f.id_actual IS NULL) THEN RAISE EXCEPTION 'Instrumento de saturación inexistente'; END IF;
  UPDATE pg_temp.t4e_f f SET v=f.v||coalesce((
    SELECT jsonb_object_agg(m.dest,(SELECT c.id FROM pg_temp.t4e_cur c WHERE c.tabla=m.tab AND c.cl=lower(nullif(trim(f.v->>m.k),''))))
    FROM (VALUES ('hvac_codigo','tend_sistemas_hvac','hvac_id'),('area_codigo','tend_areas','area_id'),('instrumento_codigo','tend_instrumentos','instrumento_id'),('cuarto_x_codigo','tend_areas','cuarto_x_id'),('cuarto_y_codigo','tend_areas','cuarto_y_id')) m(k,tab,dest)
    WHERE f.v ? m.k AND NOT (f.sat AND m.k='instrumento_codigo')),'{}'::jsonb)
  WHERE f.hoja=v_h;

  IF v_h='Instrumentos' THEN
   IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja=v_h AND actual->>'area_estado'='validada' AND v->>'area_id' IS NULL) THEN RAISE EXCEPTION 'Área validada sin área asignada'; END IF;
   UPDATE pg_temp.t4e_f SET v=v||jsonb_build_object('spec_texto',nullif(concat_ws(' y ',
     CASE WHEN v->>'spec_lie' IS NOT NULL THEN (CASE WHEN (v->>'spec_lie_estricto')::boolean THEN '>' ELSE '≥' END)||' '||(v->>'spec_lie')||' '||(v->>'escala_unidad') END,
     CASE WHEN v->>'spec_lse' IS NOT NULL THEN (CASE WHEN (v->>'spec_lse_estricto')::boolean THEN '<' ELSE '≤' END)||' '||(v->>'spec_lse')||' '||(v->>'escala_unidad') END),''))
   WHERE hoja=v_h;
  ELSIF v_h='Objetivos_presion' THEN
   IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja=v_h AND sat AND actual->>'clase_instrumento' IS DISTINCT FROM 'filtro_ducto') THEN RAISE EXCEPTION 'Saturación requiere filtro o ducto y valor'; END IF;
   IF EXISTS(SELECT 1 FROM pg_temp.t4e_f WHERE hoja=v_h AND NOT sat AND v->>'instrumento_id' IS NULL) THEN RAISE EXCEPTION 'Objetivo requiere instrumento, valor y unidad'; END IF;
  END IF;

  -- Renglón listo para escribir: valores actuales (o valores por omisión de la tabla) + solo campos permitidos de la plantilla.
  UPDATE pg_temp.t4e_f f SET rec=coalesce(f.actual,CASE f.tabla
     WHEN 'tend_sistemas_hvac' THEN '{"descripcion":"","activo":true}'::jsonb
     WHEN 'tend_areas' THEN '{"activo":true}'::jsonb
     WHEN 'tend_instrumentos' THEN '{"activo":true,"baseline_tolerancia_pct":25,"spec_lie_estricto":false,"spec_lse_estricto":false,"spec_criterio_interno":false}'::jsonb
     ELSE '{"unidad":"Pa","activo":true}'::jsonb END)
   ||coalesce((SELECT jsonb_object_agg(e.key,e.value) FROM jsonb_each(f.v) e WHERE e.key=ANY(f.permitidos)),'{}'::jsonb)
   ||jsonb_build_object('id',f.nuevo_id,'org_id',v_org)
  WHERE f.hoja=v_h AND f.estado<>'sin cambio';
  SELECT count(*) INTO v_esperado FROM pg_temp.t4e_f WHERE hoja=v_h AND rec IS NOT NULL;
  CONTINUE WHEN v_esperado=0;
  v_n := 0;

  -- Una sentencia INSERT … SELECT … ON CONFLICT por tabla, con auditoría masiva en la misma sentencia.
  WITH w AS (
   INSERT INTO public.tend_sistemas_hvac AS t (id,org_id,codigo,nombre_uma,descripcion,activo)
   SELECT r.id,r.org_id,r.codigo,r.nombre_uma,r.descripcion,r.activo
   FROM pg_temp.t4e_f f CROSS JOIN LATERAL jsonb_populate_record(NULL::public.tend_sistemas_hvac,f.rec) r
   WHERE f.hoja=v_h AND f.tabla='tend_sistemas_hvac' AND f.rec IS NOT NULL
   ON CONFLICT (id) DO UPDATE SET codigo=EXCLUDED.codigo,nombre_uma=EXCLUDED.nombre_uma,descripcion=EXCLUDED.descripcion,activo=EXCLUDED.activo
    WHERE t.org_id=EXCLUDED.org_id
   RETURNING t.id,to_jsonb(t.*) AS nuevo)
  INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo,motivo,origen,autorizado_por)
  SELECT v_uid,v_org,'tend_sistemas_hvac',w.id::text,CASE WHEN f.id_actual IS NULL THEN 'INSERT' ELSE 'UPDATE' END,f.actual,w.nuevo,v_motivo,v_origen,v_autorizado
  FROM w JOIN pg_temp.t4e_f f ON f.nuevo_id=w.id AND f.hoja=v_h ORDER BY f.ord;
  GET DIAGNOSTICS v_esperado = ROW_COUNT; v_n := v_n+v_esperado;

  WITH w AS (
   INSERT INTO public.tend_areas AS t (id,org_id,codigo,nombre,iso,hvac_id,activo)
   SELECT r.id,r.org_id,r.codigo,r.nombre,r.iso,r.hvac_id,r.activo
   FROM pg_temp.t4e_f f CROSS JOIN LATERAL jsonb_populate_record(NULL::public.tend_areas,f.rec) r
   WHERE f.hoja=v_h AND f.tabla='tend_areas' AND f.rec IS NOT NULL
   ON CONFLICT (id) DO UPDATE SET codigo=EXCLUDED.codigo,nombre=EXCLUDED.nombre,iso=EXCLUDED.iso,hvac_id=EXCLUDED.hvac_id,activo=EXCLUDED.activo
    WHERE t.org_id=EXCLUDED.org_id
   RETURNING t.id,to_jsonb(t.*) AS nuevo)
  INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo,motivo,origen,autorizado_por)
  SELECT v_uid,v_org,'tend_areas',w.id::text,CASE WHEN f.id_actual IS NULL THEN 'INSERT' ELSE 'UPDATE' END,f.actual,w.nuevo,v_motivo,v_origen,v_autorizado
  FROM w JOIN pg_temp.t4e_f f ON f.nuevo_id=w.id AND f.hoja=v_h ORDER BY f.ord;
  GET DIAGNOSTICS v_esperado = ROW_COUNT; v_n := v_n+v_esperado;

  WITH w AS (
   INSERT INTO public.tend_instrumentos AS t (id,org_id,codigo,tipo,clase_instrumento,parametro,area_id,area_libre,descripcion_equipo,codigo_bitacora,escala_unidad,escala_min,escala_max,spec_lie,spec_lie_estricto,spec_lse,spec_lse_estricto,spec_estado,spec_referencia,spec_criterio_interno,spec_nota,spec_lie_hr,spec_lse_hr,op_min_pa,op_max_pa,baseline_pa,baseline_tolerancia_pct,dp_final_fabricante,activo,spec_texto,spec_texto_hr)
   SELECT r.id,r.org_id,r.codigo,r.tipo,r.clase_instrumento,r.parametro,r.area_id,r.area_libre,r.descripcion_equipo,r.codigo_bitacora,r.escala_unidad,r.escala_min,r.escala_max,r.spec_lie,r.spec_lie_estricto,r.spec_lse,r.spec_lse_estricto,r.spec_estado,r.spec_referencia,r.spec_criterio_interno,r.spec_nota,r.spec_lie_hr,r.spec_lse_hr,r.op_min_pa,r.op_max_pa,r.baseline_pa,r.baseline_tolerancia_pct,r.dp_final_fabricante,r.activo,r.spec_texto,r.spec_texto_hr
   FROM pg_temp.t4e_f f CROSS JOIN LATERAL jsonb_populate_record(NULL::public.tend_instrumentos,f.rec) r
   WHERE f.hoja=v_h AND f.tabla='tend_instrumentos' AND f.rec IS NOT NULL
   ON CONFLICT (id) DO UPDATE SET codigo=EXCLUDED.codigo,tipo=EXCLUDED.tipo,clase_instrumento=EXCLUDED.clase_instrumento,parametro=EXCLUDED.parametro,area_id=EXCLUDED.area_id,area_libre=EXCLUDED.area_libre,descripcion_equipo=EXCLUDED.descripcion_equipo,codigo_bitacora=EXCLUDED.codigo_bitacora,escala_unidad=EXCLUDED.escala_unidad,escala_min=EXCLUDED.escala_min,escala_max=EXCLUDED.escala_max,spec_lie=EXCLUDED.spec_lie,spec_lie_estricto=EXCLUDED.spec_lie_estricto,spec_lse=EXCLUDED.spec_lse,spec_lse_estricto=EXCLUDED.spec_lse_estricto,spec_estado=EXCLUDED.spec_estado,spec_referencia=EXCLUDED.spec_referencia,spec_criterio_interno=EXCLUDED.spec_criterio_interno,spec_nota=EXCLUDED.spec_nota,spec_lie_hr=EXCLUDED.spec_lie_hr,spec_lse_hr=EXCLUDED.spec_lse_hr,op_min_pa=EXCLUDED.op_min_pa,op_max_pa=EXCLUDED.op_max_pa,baseline_pa=EXCLUDED.baseline_pa,baseline_tolerancia_pct=EXCLUDED.baseline_tolerancia_pct,dp_final_fabricante=EXCLUDED.dp_final_fabricante,activo=EXCLUDED.activo,spec_texto=EXCLUDED.spec_texto,spec_texto_hr=EXCLUDED.spec_texto_hr
    WHERE t.org_id=EXCLUDED.org_id
   RETURNING t.id,to_jsonb(t.*) AS nuevo)
  INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo,motivo,origen,autorizado_por)
  SELECT v_uid,v_org,'tend_instrumentos',w.id::text,CASE WHEN f.id_actual IS NULL THEN 'INSERT' ELSE 'UPDATE' END,f.actual,w.nuevo,v_motivo,v_origen,v_autorizado
  FROM w JOIN pg_temp.t4e_f f ON f.nuevo_id=w.id AND f.hoja=v_h ORDER BY f.ord;
  GET DIAGNOSTICS v_esperado = ROW_COUNT; v_n := v_n+v_esperado;

  WITH w AS (
   INSERT INTO public.tend_objetivos_presion AS t (id,org_id,codigo,nombre,instrumento_id,cuarto_x_id,cuarto_y_id,limite_normativo_pa,unidad,activo)
   SELECT r.id,r.org_id,r.codigo,r.nombre,r.instrumento_id,r.cuarto_x_id,r.cuarto_y_id,r.limite_normativo_pa,r.unidad,r.activo
   FROM pg_temp.t4e_f f CROSS JOIN LATERAL jsonb_populate_record(NULL::public.tend_objetivos_presion,f.rec) r
   WHERE f.hoja=v_h AND f.tabla='tend_objetivos_presion' AND f.rec IS NOT NULL
   ON CONFLICT (id) DO UPDATE SET codigo=EXCLUDED.codigo,nombre=EXCLUDED.nombre,instrumento_id=EXCLUDED.instrumento_id,cuarto_x_id=EXCLUDED.cuarto_x_id,cuarto_y_id=EXCLUDED.cuarto_y_id,limite_normativo_pa=EXCLUDED.limite_normativo_pa,unidad=EXCLUDED.unidad,activo=EXCLUDED.activo
    WHERE t.org_id=EXCLUDED.org_id
   RETURNING t.id,to_jsonb(t.*) AS nuevo)
  INSERT INTO public.audit_trail(user_id,org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo,motivo,origen,autorizado_por)
  SELECT v_uid,v_org,'tend_objetivos_presion',w.id::text,CASE WHEN f.id_actual IS NULL THEN 'INSERT' ELSE 'UPDATE' END,f.actual,w.nuevo,v_motivo,v_origen,v_autorizado
  FROM w JOIN pg_temp.t4e_f f ON f.nuevo_id=w.id AND f.hoja=v_h ORDER BY f.ord;
  GET DIAGNOSTICS v_esperado = ROW_COUNT; v_n := v_n+v_esperado;

  SELECT count(*) INTO v_esperado FROM pg_temp.t4e_f WHERE hoja=v_h AND rec IS NOT NULL;
  IF v_n<>v_esperado THEN RAISE EXCEPTION 'Importación incompleta en %: % de % renglones',v_h,v_n,v_esperado; END IF;
  v_total := v_total+v_n;
 END LOOP;

 PERFORM set_config('tracea.catalogo_lote','',true);
 PERFORM set_config('tracea.motivo','',true);
 RETURN jsonb_build_object('aplicado',true,'renglones',v_total);
END $function$;
-- t4h:rpc:fin

REVOKE ALL ON FUNCTION public.tend_importar_catalogo_excel(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tend_importar_catalogo_excel(jsonb,text) TO authenticated;
COMMENT ON FUNCTION public.tend_importar_catalogo_excel(jsonb,text) IS 'IM-23/T4h: active-company admin/RS atomic catalog import, set-based (one upsert per sheet, one lock per table, bulk audit with row reasons); optimistic preview lock, never deletes or changes issued snapshots. Saturation maps to instrument manufacturer delta-P.';