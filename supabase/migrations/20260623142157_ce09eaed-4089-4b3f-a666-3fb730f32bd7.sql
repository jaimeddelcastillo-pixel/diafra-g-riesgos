CREATE OR REPLACE FUNCTION public.cumplimiento_curso(p_curso_id uuid, p_org_id uuid DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  nombre text,
  email text,
  rol text,
  intentos int,
  mejor_calificacion numeric,
  aprobado boolean,
  fecha_aprobacion timestamptz,
  diploma_folio text,
  diploma_hash text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_own_org uuid;
  v_org uuid;
  v_is_sa boolean;
  v_priv boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_is_sa := public.is_super_admin();

  SELECT om.org_id
    INTO v_own_org
  FROM public.org_members om
  WHERE om.user_id = v_uid
  ORDER BY om.created_at ASC
  LIMIT 1;

  v_org := COALESCE(p_org_id, v_own_org);

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  IF NOT v_is_sa AND p_org_id IS NOT NULL AND p_org_id <> v_own_org THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_priv := v_is_sa
         OR (
              v_own_org = v_org
              AND (
                public.has_role(v_uid, 'admin'::app_role)
                OR public.has_role(v_uid, 'responsable_sanitario'::app_role)
              )
            );

  IF NOT v_priv THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  WITH miembros AS (
    SELECT om.user_id AS miembro_user_id, om.role::text AS miembro_rol
    FROM public.org_members om
    WHERE om.org_id = v_org
  ),
  mejores AS (
    SELECT DISTINCT ON (i.user_id)
      i.user_id AS intento_user_id,
      i.calificacion AS intento_calificacion,
      i.aprobado AS intento_aprobado,
      i.finished_at AS intento_finished_at
    FROM public.curso_examen_intentos i
    WHERE i.curso_id = p_curso_id
      AND i.user_id IN (SELECT mi.miembro_user_id FROM miembros mi)
    ORDER BY i.user_id, i.aprobado DESC NULLS LAST, i.calificacion DESC NULLS LAST, i.finished_at DESC NULLS LAST
  ),
  conteos AS (
    SELECT i.user_id AS intento_user_id, COUNT(*)::int AS n
    FROM public.curso_examen_intentos i
    WHERE i.curso_id = p_curso_id
      AND i.user_id IN (SELECT mi.miembro_user_id FROM miembros mi)
    GROUP BY i.user_id
  ),
  diplomas AS (
    SELECT DISTINCT ON (d.user_id)
      d.user_id AS diploma_user_id,
      d.folio AS diploma_folio,
      d.hash_verificacion AS diploma_hash,
      d.fecha_emision AS diploma_fecha_emision
    FROM public.curso_diplomas d
    WHERE d.curso_id = p_curso_id
      AND d.user_id IN (SELECT mi.miembro_user_id FROM miembros mi)
    ORDER BY d.user_id, d.fecha_emision DESC
  )
  SELECT
    m.miembro_user_id AS user_id,
    COALESCE(p.nombre, p.email, '—')::text AS nombre,
    p.email::text AS email,
    m.miembro_rol AS rol,
    COALESCE(c.n, 0) AS intentos,
    mj.intento_calificacion AS mejor_calificacion,
    COALESCE(mj.intento_aprobado, false) AS aprobado,
    mj.intento_finished_at AS fecha_aprobacion,
    dp.diploma_folio AS diploma_folio,
    dp.diploma_hash AS diploma_hash
  FROM miembros m
  LEFT JOIN public.profiles p ON p.id = m.miembro_user_id
  LEFT JOIN mejores mj ON mj.intento_user_id = m.miembro_user_id
  LEFT JOIN conteos c ON c.intento_user_id = m.miembro_user_id
  LEFT JOIN diplomas dp ON dp.diploma_user_id = m.miembro_user_id
  ORDER BY aprobado DESC, mejor_calificacion DESC NULLS LAST, nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cumplimiento_curso(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cumplimiento_curso(uuid) TO authenticated;