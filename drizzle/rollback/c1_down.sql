-- C1 rollback completo. Ejecutar en orden inverso: 0003 -> 0002 -> 0001.
BEGIN;

-- ── Deshacer 0003_c1_auditoria_brain ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brain_knowledge_items','brain_knowledge_sources','brain_documents','brain_areas','brain_processes','brain_process_areas','brain_import_batches','brain_import_propuestas','brain_interview_sessions','brain_interview_assignments','brain_assignment_processes','brain_session_processes','brain_contradictions','brain_gaps','brain_memoria_viva','brain_exports']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
  END LOOP;
END $$;
ALTER POLICY "Org admin read audit" ON public.audit_trail
  USING (((org_id = get_user_org_id()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comite_tecnico'::app_role))) OR is_super_admin());

-- ── Deshacer 0002_c1_rls_modulo_brain ──
-- Ejecutar drizzle/rollback/c1_down_politicas_originales.sql (53 ALTER POLICY literales).
-- Alternativa dinámica equivalente:
DO $$
DECLARE r record; v_sql text; m text := ' AND mi_org_tiene_modulo(''institutional_brain''::text)';
BEGIN
  FOR r IN SELECT tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND tablename LIKE 'brain\_%'
      AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%mi_org_tiene_modulo%'
  LOOP
    v_sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN v_sql := v_sql || ' USING ' || replace(r.qual, m, ''); END IF;
    IF r.with_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK ' || replace(r.with_check, m, ''); END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;

-- ── Deshacer 0001_c1_catalogo_modulos ──
DROP FUNCTION IF EXISTS public.mi_org_tiene_modulo(text);
DROP FUNCTION IF EXISTS public.org_tiene_modulo(uuid, text);
DROP TABLE IF EXISTS public.precios;
DROP TABLE IF EXISTS public.plan_modulos;
DROP TABLE IF EXISTS public.planes;
DROP TABLE IF EXISTS public.modulos;

COMMIT;
