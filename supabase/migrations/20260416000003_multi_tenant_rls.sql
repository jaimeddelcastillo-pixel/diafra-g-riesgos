-- ============================================================
-- Fase 1 — Multi-tenant: Aislamiento RLS por organización
-- Reemplaza políticas permisivas por políticas org-scoped.
-- Depende de migraciones 000001 y 000002 (datos ya migrados).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. has_role() → ahora lee org_members en lugar de user_roles
--    Mantiene la misma firma para no romper código existente.
--    super_admin pasa cualquier has_role() automáticamente.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id
      AND (role = _role OR role = 'super_admin')
  )
$$;

-- ────────────────────────────────────────────────────────────
-- 2. audit_trigger_func() → captura org_id en cada evento
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    UUID;
  v_record_id TEXT;
BEGIN
  -- Intentar extraer org_id del propio registro (tablas que lo tienen: folios, audit_trail)
  -- Para tablas sin org_id (riesgos, folio_comite, etc.) retorna NULL sin error
  IF TG_OP = 'DELETE' THEN
    v_org_id    := (to_jsonb(OLD) ->> 'org_id')::UUID;
    v_record_id := (to_jsonb(OLD) ->> 'id');
  ELSE
    v_org_id    := (to_jsonb(NEW) ->> 'org_id')::UUID;
    v_record_id := (to_jsonb(NEW) ->> 'id');
  END IF;

  -- Fallback: org del usuario en sesión
  IF v_org_id IS NULL THEN
    v_org_id := public.get_user_org_id();
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_trail
      (user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES
      (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_trail
      (user_id, org_id, tabla, registro_id, accion, valor_nuevo)
    VALUES
      (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_trail
      (user_id, org_id, tabla, registro_id, accion, valor_anterior)
    VALUES
      (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. Eliminar políticas anteriores (permisivas / sin org)
-- ────────────────────────────────────────────────────────────

-- Folios
DROP POLICY IF EXISTS "Authenticated read folios"      ON public.folios;
DROP POLICY IF EXISTS "Operador insert folios"         ON public.folios;
DROP POLICY IF EXISTS "Operador update own folios"     ON public.folios;
DROP POLICY IF EXISTS "Admin delete folios"            ON public.folios;

-- Folio comité
DROP POLICY IF EXISTS "Authenticated read comite"      ON public.folio_comite;
DROP POLICY IF EXISTS "Authenticated insert comite"    ON public.folio_comite;
DROP POLICY IF EXISTS "Update comite"                  ON public.folio_comite;

-- Riesgos
DROP POLICY IF EXISTS "Authenticated read riesgos"     ON public.riesgos;
DROP POLICY IF EXISTS "Authenticated insert riesgos"   ON public.riesgos;
DROP POLICY IF EXISTS "Update riesgos"                 ON public.riesgos;
DROP POLICY IF EXISTS "Admin delete riesgos"           ON public.riesgos;

-- Audit trail
DROP POLICY IF EXISTS "Admin read audit"               ON public.audit_trail;
DROP POLICY IF EXISTS "Authenticated insert audit"     ON public.audit_trail;

-- Folio versiones
DROP POLICY IF EXISTS "Authenticated read folio_versiones"  ON public.folio_versiones;
DROP POLICY IF EXISTS "System insert folio_versiones"       ON public.folio_versiones;

-- User roles (se mantiene la tabla pero se actualizan sus políticas)
DROP POLICY IF EXISTS "Users read own roles"           ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles"            ON public.user_roles;

-- Storage evidencias
DROP POLICY IF EXISTS "Authenticated users can upload evidencias"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read evidencias"    ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete evidencias"                ON storage.objects;

-- ────────────────────────────────────────────────────────────
-- 4. RLS: organizations
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Org members read own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Super admin manage orgs"
  ON public.organizations FOR ALL TO authenticated
  USING (public.is_super_admin());

-- ────────────────────────────────────────────────────────────
-- 5. RLS: org_members
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Members read own org members"
  ON public.org_members FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Admins manage org members"
  ON public.org_members FOR ALL TO authenticated
  USING (
    (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
    OR public.is_super_admin()
  );

-- ────────────────────────────────────────────────────────────
-- 6. RLS: folios (aislamiento directo por org_id)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Org members read folios"
  ON public.folios FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Org members insert folios"
  ON public.folios FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Org members update folios"
  ON public.folios FOR UPDATE TO authenticated
  USING (
    (
      org_id = public.get_user_org_id()
      AND (
        created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'comite_tecnico')
      )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Org admin delete folios"
  ON public.folios FOR DELETE TO authenticated
  USING (
    (org_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
    OR public.is_super_admin()
  );

-- ────────────────────────────────────────────────────────────
-- 7. RLS: riesgos (aislamiento via folios.org_id)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Org members read riesgos"
  ON public.riesgos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = riesgos.folio_id
        AND (f.org_id = public.get_user_org_id() OR public.is_super_admin())
    )
  );

CREATE POLICY "Org members insert riesgos"
  ON public.riesgos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = riesgos.folio_id
        AND (f.org_id = public.get_user_org_id() OR public.is_super_admin())
    )
  );

CREATE POLICY "Org members update riesgos"
  ON public.riesgos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = riesgos.folio_id
        AND f.org_id = public.get_user_org_id()
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'operador')
          OR public.has_role(auth.uid(), 'comite_tecnico')
        )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Org admin delete riesgos"
  ON public.riesgos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = riesgos.folio_id
        AND f.org_id = public.get_user_org_id()
        AND public.has_role(auth.uid(), 'admin')
    )
    OR public.is_super_admin()
  );

