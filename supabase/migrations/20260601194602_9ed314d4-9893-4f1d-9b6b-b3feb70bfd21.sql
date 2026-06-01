-- ── CAMBIO 1: Codificación de folios por tipo (GR-[TIPO]-AAAA-NNN) ──

-- 1. folio_sequence: agregar columna tipo y nueva PK compuesta
ALTER TABLE public.folio_sequence
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'SGC';

-- Recalcular PK / unique: (org_id, year, tipo)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.folio_sequence'::regclass
      AND contype = 'p'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.folio_sequence DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'public.folio_sequence'::regclass AND contype = 'p'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.folio_sequence
  ADD CONSTRAINT folio_sequence_pkey PRIMARY KEY (org_id, year, tipo);

-- 2. folios: agregar tipo_folio (NULL = histórico)
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS tipo_folio TEXT NULL;

COMMENT ON COLUMN public.folios.tipo_folio IS
  'Tipo de análisis: SGC, FAB, SIS, CAL, PRD, PMS, FV. NULL para folios históricos (formato GR-AAAA-NNN).';

-- 3. Nueva función next_folio_code(p_tipo TEXT)
CREATE OR REPLACE FUNCTION public.next_folio_code(p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id     UUID    := public.get_user_org_id();
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  next_num     INTEGER;
  v_tipo       TEXT;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización asignada — no puede crear folios';
  END IF;

  v_tipo := UPPER(TRIM(COALESCE(p_tipo, '')));
  IF v_tipo NOT IN ('SGC','FAB','SIS','CAL','PRD','PMS','FV') THEN
    RAISE EXCEPTION 'Tipo de folio inválido: %. Permitidos: SGC, FAB, SIS, CAL, PRD, PMS, FV', p_tipo;
  END IF;

  INSERT INTO public.folio_sequence (org_id, year, tipo, last_number)
  VALUES (v_org_id, current_year, v_tipo, 1)
  ON CONFLICT (org_id, year, tipo) DO UPDATE
    SET last_number = folio_sequence.last_number + 1
  RETURNING last_number INTO next_num;

  RETURN 'GR-' || v_tipo || '-' || current_year || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$function$;

-- 4. Versión sin argumento: falla con mensaje claro para detectar usos viejos
CREATE OR REPLACE FUNCTION public.next_folio_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'next_folio_code() ahora requiere parámetro p_tipo (SGC, FAB, SIS, CAL, PRD, PMS o FV). Actualiza la llamada a next_folio_code(p_tipo).';
END;
$function$;