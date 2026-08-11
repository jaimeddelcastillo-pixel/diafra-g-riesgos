ALTER TABLE public.brain_interview_sessions
  ADD COLUMN IF NOT EXISTS entrevistado_puesto text,
  ADD COLUMN IF NOT EXISTS entrevistado_area text,
  ADD COLUMN IF NOT EXISTS capa text,
  ADD COLUMN IF NOT EXISTS nivel_autoridad text;

CREATE OR REPLACE FUNCTION public.crear_sesion_entrevista(
  p_assignment_id uuid DEFAULT NULL,
  p_entrevistado_profile_id uuid DEFAULT NULL,
  p_entrevistado_nombre text DEFAULT NULL,
  p_entrevistado_puesto text DEFAULT NULL,
  p_entrevistado_area text DEFAULT NULL,
  p_capa text DEFAULT NULL,
  p_nivel_autoridad text DEFAULT NULL,
  p_proceso_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_plan text;
  v_super boolean;
  v_feat boolean;
  v_count int;
  v_session uuid;
  v_proc uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no_auth' USING ERRCODE = '28000';
  END IF;

  SELECT org_id INTO v_org FROM public.org_members WHERE user_id = v_user LIMIT 1;
  v_super := public.is_super_admin();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'sin_organizacion' USING ERRCODE = '42501';
  END IF;

  SELECT lower(coalesce(plan, '')) INTO v_plan FROM public.organizations WHERE id = v_org;

  SELECT coalesce(bool_or(activo AND (expira_en IS NULL OR expira_en > now())), false)
    INTO v_feat
    FROM public.organization_features
   WHERE org_id = v_org AND feature_key = 'institutional_brain';

  IF NOT (v_super OR v_feat OR v_plan IN ('professional', 'enterprise')) THEN
    RAISE EXCEPTION 'feature_inactiva' USING ERRCODE = '42501';
  END IF;

  IF v_plan LIKE 'trial%' AND NOT v_super THEN
    SELECT count(*) INTO v_count
      FROM public.brain_interview_sessions
     WHERE org_id = v_org AND estado <> 'cancelada';
    IF v_count >= 1 THEN
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
$$;

REVOKE ALL ON FUNCTION public.crear_sesion_entrevista(uuid, uuid, text, text, text, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_sesion_entrevista(uuid, uuid, text, text, text, text, text, uuid[]) TO authenticated;