-- ────────────────────────────────────────────────────────────
-- 8. RLS: folio_comite (aislamiento via folios.org_id)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Org members read comite"
  ON public.folio_comite FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = folio_comite.folio_id
        AND (f.org_id = public.get_user_org_id() OR public.is_super_admin())
    )
  );

CREATE POLICY "Org members insert comite"
  ON public.folio_comite FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = folio_comite.folio_id
        AND (f.org_id = public.get_user_org_id() OR public.is_super_admin())
    )
  );

CREATE POLICY "Org members update comite"
  ON public.folio_comite FOR UPDATE TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.folios f
        WHERE f.id = folio_comite.folio_id
          AND f.org_id = public.get_user_org_id()
      )
      AND (
        folio_comite.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'comite_tecnico')
      )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Org admin delete comite"
  ON public.folio_comite FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = folio_comite.folio_id
        AND f.org_id = public.get_user_org_id()
        AND public.has_role(auth.uid(), 'admin')
    )
    OR public.is_super_admin()
  );

-- ────────────────────────────────────────────────────────────
-- 9. RLS: folio_versiones (aislamiento via folios.org_id)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Org members read folio_versiones"
  ON public.folio_versiones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = folio_versiones.folio_id
        AND (f.org_id = public.get_user_org_id() OR public.is_super_admin())
    )
  );

CREATE POLICY "Org members insert folio_versiones"
  ON public.folio_versiones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id = folio_versiones.folio_id
        AND (f.org_id = public.get_user_org_id() OR public.is_super_admin())
    )
  );

-- ────────────────────────────────────────────────────────────
-- 10. RLS: audit_trail (solo admin/comite de la misma org)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Org admin read audit"
  ON public.audit_trail FOR SELECT TO authenticated
  USING (
    (
      org_id = public.get_user_org_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'comite_tecnico')
      )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "System insert audit"
  ON public.audit_trail FOR INSERT TO authenticated
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 11. user_roles: solo visible para el propio usuario y admins
--     (tabla legacy, se eliminará en Fase 3 con el nuevo flujo de registro)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Admin read user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin()
  );

-- ────────────────────────────────────────────────────────────
-- 12. Storage: evidencias
--     Fase 1: miembros de org con sesión activa pueden acceder.
--     Fase 3 (frontend): paths incluirán {org_id}/ para aislamiento total.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Org members upload evidencias"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencias'
    AND public.get_user_org_id() IS NOT NULL
  );

CREATE POLICY "Org members read evidencias"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (public.get_user_org_id() IS NOT NULL OR public.is_super_admin())
  );

CREATE POLICY "Org admin delete evidencias"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_super_admin()
    )
  );
