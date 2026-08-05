CREATE OR REPLACE FUNCTION public.reeditar_codigos_folios(
  p_org_id uuid,
  p_cambios jsonb,
  p_motivo text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor      uuid := COALESCE(p_actor, auth.uid());
  v_motivo     text := btrim(COALESCE(p_motivo, ''));
  v_item       jsonb;
  v_folio_id   uuid;
  v_nuevo      text;
  v_folio      public.folios%ROWTYPE;
  v_n          integer := 0;
  v_codigos    text[] := ARRAY[]::text[];
  v_parts      text[];
  v_len        integer;
  v_periodo    text;
  v_consec     integer;
  v_afectados  jsonb := '[]'::jsonb;
  r            record;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_actor AND role = 'super_admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Se requiere rol super_admin';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organización requerida';
  END IF;

  IF length(v_motivo) < 10 THEN
    RAISE EXCEPTION 'El motivo de la corrección es obligatorio (mínimo 10 caracteres)';
  END IF;

  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' OR jsonb_array_length(p_cambios) = 0 THEN
    RAISE EXCEPTION 'No se recibieron cambios';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cambios)
  LOOP
    v_folio_id := NULLIF(v_item ->> 'folio_id', '')::uuid;
    v_nuevo    := UPPER(btrim(COALESCE(v_item ->> 'nuevo_codigo', '')));

    IF v_folio_id IS NULL THEN
      RAISE EXCEPTION 'folio_id inválido en la lista de cambios';
    END IF;

    IF v_nuevo = '' THEN
      RAISE EXCEPTION 'El nuevo código no puede estar vacío';
    END IF;

    IF v_nuevo !~ '^[A-Z0-9]+(-[A-Z0-9]+)+$' THEN
      RAISE EXCEPTION 'Código inválido: %. Usa el formato PREFIJO-GRUPO-PERIODO-CONSECUTIVO', v_nuevo;
    END IF;

    IF v_nuevo = ANY (v_codigos) THEN
      RAISE EXCEPTION 'Código duplicado dentro del lote: %', v_nuevo;
    END IF;
    v_codigos := v_codigos || v_nuevo;

    SELECT * INTO v_folio FROM public.folios WHERE id = v_folio_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Folio no encontrado: %', v_folio_id;
    END IF;

    IF v_folio.org_id <> p_org_id THEN
      RAISE EXCEPTION 'El folio % no pertenece a la organización seleccionada', v_folio.codigo;
    END IF;

    IF v_folio.estado <> 'Borrador'::public.estado_folio THEN
      RAISE EXCEPTION 'Solo se pueden corregir folios en Borrador. % está en %', v_folio.codigo, v_folio.estado;
    END IF;

    IF v_nuevo = v_folio.codigo THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.org_id = p_org_id AND f.codigo = v_nuevo AND f.id <> v_folio_id
    ) THEN
      RAISE EXCEPTION 'Ya existe un folio con el código % en esta organización', v_nuevo;
    END IF;

    v_parts := string_to_array(v_nuevo, '-');
    v_len := array_length(v_parts, 1);
    v_consec := NULLIF(regexp_replace(v_parts[v_len], '\D', '', 'g'), '')::integer;
    v_periodo := CASE WHEN v_len > 3 THEN array_to_string(v_parts[3:v_len-1], '-') ELSE NULL END;

    UPDATE public.folios
       SET codigo = v_nuevo,
           codigo_periodo = v_periodo,
           codigo_consecutivo = v_consec,
           updated_at = now()
     WHERE id = v_folio_id;

    INSERT INTO public.audit_trail
      (user_id, org_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES (
      v_actor, p_org_id, 'folios', v_folio_id::text, 'codigo_corregido_super_admin',
      jsonb_build_object('codigo', v_folio.codigo),
      jsonb_build_object('codigo', v_nuevo, 'motivo', v_motivo)
    );

    v_n := v_n + 1;
    v_afectados := v_afectados || jsonb_build_object(
      'folio_id', v_folio_id, 'anterior', v_folio.codigo, 'nuevo', v_nuevo
    );
  END LOOP;

  FOR r IN
    SELECT f.org_id AS o_id,
           split_part(f.codigo, '-', 2) AS tipo,
           COALESCE(f.codigo_periodo, 'ALL') AS periodo_key,
           MAX(f.codigo_consecutivo) AS max_num
      FROM public.folios f
     WHERE f.org_id = p_org_id
       AND f.codigo_consecutivo IS NOT NULL
     GROUP BY 1, 2, 3
  LOOP
    UPDATE public.folio_sequence s
       SET last_number = GREATEST(s.last_number, r.max_num)
     WHERE s.org_id = r.o_id AND s.tipo = r.tipo AND s.periodo_key = r.periodo_key;

    IF NOT FOUND THEN
      BEGIN
        INSERT INTO public.folio_sequence (org_id, year, tipo, periodo_key, last_number)
        VALUES (r.o_id, EXTRACT(YEAR FROM CURRENT_DATE)::int, r.tipo, r.periodo_key, r.max_num);
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.folio_sequence s
           SET last_number = GREATEST(s.last_number, r.max_num)
         WHERE s.org_id = r.o_id AND s.tipo = r.tipo AND s.periodo_key = r.periodo_key;
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('modificados', v_n, 'detalle', v_afectados);
END;
$function$;

REVOKE ALL ON FUNCTION public.reeditar_codigos_folios(uuid, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reeditar_codigos_folios(uuid, jsonb, text, uuid) TO service_role;