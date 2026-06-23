
-- RPC para dashboard de cumplimiento del curso por organización.
-- Devuelve el estado de cada miembro de la org del usuario actual.
CREATE OR REPLACE FUNCTION public.cumplimiento_curso(p_curso_id uuid)
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
  v_org uuid;
  v_priv boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT org_id INTO v_org FROM public.org_members WHERE user_id = v_uid LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  v_priv := public.is_super_admin()
         OR public.has_role(v_uid, 'admin'::app_role)
         OR public.has_role(v_uid, 'responsable_sanitario'::app_role);
  IF NOT v_priv THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  WITH miembros AS (
    SELECT om.user_id, om.role::text AS rol
    FROM public.org_members om
    WHERE om.org_id = v_org
  ),
  mejores AS (
    SELECT DISTINCT ON (i.user_id)
      i.user_id,
      i.calificacion,
      i.aprobado,
      i.finished_at
    FROM public.curso_examen_intentos i
    WHERE i.curso_id = p_curso_id AND i.user_id IN (SELECT user_id FROM miembros)
    ORDER BY i.user_id, i.aprobado DESC NULLS LAST, i.calificacion DESC NULLS LAST, i.finished_at DESC NULLS LAST
  ),
  conteos AS (
    SELECT i.user_id, COUNT(*)::int AS n
    FROM public.curso_examen_intentos i
    WHERE i.curso_id = p_curso_id AND i.user_id IN (SELECT user_id FROM miembros)
    GROUP BY i.user_id
  ),
  diplomas AS (
    SELECT DISTINCT ON (d.user_id)
      d.user_id, d.folio, d.hash_verificacion, d.fecha_emision
    FROM public.curso_diplomas d
    WHERE d.curso_id = p_curso_id AND d.user_id IN (SELECT user_id FROM miembros)
    ORDER BY d.user_id, d.fecha_emision DESC
  )
  SELECT
    m.user_id,
    COALESCE(p.nombre, p.email, '—') AS nombre,
    p.email,
    m.rol,
    COALESCE(c.n, 0) AS intentos,
    mj.calificacion,
    COALESCE(mj.aprobado, false) AS aprobado,
    mj.finished_at AS fecha_aprobacion,
    dp.folio AS diploma_folio,
    dp.hash_verificacion AS diploma_hash
  FROM miembros m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN mejores mj ON mj.user_id = m.user_id
  LEFT JOIN conteos c ON c.user_id = m.user_id
  LEFT JOIN diplomas dp ON dp.user_id = m.user_id
  ORDER BY aprobado DESC, mj.calificacion DESC NULLS LAST, nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cumplimiento_curso(uuid) TO authenticated;
