ALTER TABLE public.ia_config_org DROP CONSTRAINT ia_config_org_composicion_riesgos_check;
ALTER TABLE public.ia_config_org ADD CONSTRAINT ia_config_org_composicion_riesgos_check CHECK (composicion_riesgos = ANY (ARRAY['monolitica','bloques','bloques_borrador']));
CREATE OR REPLACE FUNCTION public.ia_config_org_borrador_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.composicion_riesgos = 'bloques_borrador' AND NOT COALESCE((SELECT es_prueba FROM organizations WHERE id = NEW.org_id), false) THEN
    RAISE EXCEPTION 'bloques_borrador solo se permite en empresas de prueba';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ia_config_org_borrador_guard ON public.ia_config_org;
CREATE TRIGGER ia_config_org_borrador_guard BEFORE INSERT OR UPDATE ON public.ia_config_org FOR EACH ROW EXECUTE FUNCTION public.ia_config_org_borrador_guard();