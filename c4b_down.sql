-- ══════════════════════════════════════════════════════════════════════
-- Reversión C4b · Composición de skills por bloques (c4b_down.sql)
-- ADVERTENCIA: borra corridas/calificaciones, el interruptor por empresa,
-- ia_origen de riesgos y modelo_ia. Antes, vuelve todas las empresas a
-- 'monolitica'. La corrección de semillas C4a (paso 0) no se revierte.
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE public.riesgos DROP COLUMN IF EXISTS ia_origen;
ALTER TABLE public.chat_mensajes DROP COLUMN IF EXISTS modelo_ia;
ALTER TABLE public.brain_interview_turns DROP COLUMN IF EXISTS modelo_ia;
ALTER TABLE public.brain_extracciones DROP COLUMN IF EXISTS modelo_ia;

DROP FUNCTION IF EXISTS public.publicar_skill(uuid, text);
DROP TRIGGER IF EXISTS trg_agent_prompts_publicacion_guard ON public.agent_prompts;
DROP FUNCTION IF EXISTS public.agent_prompts_publicacion_guard();
DROP FUNCTION IF EXISTS public.ia_skill_casos_faltantes(uuid);
DROP TABLE IF EXISTS public.ia_skill_pruebas;
DROP TABLE IF EXISTS public.ia_skill_casos;
DROP FUNCTION IF EXISTS public.ia_skill_pruebas_evaluacion();

DROP TABLE IF EXISTS public.ia_config_org;
DROP FUNCTION IF EXISTS public.ia_config_org_sello();
DROP FUNCTION IF EXISTS public.ia_config_org_audit();

DROP TRIGGER IF EXISTS trg_agent_prompts_borrador_audit ON public.agent_prompts;
DROP TRIGGER IF EXISTS trg_agent_prompts_borrador_huella ON public.agent_prompts;
DROP FUNCTION IF EXISTS public.agent_prompts_borrador_audit();
DROP FUNCTION IF EXISTS public.agent_prompts_borrador_huella();
DROP INDEX IF EXISTS public.agent_prompts_un_borrador;
DROP INDEX IF EXISTS public.agent_prompts_un_vigente;

-- Las versiones de las piezas nuevas no se borran (bitácora): se retiran
-- y luego se quitan del catálogo solo si no tienen versiones.
UPDATE public.agent_prompts SET estado = 'retirada', motivo_cambio = 'Reversión C4b'
 WHERE nombre IN ('plataforma','riesgos_amef','norma_nom241','norma_nom059',
                  'alcance_riesgos','alcance_cerebro','alcance_capacitacion')
   AND estado IN ('borrador','vigente');
DELETE FROM public.ia_skills s
 WHERE s.clave IN ('plataforma','riesgos_amef','norma_nom241','norma_nom059',
                   'alcance_riesgos','alcance_cerebro','alcance_capacitacion')
   AND NOT EXISTS (SELECT 1 FROM public.agent_prompts p WHERE p.nombre = s.clave);
ALTER TABLE public.ia_skills DROP CONSTRAINT IF EXISTS ia_skills_ambito_check;
ALTER TABLE public.ia_skills ADD CONSTRAINT ia_skills_ambito_check
  CHECK (ambito IN ('plataforma','norma','modulo','tarea','alcance')) NOT VALID;
-- (se deja 'alcance' admitido si quedaron skills de alcance con historial)
