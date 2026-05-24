-- 1) Migrar super_admins de org_members a user_roles (por si existieran) y limpiar
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role
FROM public.org_members
WHERE role = 'super_admin'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.org_members WHERE role = 'super_admin';

-- 2) Constraint duro: nunca super_admin en org_members
ALTER TABLE public.org_members
  DROP CONSTRAINT IF EXISTS no_super_admin_in_org_members;
ALTER TABLE public.org_members
  ADD CONSTRAINT no_super_admin_in_org_members
  CHECK (role <> 'super_admin');

-- 3) is_super_admin() solo lee de user_roles
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

-- 4) Endurecer self-registration policy
DROP POLICY IF EXISTS "self_registration_org_members_insert" ON public.org_members;
CREATE POLICY "self_registration_org_members_insert"
ON public.org_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'operador'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.org_members om WHERE om.user_id = auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.org_members om2 WHERE om2.org_id = org_members.org_id)
);