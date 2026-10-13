CREATE OR REPLACE FUNCTION public.examen_validar_banco(p_curso_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_counts jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  PERFORM public.examen_validar_acceso(p_curso_id);

  SELECT jsonb_object_agg(bloque, n) INTO v_counts
  FROM (
    SELECT bloque, COUNT(*)::int AS n
    FROM public.curso_evaluacion_preguntas
    WHERE curso_id = p_curso_id AND activo = true
    GROUP BY bloque
  ) t;

  RETURN COALESCE(v_counts, '{}'::jsonb);
END;
$function$;