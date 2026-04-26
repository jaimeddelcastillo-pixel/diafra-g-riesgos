-- Cambiar defaults de codigo_formato y version_formato a vacíos.
-- Cada organización debe codificar/versionar según sus propias necesidades de SGC.
-- Los valores 'FOR-SGC-11-01' y '02' eran específicos de Diafra y no deben heredarse a nuevas orgs.

ALTER TABLE public.organizations
  ALTER COLUMN codigo_formato SET DEFAULT '',
  ALTER COLUMN version_formato SET DEFAULT '';

-- Limpiar SOLO las organizaciones que aún tienen los valores default heredados
-- y que NO sean Diafra (preservamos sus datos reales).
-- Identificamos Diafra por slug (asumiendo slug 'diafra' o similar). Si no, conservador:
-- limpiamos solo orgs creadas tras la introducción del default que tengan exactamente esos valores.
UPDATE public.organizations
SET codigo_formato = '',
    version_formato = ''
WHERE codigo_formato = 'FOR-SGC-11-01'
  AND version_formato IN ('01', '02')
  AND slug NOT ILIKE '%diafra%';