ALTER TABLE public.tend_instrumentos DROP CONSTRAINT tend_instrumentos_org_id_codigo_key;
CREATE UNIQUE INDEX tend_instrumentos_codigo_activo_unico ON public.tend_instrumentos (org_id, lower(btrim(codigo))) WHERE activo;
COMMENT ON INDEX public.tend_instrumentos_codigo_activo_unico IS 'Código normalizado único por empresa entre instrumentos activos; los retirados se conservan. No cambia permisos ni auditoría.';
ALTER TABLE public.tend_formato ALTER COLUMN version_formato SET DEFAULT 'Plantilla del reporte (00)';