DO $$
DECLARE v_definition text;
BEGIN
 SELECT pg_get_functiondef('public.pendientes_riesgos()'::regprocedure) INTO v_definition;
 IF strpos(v_definition, 'WHERE c.activo;') = 0 THEN
  RAISE EXCEPTION 'Unexpected pendientes_riesgos definition; P1c stopped rather than modifying unrelated rules';
 END IF;
 EXECUTE replace(v_definition, 'WHERE c.activo;', 'WHERE c.activo AND c.modulo_clave = ''riesgos'';');
END $$;