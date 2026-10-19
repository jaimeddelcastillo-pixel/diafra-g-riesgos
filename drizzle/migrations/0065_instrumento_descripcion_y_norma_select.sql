ALTER TABLE public.tend_instrumentos ADD COLUMN IF NOT EXISTS descripcion_equipo text;
DROP POLICY IF EXISTS tend_norma_select ON public.tend_norma_especificaciones;
CREATE POLICY tend_norma_select ON public.tend_norma_especificaciones FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.mi_org_tiene_modulo('tendencias'));