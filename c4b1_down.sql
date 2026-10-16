-- Rollback C4b.1
UPDATE public.ia_config_org SET composicion_riesgos = 'monolitica' WHERE composicion_riesgos = 'bloques_borrador';
DROP FUNCTION IF EXISTS public.mi_ia_en_prueba();
DROP TRIGGER IF EXISTS ia_config_org_borrador_guard ON public.ia_config_org;
DROP FUNCTION IF EXISTS public.ia_config_org_borrador_guard();
ALTER TABLE public.ia_config_org DROP CONSTRAINT ia_config_org_composicion_riesgos_check;
ALTER TABLE public.ia_config_org ADD CONSTRAINT ia_config_org_composicion_riesgos_check CHECK (composicion_riesgos = ANY (ARRAY['monolitica','bloques']));
