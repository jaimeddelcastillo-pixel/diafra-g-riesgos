-- C1 Parte A: catálogo de módulos y función única de acceso.
CREATE TABLE IF NOT EXISTS public.modulos (
  clave text PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.planes (
  clave text PRIMARY KEY,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.plan_modulos (
  plan text NOT NULL REFERENCES public.planes(clave) ON DELETE CASCADE,
  modulo text NOT NULL REFERENCES public.modulos(clave) ON DELETE CASCADE,
  PRIMARY KEY (plan, modulo)
);
CREATE TABLE IF NOT EXISTS public.precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan text NOT NULL REFERENCES public.planes(clave),
  modulo text REFERENCES public.modulos(clave),
  moneda text NOT NULL DEFAULT 'MXN',
  monto numeric(12,2) NOT NULL,
  periodo text NOT NULL,
  vigente_desde date NOT NULL DEFAULT current_date,
  vigente_hasta date
);

GRANT SELECT ON public.modulos, public.planes, public.plan_modulos, public.precios TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.modulos, public.planes, public.plan_modulos, public.precios TO authenticated;
GRANT ALL ON public.modulos, public.planes, public.plan_modulos, public.precios TO service_role;

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY modulos_select ON public.modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY modulos_write_sa ON public.modulos FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY planes_select ON public.planes FOR SELECT TO authenticated USING (true);
CREATE POLICY planes_write_sa ON public.planes FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY plan_modulos_select ON public.plan_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_modulos_write_sa ON public.plan_modulos FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY precios_select ON public.precios FOR SELECT TO authenticated USING (true);
CREATE POLICY precios_write_sa ON public.precios FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.modulos (clave, nombre, descripcion) VALUES
  ('riesgos', 'Gestión de Riesgos', 'Folios y matriz de riesgos'),
  ('institutional_brain', 'Cerebro Institucional', 'Captura y gobierno del conocimiento institucional')
ON CONFLICT (clave) DO NOTHING;
INSERT INTO public.planes (clave, nombre) VALUES
  ('trial', 'Prueba'), ('trial-demo', 'Prueba demo'), ('starter', 'Starter'),
  ('professional', 'Professional'), ('enterprise', 'Enterprise')
ON CONFLICT (clave) DO NOTHING;
INSERT INTO public.plan_modulos (plan, modulo) VALUES
  ('professional', 'institutional_brain'), ('enterprise', 'institutional_brain'),
  ('trial', 'riesgos'), ('trial-demo', 'riesgos'), ('starter', 'riesgos'),
  ('professional', 'riesgos'), ('enterprise', 'riesgos')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.org_tiene_modulo(_org uuid, _modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.plan_modulos pm ON pm.plan = o.plan AND pm.modulo = _modulo
    WHERE o.id = _org
  ) OR EXISTS (
    SELECT 1 FROM public.organization_features f
    WHERE f.org_id = _org AND f.feature_key = _modulo AND f.activo = true
      AND (f.expira_en IS NULL OR f.expira_en > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.mi_org_tiene_modulo(_modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR public.org_tiene_modulo(public.get_user_org_id(), _modulo)
$$;

REVOKE EXECUTE ON FUNCTION public.org_tiene_modulo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_tiene_modulo(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.mi_org_tiene_modulo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_org_tiene_modulo(text) TO authenticated, service_role;