-- Tabla 14/14 Cerebro Institucional: features por organización
CREATE TABLE public.organization_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  activado_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, feature_key)
);

CREATE INDEX idx_organization_features_org ON public.organization_features(org_id, feature_key);

GRANT SELECT ON public.organization_features TO authenticated;
GRANT ALL ON public.organization_features TO service_role;

ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_features_select_org"
ON public.organization_features FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "organization_features_all_super_admin"
ON public.organization_features FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE TRIGGER organization_features_updated_at
BEFORE UPDATE ON public.organization_features
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();