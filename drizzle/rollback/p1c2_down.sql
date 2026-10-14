-- Reversión P1c.2 (ejecutar antes de p1c1_down.sql). Restaurar primero el código anterior a P1c.2
-- (ProtectedRoute, MisDiplomas, SolicitarDC3Card, useCurso, Capacitacion, emitir-diploma, solicitar-dc3).
DROP FUNCTION IF EXISTS public.curso_total_lecciones(uuid);
CREATE OR REPLACE FUNCTION public.acceso_curso_org(p_org uuid, p_curso_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.cursos c WHERE c.id = p_curso_id AND c.activo) THEN 'ninguno'
    WHEN EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org AND o.activo = true AND (
        (o.estado::text = 'activo' AND COALESCE(o.plan,'') NOT IN ('trial','trial-demo',''))
        OR (o.tiene_curso_pagado = true AND o.curso_expira_en IS NOT NULL AND o.curso_expira_en > now())
      )) THEN 'completo'
    WHEN EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org AND o.activo = true AND o.estado::text = 'activo'
        AND o.plan IN ('trial','trial-demo')) THEN 'vista_previa'
    ELSE 'ninguno'
  END
$$;
