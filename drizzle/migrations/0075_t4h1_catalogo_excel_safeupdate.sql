-- T4h-1: WHERE explícito en el único UPDATE sin filtro de tend_importar_catalogo_excel (pg_safeupdate activo en Cloud).
-- Se reescribe la definición vigente sustituyendo solo esa sentencia; falla si no encuentra el texto exacto.
DO $t4h1$
DECLARE d text; v_old text; v_new text;
BEGIN
 d := pg_get_functiondef('public.tend_importar_catalogo_excel(jsonb,text)'::regprocedure);
 v_old := 'ARRAY[''codigo'',''nombre'',''instrumento_id'',''cuarto_x_id'',''cuarto_y_id'',''limite_normativo_pa'',''unidad'',''activo''] END END;';
 v_new := 'ARRAY[''codigo'',''nombre'',''instrumento_id'',''cuarto_x_id'',''cuarto_y_id'',''limite_normativo_pa'',''unidad'',''activo''] END END'||chr(10)||' WHERE cl IS NULL; -- pg_safeupdate: solo renglones aún sin clasificar (todos los recién cargados).';
 IF position(v_old IN d)=0 THEN RAISE EXCEPTION 'T4h-1: no se encontró la sentencia a corregir'; END IF;
 EXECUTE replace(d, v_old, v_new);
END $t4h1$;