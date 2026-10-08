ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS es_prueba boolean NOT NULL DEFAULT false;
UPDATE public.organizations SET es_prueba = true WHERE id IN ('122c7511-fa40-4807-82a0-e1120c11ec73','3868f88a-fa36-4467-9b31-653143c6ef7d','7065a542-0782-4ff8-9bfa-e830d56605c6');
CREATE OR REPLACE FUNCTION public.proteger_es_prueba() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.es_prueba AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Solo super_admin puede marcar una empresa como de prueba';
    END IF;
  ELSIF NEW.es_prueba IS DISTINCT FROM OLD.es_prueba AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo super_admin puede cambiar es_prueba';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_proteger_es_prueba BEFORE INSERT OR UPDATE OF es_prueba ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.proteger_es_prueba();