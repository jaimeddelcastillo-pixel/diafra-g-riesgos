-- Super admin puede leer y modificar todas las organizaciones
-- (necesario para el panel de administración en /admin)
CREATE POLICY "super_admin gestiona orgs"
  ON public.organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
