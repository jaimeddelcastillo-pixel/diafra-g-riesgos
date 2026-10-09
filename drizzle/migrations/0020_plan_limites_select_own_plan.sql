DROP POLICY IF EXISTS plan_limites_select ON public.plan_limites;
CREATE POLICY plan_limites_select ON public.plan_limites FOR SELECT TO authenticated
USING (public.is_super_admin() OR plan = (SELECT o.plan FROM public.organizations o WHERE o.id = public.get_user_org_id()));