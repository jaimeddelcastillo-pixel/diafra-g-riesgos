DO $upgrade$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.tend_importar_catalogo_excel(jsonb,text)'::regprocedure) INTO def;
 IF position('repetidos text[]:=''{}''; dedup text;' in def)=0 OR position('IF actual IS DISTINCT FROM anterior THEN' in def)=0 THEN RAISE EXCEPTION 'Definición de importación inesperada'; END IF;
 def:=replace(def,'repetidos text[]:=''{}''; dedup text;','repetidos text[]:=''{}''; dedup text; originales jsonb:=''{}''; base jsonb; lock_tab text;');
 def:=replace(def,'PERFORM set_config(''tracea.motivo'',trim(_motivo),true);','FOREACH lock_tab IN ARRAY ARRAY[''tend_sistemas_hvac'',''tend_areas'',''tend_instrumentos'',''tend_objetivos_presion''] LOOP
 EXECUTE format(''SELECT id FROM public.%I WHERE org_id=$1 ORDER BY id FOR UPDATE'',lock_tab) USING org;
 EXECUTE format(''SELECT coalesce(jsonb_object_agg(lower(btrim(codigo)),to_jsonb(t)),''''{}''''::jsonb) FROM public.%I t WHERE org_id=$1'',lock_tab) INTO base USING org;
 originales:=originales||jsonb_build_object(lock_tab,base);
 END LOOP;
 PERFORM set_config(''tracea.motivo'',trim(_motivo),true);');
 def:=replace(def,'IF actual IS DISTINCT FROM anterior THEN','IF (originales->tabla->lower(codigo)) IS DISTINCT FROM anterior THEN');
 def:=replace(def,'IF f->>''estado'' NOT IN (''nuevo'',''cambia'',''sin cambio'') OR','IF f->>''estado'' IS NULL OR f->>''estado'' NOT IN (''nuevo'',''cambia'',''sin cambio'') OR');
 EXECUTE def;
END $upgrade$;