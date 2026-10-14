CREATE TABLE public.onboarding_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clave text NOT NULL CHECK (clave IN ('plataforma','empresa','modulo:riesgos','modulo:cerebro','modulo:capacitacion','configuracion_empresa')),
  completado_en timestamptz NOT NULL DEFAULT now(),
  saltado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_estado_unico UNIQUE NULLS NOT DISTINCT (user_id, org_id, clave),
  CONSTRAINT onboarding_estado_org_coherente CHECK ((clave = 'plataforma') = (org_id IS NULL))
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_estado TO authenticated;
GRANT ALL ON public.onboarding_estado TO service_role;
ALTER TABLE public.onboarding_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Persona lee sus tours" ON public.onboarding_estado FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Persona registra sus tours" ON public.onboarding_estado FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND clave <> 'configuracion_empresa' AND (org_id IS NULL OR EXISTS (
    SELECT 1 FROM public.org_members m WHERE m.org_id = onboarding_estado.org_id AND m.user_id = auth.uid())));
CREATE POLICY "Persona actualiza sus tours" ON public.onboarding_estado FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND clave <> 'configuracion_empresa' AND (org_id IS NULL OR EXISTS (
    SELECT 1 FROM public.org_members m WHERE m.org_id = onboarding_estado.org_id AND m.user_id = auth.uid())));

-- Usuarios actuales: solo empresas con el tour viejo completado.
INSERT INTO public.onboarding_estado (user_id, org_id, clave)
SELECT DISTINCT m.user_id, NULL::uuid, 'plataforma' FROM public.org_members m
  JOIN public.organizations o ON o.id = m.org_id WHERE o.onboarding_completado = true
ON CONFLICT ON CONSTRAINT onboarding_estado_unico DO NOTHING;
INSERT INTO public.onboarding_estado (user_id, org_id, clave)
SELECT m.user_id, m.org_id, k.clave FROM public.org_members m
  JOIN public.organizations o ON o.id = m.org_id
  CROSS JOIN (VALUES ('empresa'), ('modulo:riesgos')) AS k(clave)
  WHERE o.onboarding_completado = true
ON CONFLICT ON CONSTRAINT onboarding_estado_unico DO NOTHING;

COMMENT ON COLUMN public.organizations.onboarding_completado IS 'DEPRECATED: el tour ya no se dispara con esta columna (P2); se conserva como dato histórico.';