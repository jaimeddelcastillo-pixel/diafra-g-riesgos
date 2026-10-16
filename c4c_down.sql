-- Reversión no destructiva C4c. Restaurar también los archivos de aplicación
-- previos a C4c. Se preservan códigos, referencias y bitácora histórica.
UPDATE public.ia_config_org SET usar_conocimiento_cerebro=false WHERE usar_conocimiento_cerebro;
UPDATE public.ia_skills SET activo=false WHERE clave='uso_conocimiento_empresa';
REVOKE EXECUTE ON FUNCTION public.contexto_cerebro(uuid,uuid,text,int) FROM authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.conocimiento_usado_en(uuid) FROM authenticated,service_role;
-- Códigos y triggers se conservan para no reutilizar consecutivos ni perder
-- integridad de referencias ya documentadas; no se borra información.