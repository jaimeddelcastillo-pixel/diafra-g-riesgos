-- C2b rollback. Ejecutar en orden inverso: F, C, A.

-- ===== Parte F (0009_c2b_f_nombres_personas.sql) =====
DROP FUNCTION IF EXISTS public.nombres_personas(uuid[]);

-- ===== Parte C (0008_c2b_c_varias_membresias.sql) =====
-- Requiere que ningún usuario tenga más de una membresía; si las hay, falla a propósito:
DO $$ BEGIN
  IF EXISTS (SELECT user_id FROM public.org_members GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay usuarios con varias empresas; quita las membresías extra antes de deshacer C';
  END IF;
END $$;
ALTER TABLE public.org_members ADD CONSTRAINT org_members_user_id_key UNIQUE (user_id);

-- ===== Parte A (0007_c2b_a_preparacion.sql) =====
DROP POLICY IF EXISTS "Admins update same-org profiles" ON public.profiles;
CREATE POLICY "Admins update same-org profiles" ON public.profiles FOR UPDATE TO public
USING (id = auth.uid() OR is_super_admin() OR ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_sanitario'::app_role)) AND EXISTS (
  SELECT 1 FROM public.org_members om_self JOIN public.org_members om_target ON om_target.org_id = om_self.org_id
  WHERE om_self.user_id = auth.uid() AND om_target.user_id = profiles.id)))
WITH CHECK (id = auth.uid() OR is_super_admin() OR ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_sanitario'::app_role)) AND EXISTS (
  SELECT 1 FROM public.org_members om_self JOIN public.org_members om_target ON om_target.org_id = om_self.org_id
  WHERE om_self.user_id = auth.uid() AND om_target.user_id = profiles.id)));

DROP POLICY IF EXISTS "Org members read same org profiles" ON public.profiles;
CREATE POLICY "Org members read same org profiles" ON public.profiles FOR SELECT TO authenticated
USING (is_super_admin() OR id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.org_members om_self JOIN public.org_members om_target ON om_target.org_id = om_self.org_id
  WHERE om_self.user_id = auth.uid() AND om_target.user_id = profiles.id));

CREATE OR REPLACE FUNCTION public.same_org_member(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m1
    JOIN public.org_members m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = _user_id
  )
$function$;

DO $$
DECLARE r record; v_def text; v_new text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('crear_sesion_entrevista', 'v_org := public.get_user_org_id();', 'SELECT org_id INTO v_org FROM public.org_members WHERE user_id = v_user LIMIT 1;'),
    ('examen_iniciar', 'v_org := public.get_user_org_id();', 'SELECT org_id INTO v_org FROM public.org_members WHERE user_id = v_user LIMIT 1;'),
    ('cumplimiento_curso', 'v_own_org := public.get_user_org_id();', E'SELECT om.org_id\n    INTO v_own_org\n  FROM public.org_members om\n  WHERE om.user_id = v_uid\n  ORDER BY om.created_at ASC\n  LIMIT 1;')
  ) AS t(fn, viejo, nuevo) LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
     WHERE s.nspname = 'public' AND p.proname = r.fn;
    v_new := replace(v_def, r.viejo, r.nuevo);
    IF v_new = v_def THEN RAISE EXCEPTION 'rollback C2b-A: texto no encontrado en %', r.fn; END IF;
    EXECUTE v_new;
  END LOOP;
END $$;

-- Solo mientras UNIQUE(user_id) siga presente (antes de la Parte C):
ALTER TABLE public.org_members DROP CONSTRAINT IF EXISTS org_members_user_id_org_id_key;
-- Al deshacer, regresar admin-create-org a onConflict "user_id".
