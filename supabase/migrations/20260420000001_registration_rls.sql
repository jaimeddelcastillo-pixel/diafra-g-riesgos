-- Permite que usuarios autenticados puedan crear su organización durante el registro.
-- Aplica cuando autoconfirm está ON (signUp devuelve sesión inmediatamente).
-- La Edge Function register-org cubre el caso sin sesión (email confirmation requerido).

-- organizations: un usuario sin org puede insertar la suya
CREATE POLICY "self_registration_org_insert"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Solo si el usuario aún no pertenece a ninguna org
    NOT EXISTS (
      SELECT 1 FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- org_members: un usuario puede agregarse a sí mismo como admin de una org
-- (solo si aún no tiene membresía en ninguna otra org)
CREATE POLICY "self_registration_org_members_insert"
  ON public.org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.org_members WHERE user_id = auth.uid()
    )
  );
