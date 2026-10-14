-- Reversión de P2 (tours por persona y por módulo). El código del tour viejo se restaura desde git.
COMMENT ON COLUMN public.organizations.onboarding_completado IS NULL;
DROP TABLE IF EXISTS public.onboarding_estado;
