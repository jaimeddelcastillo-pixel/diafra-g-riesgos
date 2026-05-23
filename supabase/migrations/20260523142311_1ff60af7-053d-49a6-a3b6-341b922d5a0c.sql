ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completado_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completado_por UUID NULL,
  ADD COLUMN IF NOT EXISTS onboarding_saltado BOOLEAN NOT NULL DEFAULT false;

-- Organizaciones existentes: marcarlas como completadas para no mostrar onboarding retroactivamente
UPDATE public.organizations
   SET onboarding_completado = true,
       onboarding_completado_at = COALESCE(onboarding_completado_at, NOW())
 WHERE onboarding_completado = false
   AND created_at < NOW();