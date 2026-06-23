DROP FUNCTION IF EXISTS public.cumplimiento_curso(uuid);

REVOKE ALL ON FUNCTION public.cumplimiento_curso(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cumplimiento_curso(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cumplimiento_curso(uuid, uuid) TO authenticated;