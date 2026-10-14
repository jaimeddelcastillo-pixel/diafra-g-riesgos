-- P1c.2: curso pagado sin fecha de vencimiento vuelve a contar como vigente.
CREATE OR REPLACE FUNCTION public.acceso_curso_org(p_org uuid, p_curso_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.cursos c WHERE c.id = p_curso_id AND c.activo) THEN 'ninguno'
    WHEN EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org AND o.activo = true AND (
        (o.estado::text = 'activo' AND COALESCE(o.plan,'') NOT IN ('trial','trial-demo',''))
        OR (o.tiene_curso_pagado = true AND (o.curso_expira_en IS NULL OR o.curso_expira_en > now()))
      )) THEN 'completo'
    WHEN EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org AND o.activo = true AND o.estado::text = 'activo'
        AND o.plan IN ('trial','trial-demo')) THEN 'vista_previa'
    ELSE 'ninguno'
  END
$$;

-- Total real de lecciones activas (solo el número), para el encabezado de la vista previa.
CREATE OR REPLACE FUNCTION public.curso_total_lecciones(p_curso_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.mi_acceso_curso(p_curso_id) = 'ninguno' THEN NULL ELSE (
    SELECT count(*)::int FROM public.curso_lecciones l
    JOIN public.curso_modulos m ON m.id = l.modulo_id
    WHERE m.curso_id = p_curso_id AND m.activo AND l.activo) END
$$;
REVOKE ALL ON FUNCTION public.curso_total_lecciones(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curso_total_lecciones(uuid) TO authenticated, service_role;