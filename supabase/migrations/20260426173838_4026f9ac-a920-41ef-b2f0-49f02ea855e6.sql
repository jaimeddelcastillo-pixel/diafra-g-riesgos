-- ============================================================
-- BLOQUE A: Correcciones críticas de seguridad
-- ============================================================

-- ---------- FIX 1: profiles ----------
-- Quitar policy "Authenticated read profiles" que permite leer TODO a cualquier user logueado
DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;

-- La policy "Users read own profile" ya cubre: perfil propio + admin/responsable_sanitario
-- Necesitamos agregar: miembros de la misma org pueden verse entre sí

CREATE POLICY "Org members read same org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Super admin ve todos
  public.is_super_admin()
  OR
  -- El propio perfil
  id = auth.uid()
  OR
  -- Miembros de la misma org
  EXISTS (
    SELECT 1
    FROM public.org_members om_self
    JOIN public.org_members om_target ON om_target.org_id = om_self.org_id
    WHERE om_self.user_id = auth.uid()
      AND om_target.user_id = profiles.id
  )
);

-- ---------- FIX 2: audit_trail INSERT ----------
-- Eliminar policy permisiva que permite a CUALQUIER authenticated insertar
DROP POLICY IF EXISTS "System insert audit" ON public.audit_trail;

-- Solo service_role puede insertar directamente.
-- La función audit_trigger_func() es SECURITY DEFINER y bypassa RLS, así que sigue funcionando.
CREATE POLICY "Service role inserts audit"
ON public.audit_trail
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- ---------- FIX 3: Self-registration role escalation ----------
-- Reemplazar policy que permite cualquier rol al auto-registrarse
DROP POLICY IF EXISTS "self_registration_org_members_insert" ON public.org_members;

CREATE POLICY "self_registration_org_members_insert"
ON public.org_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  -- No tener membresía previa
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = auth.uid()
  )
  -- Solo puede asignarse rol 'admin' (creador de su propia org) u 'operador'.
  -- NUNCA super_admin por self-registration.
  AND role IN ('admin'::app_role, 'operador'::app_role)
);
