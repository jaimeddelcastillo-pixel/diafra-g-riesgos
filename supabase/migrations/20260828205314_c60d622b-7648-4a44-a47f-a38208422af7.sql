CREATE UNIQUE INDEX IF NOT EXISTS riesgos_folio_numero_uidx ON public.riesgos (folio_id, numero_id);

CREATE OR REPLACE FUNCTION public.reordenar_riesgos(p_folio_id uuid, p_orden uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_estado text;
  v_total int;
  v_anterior jsonb;
  v_nuevo jsonb;
BEGIN
  SELECT f.org_id, f.estado::text INTO v_org, v_estado
  FROM public.folios f WHERE f.id = p_folio_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Folio no encontrado';
  END IF;

  IF NOT (v_org = public.get_user_org_id() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre este folio';
  END IF;

  IF v_estado <> 'Borrador' THEN
    RAISE EXCEPTION 'Solo se pueden reordenar los Id de folios en Borrador';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_folio_id::text, 0));

  SELECT count(*) INTO v_total FROM public.riesgos WHERE folio_id = p_folio_id;

  IF v_total <> array_length(p_orden, 1)
     OR EXISTS (SELECT 1 FROM public.riesgos WHERE folio_id = p_folio_id AND id <> ALL(p_orden))
     OR EXISTS (SELECT 1 FROM unnest(p_orden) AS x(id)
                WHERE NOT EXISTS (SELECT 1 FROM public.riesgos r WHERE r.id = x.id AND r.folio_id = p_folio_id))
     OR (SELECT count(DISTINCT x.id) FROM unnest(p_orden) AS x(id)) <> array_length(p_orden, 1) THEN
    RAISE EXCEPTION 'El orden enviado no coincide con los riesgos del folio';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('id', r.id, 'numero_id', r.numero_id) ORDER BY r.numero_id)
    INTO v_anterior
  FROM public.riesgos r WHERE r.folio_id = p_folio_id;

  UPDATE public.riesgos SET numero_id = -numero_id WHERE folio_id = p_folio_id;

  UPDATE public.riesgos r
     SET numero_id = o.pos, updated_at = now()
  FROM (SELECT id, ordinality::int AS pos FROM unnest(p_orden) WITH ORDINALITY AS t(id, ordinality)) o
  WHERE r.id = o.id AND r.folio_id = p_folio_id;

  SELECT jsonb_agg(jsonb_build_object('id', r.id, 'numero_id', r.numero_id) ORDER BY r.numero_id)
    INTO v_nuevo
  FROM public.riesgos r WHERE r.folio_id = p_folio_id;

  INSERT INTO public.audit_trail (user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, org_id)
  VALUES (auth.uid(), 'riesgos', p_folio_id::text, 'REORDENAR_IDS', v_anterior, v_nuevo, v_org);

  RETURN jsonb_build_object('ok', true, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.reordenar_riesgos(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reordenar_riesgos(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.recompactar_riesgos(p_folio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_estado text;
  v_anterior jsonb;
  v_nuevo jsonb;
BEGIN
  SELECT f.org_id, f.estado::text INTO v_org, v_estado
  FROM public.folios f WHERE f.id = p_folio_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Folio no encontrado';
  END IF;

  IF NOT (v_org = public.get_user_org_id() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre este folio';
  END IF;

  IF v_estado <> 'Borrador' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'folio_no_borrador');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_folio_id::text, 0));

  SELECT jsonb_agg(jsonb_build_object('id', r.id, 'numero_id', r.numero_id) ORDER BY r.numero_id)
    INTO v_anterior
  FROM public.riesgos r WHERE r.folio_id = p_folio_id;

  IF v_anterior IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'total', 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT numero_id, row_number() OVER (ORDER BY numero_id) AS pos
      FROM public.riesgos WHERE folio_id = p_folio_id
    ) t WHERE t.numero_id <> t.pos
  ) THEN
    RETURN jsonb_build_object('ok', true, 'sin_cambios', true);
  END IF;

  UPDATE public.riesgos SET numero_id = -numero_id WHERE folio_id = p_folio_id;

  UPDATE public.riesgos r
     SET numero_id = t.pos, updated_at = now()
  FROM (
    SELECT id, row_number() OVER (ORDER BY numero_id DESC) AS pos
    FROM public.riesgos WHERE folio_id = p_folio_id
  ) t
  WHERE r.id = t.id;

  SELECT jsonb_agg(jsonb_build_object('id', r.id, 'numero_id', r.numero_id) ORDER BY r.numero_id)
    INTO v_nuevo
  FROM public.riesgos r WHERE r.folio_id = p_folio_id;

  INSERT INTO public.audit_trail (user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, org_id)
  VALUES (auth.uid(), 'riesgos', p_folio_id::text, 'RECOMPACTAR_IDS', v_anterior, v_nuevo, v_org);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.recompactar_riesgos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompactar_riesgos(uuid) TO authenticated;