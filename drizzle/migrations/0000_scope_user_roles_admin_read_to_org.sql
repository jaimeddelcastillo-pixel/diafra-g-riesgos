DROP POLICY IF EXISTS "Admin read user_roles" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.same_org_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members m1
    JOIN public.org_members m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = _user_id
  )
$$;

CREATE POLICY "Read own or same-org roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin()
  OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.same_org_member(user_id))
);