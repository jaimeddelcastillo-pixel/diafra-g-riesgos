
-- RPC: validar cuántas preguntas activas hay por bloque (sin exponer contenido)
CREATE OR REPLACE FUNCTION public.examen_validar_banco(p_curso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT jsonb_object_agg(bloque, n)
    INTO v_counts
  FROM (
    SELECT bloque, COUNT(*)::int AS n
    FROM public.curso_evaluacion_preguntas
    WHERE curso_id = p_curso_id AND activo = true
    GROUP BY bloque
  ) t;

  RETURN COALESCE(v_counts, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.examen_validar_banco(uuid) TO authenticated;

-- RPC: iniciar examen — selecciona 5 preguntas aleatorias por bloque, crea el intento y devuelve preguntas SIN respuesta correcta ni justificación
CREATE OR REPLACE FUNCTION public.examen_iniciar(p_curso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_num int;
  v_intentos_aprob int;
  v_ids uuid[];
  v_intento_id uuid;
  v_preguntas jsonb;
  v_bloque text;
  v_ids_bloque uuid[];
  v_min_banco int := 7;
  v_por_bloque int := 5;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT org_id INTO v_org FROM public.org_members WHERE user_id = v_user LIMIT 1;

  -- Límite de intentos: máx 3, y bloquear si ya aprobó
  SELECT COUNT(*) INTO v_num FROM public.curso_examen_intentos
    WHERE curso_id = p_curso_id AND user_id = v_user;
  SELECT COUNT(*) INTO v_intentos_aprob FROM public.curso_examen_intentos
    WHERE curso_id = p_curso_id AND user_id = v_user AND aprobado = true;
  IF v_intentos_aprob > 0 THEN
    RAISE EXCEPTION 'Ya aprobaste este examen';
  END IF;
  IF v_num >= 3 THEN
    RAISE EXCEPTION 'Sin intentos disponibles';
  END IF;

  -- Seleccionar 5 aleatorias por cada bloque requerido
  v_ids := ARRAY[]::uuid[];
  FOREACH v_bloque IN ARRAY ARRAY['marco_regulatorio','metodologia','casos_practicos','flujo_aprobacion']
  LOOP
    SELECT array_agg(id) INTO v_ids_bloque FROM (
      SELECT id FROM public.curso_evaluacion_preguntas
      WHERE curso_id = p_curso_id AND activo = true AND bloque = v_bloque
      ORDER BY random()
      LIMIT v_por_bloque
    ) s;

    IF v_ids_bloque IS NULL OR array_length(v_ids_bloque,1) < v_por_bloque THEN
      RAISE EXCEPTION 'Banco insuficiente en bloque %', v_bloque;
    END IF;
    v_ids := v_ids || v_ids_bloque;
  END LOOP;

  -- Crear intento
  INSERT INTO public.curso_examen_intentos (user_id, org_id, curso_id, num_intento, preguntas_ids, total, tiempo_limite_seg)
  VALUES (v_user, v_org, p_curso_id, v_num + 1, v_ids, 20, 2700)
  RETURNING id INTO v_intento_id;

  -- Devolver preguntas en el orden de v_ids, sin respuesta correcta/justificación
  SELECT jsonb_agg(row_to_json(p)) INTO v_preguntas FROM (
    SELECT q.id, q.bloque, q.pregunta, q.opcion_a, q.opcion_b, q.opcion_c, q.opcion_d
    FROM unnest(v_ids) WITH ORDINALITY AS u(id, ord)
    JOIN public.curso_evaluacion_preguntas q ON q.id = u.id
    ORDER BY u.ord
  ) p;

  RETURN jsonb_build_object(
    'intento_id', v_intento_id,
    'num_intento', v_num + 1,
    'preguntas', v_preguntas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.examen_iniciar(uuid) TO authenticated;

-- RPC: calificar — recibe { pregunta_id: 'A'|'B'|'C'|'D' }, califica server-side y devuelve resultado completo con justificaciones
CREATE OR REPLACE FUNCTION public.examen_calificar(
  p_intento_id uuid,
  p_respuestas jsonb,
  p_duracion_seg int DEFAULT NULL,
  p_tab_blur_count int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_intento public.curso_examen_intentos%ROWTYPE;
  v_correctas int := 0;
  v_total int := 0;
  v_calif numeric(5,2);
  v_aprobado boolean;
  v_resumen jsonb := '{}'::jsonb;
  v_detalles jsonb := '[]'::jsonb;
  v_bloque_acc jsonb := '{}'::jsonb;
  v_b text;
  v_rec record;
  v_resp text;
  v_ok boolean;
  v_b_cor int;
  v_b_tot int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_intento FROM public.curso_examen_intentos WHERE id = p_intento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intento no encontrado'; END IF;
  IF v_intento.user_id <> v_user THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF v_intento.finished_at IS NOT NULL THEN RAISE EXCEPTION 'Intento ya cerrado'; END IF;

  FOR v_rec IN
    SELECT q.id, q.bloque, q.respuesta_correcta, q.justificacion,
           q.opcion_a, q.opcion_b, q.opcion_c, q.opcion_d, q.pregunta
    FROM unnest(v_intento.preguntas_ids) WITH ORDINALITY AS u(id, ord)
    JOIN public.curso_evaluacion_preguntas q ON q.id = u.id
    ORDER BY u.ord
  LOOP
    v_total := v_total + 1;
    v_resp := p_respuestas ->> v_rec.id::text;
    v_ok := (v_resp IS NOT NULL AND upper(v_resp) = upper(v_rec.respuesta_correcta));
    IF v_ok THEN v_correctas := v_correctas + 1; END IF;

    -- acumular por bloque
    v_b_cor := COALESCE((v_bloque_acc -> v_rec.bloque ->> 'correctas')::int, 0);
    v_b_tot := COALESCE((v_bloque_acc -> v_rec.bloque ->> 'total')::int, 0);
    v_bloque_acc := jsonb_set(
      v_bloque_acc,
      ARRAY[v_rec.bloque],
      jsonb_build_object('correctas', v_b_cor + (CASE WHEN v_ok THEN 1 ELSE 0 END), 'total', v_b_tot + 1),
      true
    );

    v_detalles := v_detalles || jsonb_build_object(
      'id', v_rec.id,
      'bloque', v_rec.bloque,
      'pregunta', v_rec.pregunta,
      'opcion_a', v_rec.opcion_a,
      'opcion_b', v_rec.opcion_b,
      'opcion_c', v_rec.opcion_c,
      'opcion_d', v_rec.opcion_d,
      'respuesta_correcta', v_rec.respuesta_correcta,
      'justificacion', v_rec.justificacion,
      'respuesta_usuario', v_resp,
      'correcta', v_ok
    );
  END LOOP;

  v_calif := CASE WHEN v_total > 0 THEN (v_correctas::numeric / v_total::numeric) * 100 ELSE 0 END;
  v_aprobado := v_calif >= 80;

  UPDATE public.curso_examen_intentos SET
    respuestas = p_respuestas,
    correctas = v_correctas,
    calificacion = v_calif,
    bloque_resumen = v_bloque_acc,
    aprobado = v_aprobado,
    finished_at = now(),
    duracion_seg = p_duracion_seg,
    tab_blur_count = p_tab_blur_count
  WHERE id = p_intento_id;

  RETURN jsonb_build_object(
    'intento_id', p_intento_id,
    'correctas', v_correctas,
    'total', v_total,
    'calificacion', v_calif,
    'aprobado', v_aprobado,
    'bloque_resumen', v_bloque_acc,
    'detalles', v_detalles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.examen_calificar(uuid, jsonb, int, int) TO authenticated;
