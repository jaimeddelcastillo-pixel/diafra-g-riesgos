CREATE OR REPLACE FUNCTION public.crear_sesion_entrevista(p_assignment_id uuid DEFAULT NULL::uuid, p_entrevistado_profile_id uuid DEFAULT NULL::uuid, p_entrevistado_nombre text DEFAULT NULL::text, p_entrevistado_puesto text DEFAULT NULL::text, p_entrevistado_area text DEFAULT NULL::text, p_capa text DEFAULT NULL::text, p_nivel_autoridad text DEFAULT NULL::text, p_proceso_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_super boolean;
  v_count int;
  v_max jsonb;
  v_session uuid;
  v_proc uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no_auth' USING ERRCODE = '28000';
  END IF;

  v_org := public.get_user_org_id();
  v_super := public.is_super_admin();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'sin_organizacion' USING ERRCODE = '42501';
  END IF;

  IF NOT (v_super OR public.org_tiene_modulo(v_org, 'institutional_brain')) THEN
    RAISE EXCEPTION 'feature_inactiva' USING ERRCODE = '42501';
  END IF;

  v_max := public.plan_limite(v_org, 'entrevistas_max');
  IF v_max IS NOT NULL AND jsonb_typeof(v_max) = 'number' AND NOT v_super THEN
    SELECT count(*) INTO v_count
      FROM public.brain_interview_sessions
     WHERE org_id = v_org AND estado <> 'cancelada';
    IF v_count >= (v_max #>> '{}')::int THEN
      RAISE EXCEPTION 'trial_limit' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.brain_interview_assignments WHERE id = p_assignment_id AND org_id = v_org
  ) THEN
    RAISE EXCEPTION 'assignment_fuera_de_org' USING ERRCODE = '42501';
  END IF;

  IF p_entrevistado_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_members WHERE user_id = p_entrevistado_profile_id AND org_id = v_org
  ) THEN
    RAISE EXCEPTION 'entrevistado_fuera_de_org' USING ERRCODE = '42501';
  END IF;

  IF p_proceso_ids IS NOT NULL AND array_length(p_proceso_ids, 1) > 0 THEN
    FOREACH v_proc IN ARRAY p_proceso_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.brain_processes WHERE id = v_proc AND org_id = v_org) THEN
        RAISE EXCEPTION 'proceso_fuera_de_org' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.brain_interview_sessions (
    org_id, assignment_id, estado, entrevistado_profile_id, entrevistado_nombre,
    entrevistado_puesto, entrevistado_area, capa, nivel_autoridad, created_by
  ) VALUES (
    v_org, p_assignment_id, 'pendiente', p_entrevistado_profile_id, nullif(btrim(coalesce(p_entrevistado_nombre, '')), ''),
    nullif(btrim(coalesce(p_entrevistado_puesto, '')), ''), nullif(btrim(coalesce(p_entrevistado_area, '')), ''),
    nullif(btrim(coalesce(p_capa, '')), ''), nullif(btrim(coalesce(p_nivel_autoridad, '')), ''), v_user
  ) RETURNING id INTO v_session;

  IF p_proceso_ids IS NOT NULL AND array_length(p_proceso_ids, 1) > 0 THEN
    INSERT INTO public.brain_session_processes (org_id, session_id, process_id)
    SELECT v_org, v_session, DISTINCT_ID FROM (SELECT DISTINCT unnest(p_proceso_ids) AS DISTINCT_ID) s;
  END IF;

  RETURN jsonb_build_object('session_id', v_session, 'org_id', v_org, 'estado', 'pendiente');
END;
$function$;