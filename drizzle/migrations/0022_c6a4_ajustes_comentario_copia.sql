ALTER TABLE public.brain_documents ADD COLUMN enlace_comentario text;

CREATE OR REPLACE FUNCTION public.brain_documents_enlace_comentario_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $f$
BEGIN
  -- "Mantener enlace": se descarta la discrepancia conservando el mismo archivo
  IF OLD.enlace_por_confirmar AND NOT coalesce(NEW.enlace_por_confirmar,false)
     AND NEW.archivo_id IS NOT NULL AND NEW.archivo_id = OLD.archivo_id THEN
    IF coalesce(btrim(NEW.enlace_comentario),'') = '' THEN
      RAISE EXCEPTION 'Para mantener el enlace escribe un comentario';
    END IF;
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER trg_brain_documents_enlace_comentario BEFORE UPDATE ON public.brain_documents
  FOR EACH ROW EXECUTE FUNCTION public.brain_documents_enlace_comentario_guard();

CREATE OR REPLACE FUNCTION public.org_documentos_copia_marca_conocimiento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  IF NEW.copia_no_controlada AND NOT coalesce(OLD.copia_no_controlada,false) THEN
    UPDATE public.brain_knowledge_items k
       SET requiere_revision = true,
           motivo_revision = 'La fuente es una copia no controlada'
     WHERE k.org_id = NEW.org_id
       AND k.estado NOT IN ('obsoleto','sustituido','rechazado')
       AND EXISTS (
         SELECT 1 FROM public.brain_knowledge_sources s
         LEFT JOIN public.brain_extracciones e ON e.id = s.extraccion_id
         WHERE s.knowledge_item_id = k.id
           AND (s.archivo_id = NEW.id OR e.archivo_id = NEW.id));
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER trg_org_documentos_copia_marca_conocimiento AFTER UPDATE ON public.org_documentos
  FOR EACH ROW EXECUTE FUNCTION public.org_documentos_copia_marca_conocimiento();