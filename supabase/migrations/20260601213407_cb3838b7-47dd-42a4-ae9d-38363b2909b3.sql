CREATE OR REPLACE FUNCTION public.set_riesgo_numero_local()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.folio_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.folio_id::text, 0));

  SELECT COALESCE(MAX(numero_id), 0) + 1
    INTO NEW.numero_id
    FROM public.riesgos
   WHERE folio_id = NEW.folio_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_riesgo_numero_local ON public.riesgos;

CREATE TRIGGER trg_set_riesgo_numero_local
BEFORE INSERT ON public.riesgos
FOR EACH ROW
EXECUTE FUNCTION public.set_riesgo_numero_local();