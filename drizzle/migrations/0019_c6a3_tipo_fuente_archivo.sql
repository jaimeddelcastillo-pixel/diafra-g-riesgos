-- C6a.3 fix: la restricción de tipo_fuente no incluía 'archivo' y las fuentes de extracción se perdían.
ALTER TABLE public.brain_knowledge_sources DROP CONSTRAINT brain_knowledge_sources_tipo_fuente_check;
ALTER TABLE public.brain_knowledge_sources ADD CONSTRAINT brain_knowledge_sources_tipo_fuente_check
  CHECK (tipo_fuente = ANY (ARRAY['entrevista','documento','persona','registro','requisito_regulatorio','observacion','archivo']));