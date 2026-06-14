CREATE OR REPLACE FUNCTION public.reciclar_folio_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT;
  v_year INTEGER;
  v_num  INTEGER;
  v_last INTEGER;
BEGIN
  -- Parsear código GR-TIPO-YYYY-NNN
  IF OLD.codigo IS NULL OR OLD.org_id IS NULL THEN
    RETURN OLD;
  END IF;

  BEGIN
    v_tipo := SPLIT_PART(OLD.codigo, '-', 2);
    v_year := SPLIT_PART(OLD.codigo, '-', 3)::INTEGER;
    v_num  := SPLIT_PART(OLD.codigo, '-', 4)::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RETURN OLD;
  END;

  -- Solo reciclar si era el último número emitido
  SELECT last_number INTO v_last
    FROM public.folio_sequence
   WHERE org_id = OLD.org_id
     AND year = v_year
     AND tipo = v_tipo;

  IF v_last IS NOT NULL AND v_num = v_last THEN
    UPDATE public.folio_sequence
       SET last_number = GREATEST(last_number - 1, 0)
     WHERE org_id = OLD.org_id
       AND year = v_year
       AND tipo = v_tipo;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reciclar_folio_sequence ON public.folios;
CREATE TRIGGER trg_reciclar_folio_sequence
AFTER DELETE ON public.folios
FOR EACH ROW
EXECUTE FUNCTION public.reciclar_folio_sequence();