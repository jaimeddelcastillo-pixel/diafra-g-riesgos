CREATE OR REPLACE FUNCTION public.folios_revision_corte(p_ahora timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $fn$
  SELECT (date_trunc('month', p_ahora AT TIME ZONE 'UTC') - interval '12 months'
    + (extract(day FROM p_ahora AT TIME ZONE 'UTC') - 1) * interval '1 day'
    + (date_trunc('milliseconds', p_ahora AT TIME ZONE 'UTC') - date_trunc('day', p_ahora AT TIME ZONE 'UTC')))
    AT TIME ZONE 'UTC'
$fn$;
COMMENT ON FUNCTION public.folios_revision_corte(timestamptz) IS 'Shared cutoff: JavaScript UTC setMonth(month - 12), preserving month overflow, milliseconds and strict updated_at < cutoff; notification suppression is separate.';
REVOKE ALL ON FUNCTION public.folios_revision_corte(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folios_revision_corte(timestamptz) TO authenticated, service_role;
DO $migration$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.pendientes_riesgos()'::regprocedure) INTO v_def;
  IF position('f.updated_at < now() - interval ''1 year''' in v_def) = 0 THEN
    RAISE EXCEPTION 'Unexpected pendientes_riesgos definition; no change applied';
  END IF;
  EXECUTE replace(v_def, 'f.updated_at < now() - interval ''1 year''', 'f.updated_at < public.folios_revision_corte()');
END $migration$;