-- Rollback C2a.1 (0006_c2a1_es_prueba)
-- Nota: tras ejecutar, revertir también admin-login-as / Admin.tsx al criterio por nombre si se requiere.
DROP TRIGGER IF EXISTS trg_proteger_es_prueba ON public.organizations;
DROP FUNCTION IF EXISTS public.proteger_es_prueba();
ALTER TABLE public.organizations DROP COLUMN IF EXISTS es_prueba;
