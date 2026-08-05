CREATE OR REPLACE FUNCTION public.next_folio_code(p_tipo text, p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_org_id      UUID;
  v_tipo        TEXT;
  v_prefijo     TEXT;
  v_formato     TEXT;
  v_digitos     INTEGER;
  v_year        INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_periodo     TEXT;
  v_periodo_key TEXT;
  v_num         INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    -- Contexto de servicio (edge functions): se confía en el org_id recibido
    v_org_id := p_org_id;
  ELSE
    v_org_id := public.get_user_org_id();
    IF p_org_id IS NOT NULL AND p_org_id <> v_org_id AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'No autorizado para generar folios de otra organización';
    END IF;
    IF public.is_super_admin() AND p_org_id IS NOT NULL THEN
      v_org_id := p_org_id;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización asignada — no puede crear folios';
  END IF;

  v_tipo := UPPER(TRIM(COALESCE(p_tipo, '')));
  IF v_tipo = '' THEN
    RAISE EXCEPTION 'Tipo de folio requerido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_folio_tipos t
    WHERE t.org_id = v_org_id AND t.codigo = v_tipo AND t.activo = true
  ) THEN
    RAISE EXCEPTION 'Tipo de folio inválido o inactivo para esta organización: %', v_tipo;
  END IF;

  SELECT COALESCE(folio_prefijo, 'GR'),
         COALESCE(folio_formato_periodo, 'anio_completo'),
         COALESCE(folio_digitos_consecutivo, 3)
    INTO v_prefijo, v_formato, v_digitos
  FROM public.organizations WHERE id = v_org_id;

  v_periodo := CASE v_formato
    WHEN 'anio_completo' THEN v_year::TEXT
    WHEN 'anio_corto'    THEN RIGHT(v_year::TEXT, 2)
    WHEN 'trimestre'     THEN 'Q' || EXTRACT(QUARTER FROM CURRENT_DATE)::INT || '-' || RIGHT(v_year::TEXT, 2)
    ELSE NULL
  END;

  v_periodo_key := COALESCE(v_periodo, 'ALL');

  LOOP
    UPDATE public.folio_sequence
       SET last_number = last_number + 1
     WHERE org_id = v_org_id AND tipo = v_tipo AND periodo_key = v_periodo_key
     RETURNING last_number INTO v_num;
    EXIT WHEN FOUND;

    BEGIN
      INSERT INTO public.folio_sequence (org_id, year, tipo, periodo_key, last_number)
      VALUES (v_org_id, v_year, v_tipo, v_periodo_key, 1)
      RETURNING last_number INTO v_num;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- otro proceso insertó primero; reintentar el UPDATE
    END;
  END LOOP;

  RETURN v_prefijo || '-' || v_tipo || '-'
         || CASE WHEN v_periodo IS NULL THEN '' ELSE v_periodo || '-' END
         || LPAD(v_num::TEXT, v_digitos, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_folio_code(p_tipo text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.next_folio_code(p_tipo, NULL::uuid);
$$;