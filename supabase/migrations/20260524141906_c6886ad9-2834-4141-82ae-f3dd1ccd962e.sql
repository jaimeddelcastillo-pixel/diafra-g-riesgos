-- 1. Restrict self-registration into org_members to 'operador' role only
DROP POLICY IF EXISTS "self_registration_org_members_insert" ON public.org_members;
CREATE POLICY "self_registration_org_members_insert"
ON public.org_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (SELECT 1 FROM public.org_members om WHERE om.user_id = auth.uid())
  AND role = 'operador'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.org_members om2 WHERE om2.org_id = org_members.org_id)
);

-- 2. Prevent admins from assigning super_admin via org_members
DROP POLICY IF EXISTS "Admins manage org members" ON public.org_members;
CREATE POLICY "Admins read org members"
ON public.org_members
FOR SELECT
USING (((org_id = get_user_org_id()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_super_admin());

CREATE POLICY "Admins insert org members"
ON public.org_members
FOR INSERT
WITH CHECK (
  is_super_admin()
  OR (
    org_id = get_user_org_id()
    AND has_role(auth.uid(), 'admin'::app_role)
    AND role = ANY (ARRAY['admin'::app_role,'operador'::app_role,'comite_tecnico'::app_role,'responsable_sanitario'::app_role])
  )
);

CREATE POLICY "Admins update org members"
ON public.org_members
FOR UPDATE
USING (((org_id = get_user_org_id()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_super_admin())
WITH CHECK (
  is_super_admin()
  OR (
    org_id = get_user_org_id()
    AND has_role(auth.uid(), 'admin'::app_role)
    AND role = ANY (ARRAY['admin'::app_role,'operador'::app_role,'comite_tecnico'::app_role,'responsable_sanitario'::app_role])
  )
);

CREATE POLICY "Admins delete org members"
ON public.org_members
FOR DELETE
USING (((org_id = get_user_org_id()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_super_admin());

-- 3. Restrictive policies on user_roles to deny client-side writes
CREATE POLICY "Deny client insert on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny client update on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny client delete on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);

-- 4. Set search_path on pgmq wrapper functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;