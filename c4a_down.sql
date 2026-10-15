-- ══════════════════════════════════════════════════════════════════════
-- Reversión C4a · Skills de IA (c4a_down.sql)
-- Ejecutar solo si se necesita volver al estado previo.
-- ADVERTENCIA: borra la trazabilidad (skills_usadas) y el catálogo ia_skills.
-- ══════════════════════════════════════════════════════════════════════

-- 3. Quitar columnas de trazabilidad
ALTER TABLE public.chat_mensajes DROP COLUMN IF EXISTS skills_usadas;
ALTER TABLE public.brain_interview_turns DROP COLUMN IF EXISTS skills_usadas;
ALTER TABLE public.brain_extracciones DROP COLUMN IF EXISTS skills_usadas;

-- 2. Quitar triggers y funciones de gobernanza/auditoría de agent_prompts
DROP TRIGGER IF EXISTS trg_agent_prompts_audit ON public.agent_prompts;
DROP TRIGGER IF EXISTS trg_agent_prompts_governance ON public.agent_prompts;
DROP TRIGGER IF EXISTS trg_agent_prompts_ingreso ON public.agent_prompts;
DROP FUNCTION IF EXISTS public.agent_prompts_audit();
DROP FUNCTION IF EXISTS public.agent_prompts_governance();
DROP FUNCTION IF EXISTS public.agent_prompts_ingreso();

-- Quitar FK y volver al CHECK original; quitar columnas de control
ALTER TABLE public.agent_prompts DROP CONSTRAINT IF EXISTS agent_prompts_nombre_fkey;
ALTER TABLE public.agent_prompts
  DROP COLUMN IF EXISTS sha256,
  DROP COLUMN IF EXISTS aprobado_en,
  DROP COLUMN IF EXISTS aprobado_por,
  DROP COLUMN IF EXISTS motivo_cambio,
  DROP COLUMN IF EXISTS estado;
ALTER TABLE public.agent_prompts
  ADD CONSTRAINT agent_prompts_nombre_check CHECK (nombre IN ('dm','farma','cerebro_institucional'));

-- 1. Quitar catálogo
DROP TABLE IF EXISTS public.ia_skills;
