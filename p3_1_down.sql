-- Reversión P3.1. Ejecutar antes de p3_down.sql.
DROP TRIGGER IF EXISTS organizations_lista_blanca_admin ON public.organizations;
DROP FUNCTION IF EXISTS public.organizations_lista_blanca_admin();
-- Restaurar pendientes_configuracion de P3: volver a aplicar la definición de
-- drizzle/migrations/0034_p3_asistente_configuracion.sql (bloque "firmas": obligatorio=true,
-- título 'Firmas de quienes firman folios', roles admin/responsable_sanitario/comite_tecnico).
