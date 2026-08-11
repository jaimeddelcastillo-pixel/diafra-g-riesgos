CREATE OR REPLACE FUNCTION public.brain_turn_claim_operation(
  p_turn_id uuid,
  p_org_id uuid,
  p_clave text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
  v_existing jsonb;
BEGIN
  UPDATE public.brain_interview_turns
     SET operations = operations || jsonb_build_object(p_clave, jsonb_build_object('status','in_progress'))
   WHERE id = p_turn_id
     AND org_id = p_org_id
     AND NOT (operations ? p_clave);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 1 THEN
    RETURN jsonb_build_object('claimed', true);
  END IF;

  SELECT operations -> p_clave INTO v_existing
    FROM public.brain_interview_turns
   WHERE id = p_turn_id AND org_id = p_org_id;

  RETURN jsonb_build_object('claimed', false, 'resultado', COALESCE(v_existing, 'null'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.brain_turn_set_operation(
  p_turn_id uuid,
  p_org_id uuid,
  p_clave text,
  p_resultado jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.brain_interview_turns
     SET operations = operations || jsonb_build_object(p_clave, p_resultado)
   WHERE id = p_turn_id AND org_id = p_org_id;
$$;

REVOKE ALL ON FUNCTION public.brain_turn_claim_operation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brain_turn_set_operation(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brain_turn_claim_operation(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_turn_set_operation(uuid, uuid, text, jsonb) TO service_role;