
-- 1) Renombrar tabla actual como histórico (solo por compatibilidad), y crear nueva con (org_id, year)
ALTER TABLE public.diploma_sequence ADD COLUMN IF NOT EXISTS org_id uuid;

-- Nueva PK compuesta. Si ya hay rows con org_id NULL, las dejamos como histórico TRACEA.
ALTER TABLE public.diploma_sequence DROP CONSTRAINT IF EXISTS diploma_sequence_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS diploma_sequence_org_year_uidx
  ON public.diploma_sequence (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), year);

-- 2) Reemplazar next_diploma_folio para recibir p_org_id y devolver DIP-YYYY-SLUG-NNN
DROP FUNCTION IF EXISTS public.next_diploma_folio();
CREATE OR REPLACE FUNCTION public.next_diploma_folio(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_num  INTEGER;
  v_slug TEXT;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id es requerido para emitir folio de diploma';
  END IF;

  SELECT UPPER(REGEXP_REPLACE(slug, '[^a-zA-Z0-9]', '', 'g'))
    INTO v_slug
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_slug IS NULL OR length(v_slug) = 0 THEN
    RAISE EXCEPTION 'Organización no encontrada o sin slug válido: %', p_org_id;
  END IF;

  -- Upsert manual sobre el índice único (COALESCE org_id)
  LOOP
    UPDATE public.diploma_sequence
       SET last_number = last_number + 1
     WHERE org_id = p_org_id AND year = v_year
     RETURNING last_number INTO v_num;
    EXIT WHEN FOUND;

    BEGIN
      INSERT INTO public.diploma_sequence (org_id, year, last_number)
      VALUES (p_org_id, v_year, 1)
      RETURNING last_number INTO v_num;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- otro proceso insertó primero; reintentar el UPDATE
    END;
  END LOOP;

  RETURN 'DIP-' || v_year || '-' || v_slug || '-' || LPAD(v_num::TEXT, 3, '0');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.next_diploma_folio(uuid) TO authenticated, service_role;
