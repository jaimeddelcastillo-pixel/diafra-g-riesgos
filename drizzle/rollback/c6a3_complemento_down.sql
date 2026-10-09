-- Deshace el complemento C6a.3 (plan_limites, Cerebro en trial, empresa QA starter)
DELETE FROM public.plan_modulos WHERE modulo='institutional_brain' AND plan IN ('trial','trial-demo');
DROP FUNCTION IF EXISTS public.mi_plan_limite(text);
DROP FUNCTION IF EXISTS public.plan_limite(uuid, text);
DROP TABLE IF EXISTS public.plan_limites;
-- Empresa QA: cancelar (no borrar) para conservar bitácora
UPDATE public.organizations SET estado='cancelado', activo=false WHERE slug='qa-starter-sin-cerebro';
