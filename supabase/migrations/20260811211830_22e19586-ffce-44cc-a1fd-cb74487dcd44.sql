ALTER TABLE public.brain_interview_turns
  ADD COLUMN IF NOT EXISTS transcript_persisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS institutional_effects boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS brain_interview_messages_turn_role_uidx
  ON public.brain_interview_messages (turn_id, role)
  WHERE turn_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.brain_turn_claim_operation(
  p_turn_id uuid,
  p_org_id uuid,
  p_clave text,
  p_stale_seconds integer DEFAULT 180
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated int;
  v_existing jsonb;
  v_status text;
  v_claimed_at timestamptz;
  v_turn_estado text;
  v_now timestamptz := now();
BEGIN
  -- 1. Intento de reserva inicial (clave inexistente)
  UPDATE public.brain_interview_turns
     SET operations = operations || jsonb_build_object(
           p_clave,
           jsonb_build_object('status','in_progress','claimed_at', v_now)
         )
   WHERE id = p_turn_id
     AND org_id = p_org_id
     AND NOT (operations ? p_clave);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 1 THEN
    RETURN jsonb_build_object('claimed', true, 'status', 'in_progress', 'reclaimed', false);
  END IF;

  SELECT operations -> p_clave, estado
    INTO v_existing, v_turn_estado
    FROM public.brain_interview_turns
   WHERE id = p_turn_id AND org_id = p_org_id;

  IF v_existing IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'status', 'unknown', 'resultado', 'null'::jsonb);
  END IF;

  v_status := COALESCE(v_existing ->> 'status', 'completed');
  v_claimed_at := NULLIF(v_existing ->> 'claimed_at','')::timestamptz;

  IF v_status = 'completed' THEN
    RETURN jsonb_build_object(
      'claimed', false, 'status', 'completed',
      'resultado', COALESCE(v_existing -> 'result', v_existing)
    );
  END IF;

  -- 2. failed  → reintento controlado reutilizando la misma clave
  -- 3. in_progress huérfano → turno no vivo o claim vencido
  IF v_status = 'failed'
     OR (v_status = 'in_progress'
         AND (v_turn_estado <> 'procesando'
              OR v_claimed_at IS NULL
              OR v_claimed_at < v_now - make_interval(secs => p_stale_seconds)))
  THEN
    UPDATE public.brain_interview_turns
       SET operations = operations || jsonb_build_object(
             p_clave,
             jsonb_build_object(
               'status','in_progress',
               'claimed_at', v_now,
               'previous_status', v_status,
               'previous_error', v_existing -> 'error'
             )
           )
     WHERE id = p_turn_id AND org_id = p_org_id;
    RETURN jsonb_build_object('claimed', true, 'status','in_progress','reclaimed', true, 'previous_status', v_status);
  END IF;

  -- in_progress vivo: NUNCA devolver como resultado válido
  RETURN jsonb_build_object('claimed', false, 'status', 'in_progress', 'resultado', 'null'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.brain_turn_set_operation(
  p_turn_id uuid,
  p_org_id uuid,
  p_clave text,
  p_resultado jsonb,
  p_status text DEFAULT 'completed',
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.brain_interview_turns
     SET operations = operations || jsonb_build_object(
           p_clave,
           COALESCE(operations -> p_clave, '{}'::jsonb)
             || jsonb_build_object('status', p_status, 'completed_at', now())
             || CASE WHEN p_status = 'completed'
                     THEN jsonb_build_object('result', COALESCE(p_resultado, 'null'::jsonb), 'error', NULL)
                     ELSE jsonb_build_object('error', p_error)
                END
         )
   WHERE id = p_turn_id AND org_id = p_org_id;
$function$;