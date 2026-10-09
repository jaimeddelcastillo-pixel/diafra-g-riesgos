-- C2b Parte A: preparar varias membresías sin cambiar comportamiento actual.
-- 1) Índice único compuesto (convive con UNIQUE(user_id) hasta la Parte C).
ALTER TABLE public.org_members ADD CONSTRAINT org_members_user_id_org_id_key UNIQUE (user_id, org_id);

-- 2) Funciones que tomaban "la" membresía: ahora usan la empresa de la sesión.
DO $$
DECLARE r record; v_def text; v_new text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('crear_sesion_entrevista', 'SELECT org_id INTO v_org FROM public.org_members WHERE user_id = v_user LIMIT 1;', 'v_org := public.get_user_org_id();'),
    ('examen_iniciar', 'SELECT org_id INTO v_org FROM public.org_members WHERE user_id = v_user LIMIT 1;', 'v_org := public.get_user_org_id();'),
    ('cumplimiento_curso', E'SELECT om.org_id\n    INTO v_own_org\n  FROM public.org_members om\n  WHERE om.user_id = v_uid\n  ORDER BY om.created_at ASC\n  LIMIT 1;', 'v_own_org := public.get_user_org_id();')
  ) AS t(fn, viejo, nuevo) LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
     WHERE s.nspname = 'public' AND p.proname = r.fn;
    v_new := replace(v_def, r.viejo, r.nuevo);
    IF v_new = v_def THEN RAISE EXCEPTION 'C2b-A: no se encontró el texto a reemplazar en %', r.fn; END IF;
    EXECUTE v_new;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.same_org_member(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m2
    WHERE m2.org_id = public.get_user_org_id() AND m2.user_id = _user_id
  )
$function$;

-- 3) Políticas de perfiles: limitar a la empresa activa.
DROP POLICY "Org members read same org profiles" ON public.profiles;
CREATE POLICY "Org members read same org profiles" ON public.profiles FOR SELECT TO authenticated
USING (is_super_admin() OR id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.org_members om_target
  WHERE om_target.org_id = public.get_user_org_id() AND om_target.user_id = profiles.id));

DROP POLICY "Admins update same-org profiles" ON public.profiles;
CREATE POLICY "Admins update same-org profiles" ON public.profiles FOR UPDATE TO public
USING (id = auth.uid() OR is_super_admin() OR ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_sanitario'::app_role)) AND EXISTS (
  SELECT 1 FROM public.org_members om_target
  WHERE om_target.org_id = public.get_user_org_id() AND om_target.user_id = profiles.id)))
WITH CHECK (id = auth.uid() OR is_super_admin() OR ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_sanitario'::app_role)) AND EXISTS (
  SELECT 1 FROM public.org_members om_target
  WHERE om_target.org_id = public.get_user_org_id() AND om_target.user_id = profiles.id)));