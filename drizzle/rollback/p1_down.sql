-- P1a: deshacer columnas orden/estado del catálogo de módulos
ALTER TABLE public.modulos DROP CONSTRAINT IF EXISTS modulos_estado_check;
ALTER TABLE public.modulos DROP COLUMN IF EXISTS estado;
ALTER TABLE public.modulos DROP COLUMN IF EXISTS orden;
-- Código: restaurar src/config/navigation.ts, src/App.tsx, CerebroGuard y quitar src/modules/.
