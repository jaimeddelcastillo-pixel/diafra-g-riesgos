
REVOKE EXECUTE ON FUNCTION public.examen_validar_banco(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.examen_iniciar(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.examen_calificar(uuid, jsonb, int, int) FROM PUBLIC, anon;
