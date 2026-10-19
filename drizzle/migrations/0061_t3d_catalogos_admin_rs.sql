DO $$ DECLARE d text; n text; t text; BEGIN
 d:=pg_get_functiondef('public.tend_guard'::regproc);
 n:=replace(d,'THEN ARRAY[''admin''] ELSE','THEN ARRAY[''admin'',''responsable_sanitario''] ELSE');
 IF n=d THEN RAISE EXCEPTION 'tend_guard sin cambio'; END IF;
 EXECUTE n;
 FOREACH t IN ARRAY ARRAY['tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_formato','tend_config'] LOOP
  EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK(public.tend_acceso(org_id,true,ARRAY[''admin'',''responsable_sanitario'']::text[]))',t||'_insert',t);
  EXECUTE format('ALTER POLICY %I ON public.%I USING(public.tend_acceso(org_id,true,ARRAY[''admin'',''responsable_sanitario'']::text[])) WITH CHECK(public.tend_acceso(org_id,true,ARRAY[''admin'',''responsable_sanitario'']::text[]))',t||'_update',t);
 END LOOP;
END $$;