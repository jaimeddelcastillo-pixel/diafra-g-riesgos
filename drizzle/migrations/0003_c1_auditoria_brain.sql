-- C1 Parte E: bitácora de auditoría para tablas brain_* reutilizando audit_trigger_func.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brain_knowledge_items','brain_knowledge_sources','brain_documents','brain_areas','brain_processes','brain_process_areas','brain_import_batches','brain_import_propuestas','brain_interview_sessions','brain_interview_assignments','brain_assignment_processes','brain_session_processes','brain_contradictions','brain_gaps','brain_memoria_viva','brain_exports']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()', t);
  END LOOP;
END $$;

ALTER POLICY "Org admin read audit" ON public.audit_trail
  USING (((org_id = get_user_org_id()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comite_tecnico'::app_role) OR has_role(auth.uid(), 'responsable_sanitario'::app_role))) OR is_super_admin());