-- P1b.1 ONLY: execute independently before the full P1 rollback.
-- drizzle/rollback/p1_down.sql is platform-managed and read-only in this workspace.
-- Restore check-folios-revision to new Date(); setMonth(getMonth() - 12) first.
DO $rollback$
DECLARE v_def text;
BEGIN
  IF to_regprocedure('public.pendientes_riesgos()') IS NOT NULL THEN
    SELECT pg_get_functiondef('public.pendientes_riesgos()'::regprocedure) INTO v_def;
    EXECUTE replace(v_def, 'f.updated_at < public.folios_revision_corte()', 'f.updated_at < now() - interval ''1 year''');
  END IF;
END $rollback$;
DROP FUNCTION IF EXISTS public.folios_revision_corte(timestamptz);
-- UI: restore AppLayout.tsx, ModuloGuard.tsx, useNavigationItems.ts,
-- modules/tipos.ts and riesgos/module.ts; remove modules/contexto.ts and P1b.1 tests.