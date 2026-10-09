CREATE TABLE public.plan_limites (
  plan text NOT NULL REFERENCES public.planes(clave) ON UPDATE CASCADE,
  clave text NOT NULL,
  valor jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, clave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_limites TO authenticated;
GRANT ALL ON public.plan_limites TO service_role;
ALTER TABLE public.plan_limites ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_limites_select ON public.plan_limites FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_limites_sa_insert ON public.plan_limites FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY plan_limites_sa_update ON public.plan_limites FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY plan_limites_sa_delete ON public.plan_limites FOR DELETE TO authenticated USING (public.is_super_admin());

-- Límite del plan de una empresa; NULL = sin límite.
CREATE OR REPLACE FUNCTION public.plan_limite(p_org uuid, p_clave text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.valor FROM public.organizations o
  JOIN public.plan_limites l ON l.plan = o.plan AND l.clave = p_clave
  WHERE o.id = p_org
$$;
REVOKE EXECUTE ON FUNCTION public.plan_limite(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_limite(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.mi_plan_limite(p_clave text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.plan_limite(public.get_user_org_id(), p_clave)
$$;
REVOKE EXECUTE ON FUNCTION public.mi_plan_limite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_plan_limite(text) TO authenticated, service_role;