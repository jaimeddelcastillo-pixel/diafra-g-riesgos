
-- Fix cross-org profile access: restrict admin/RS SELECT/UPDATE to same org

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;

-- SELECT: own profile (the "Org members read same org profiles" policy already
-- covers admins/RS via org_members join, and super_admin).
CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- UPDATE: users can update their own profile; admins/RS can only update
-- profiles of users in their own org; super_admin can update any.
CREATE POLICY "Admins update same-org profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    id = auth.uid()
    OR is_super_admin()
    OR (
      (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'responsable_sanitario'::app_role))
      AND EXISTS (
        SELECT 1
        FROM public.org_members om_self
        JOIN public.org_members om_target ON om_target.org_id = om_self.org_id
        WHERE om_self.user_id = auth.uid()
          AND om_target.user_id = profiles.id
      )
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR is_super_admin()
    OR (
      (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'responsable_sanitario'::app_role))
      AND EXISTS (
        SELECT 1
        FROM public.org_members om_self
        JOIN public.org_members om_target ON om_target.org_id = om_self.org_id
        WHERE om_self.user_id = auth.uid()
          AND om_target.user_id = profiles.id
      )
    )
  );
