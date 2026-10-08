-- C1 Parte C: exigir módulo institutional_brain en todas las políticas de las 18 tablas brain_*.
-- Conserva la condición existente (org/rol/super_admin) y le añade AND mi_org_tiene_modulo.
DO $$
DECLARE r record; v_sql text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname = 'public' AND tablename LIKE 'brain\_%'
      AND coalesce(qual,'') NOT LIKE '%mi_org_tiene_modulo%'
      AND coalesce(with_check,'') NOT LIKE '%mi_org_tiene_modulo%'
  LOOP
    v_sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING ((%s) AND public.mi_org_tiene_modulo(''institutional_brain''::text))', r.qual);
    END IF;
    IF r.with_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK ((%s) AND public.mi_org_tiene_modulo(''institutional_brain''::text))', r.with_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;