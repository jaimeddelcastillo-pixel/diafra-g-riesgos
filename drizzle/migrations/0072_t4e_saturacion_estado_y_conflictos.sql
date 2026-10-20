DO $upgrade$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.tend_importar_catalogo_excel(jsonb,text)'::regprocedure) INTO def;
 IF position('permitidos:=ARRAY[''dp_final_fabricante'',''escala_unidad''];' in def)=0 THEN RAISE EXCEPTION 'Definición de saturación inesperada'; END IF;
 def:=replace(def,'permitidos:=ARRAY[''dp_final_fabricante'',''escala_unidad''];','permitidos:=ARRAY[''dp_final_fabricante'',''escala_unidad'',''activo''];');
 def:=replace(def,'IF actual->>''clase_instrumento''<>''filtro_ducto'' OR v->>''dp_final_fabricante'' IS NULL THEN','IF trim(coalesce(v->>''escala_unidad'',''''))='''' THEN RAISE EXCEPTION ''Unidad de saturación obligatoria''; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(_paquete->''filas'') p WHERE p->>''hoja''=''Instrumentos'' AND lower(btrim(p->''valores''->>''codigo''))=lower(codigo) AND (nullif(p->''valores''->''dp_final_fabricante'',''null''::jsonb) IS NOT NULL AND p->''valores''->''dp_final_fabricante'' IS DISTINCT FROM v->''dp_final_fabricante'' OR p->''valores''->''escala_unidad'' IS DISTINCT FROM v->''escala_unidad'' OR p->''valores''->''activo'' IS DISTINCT FROM v->''activo'')) THEN RAISE EXCEPTION ''Saturación contradice los datos del instrumento''; END IF;
    IF actual->>''clase_instrumento'' IS DISTINCT FROM ''filtro_ducto'' OR v->>''dp_final_fabricante'' IS NULL THEN');
 EXECUTE def;
END $upgrade$;