-- P1c only. Restore pre-P1c frontend before executing this rollback.
-- Run before p1b1_down.sql and the protected drizzle/rollback/p1_down.sql.
BEGIN;
DROP FUNCTION IF EXISTS public.cursos_ids_modulo(text);
-- Preserve immutable audit evidence of removing course ownership.
INSERT INTO public.audit_trail (tabla, registro_id, accion, valor_anterior, valor_nuevo)
SELECT 'cursos', id::text, 'P1C_REVERTIR_MODULO', to_jsonb(c), to_jsonb(c) - 'modulo_clave'
FROM public.cursos c WHERE modulo_clave IS NOT NULL;
ALTER TABLE public.cursos DROP COLUMN IF EXISTS modulo_clave;
COMMIT;