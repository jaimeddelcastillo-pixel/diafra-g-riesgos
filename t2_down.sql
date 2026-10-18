-- T2: reversión no destructiva. NO ejecutada.
-- Conserva datos, originales, historial y audit_trail. No usar DROP/CASCADE.
-- T3a corrigió tend_areas_iso_check para admitir el valor original «No clasificada».
-- Esta reversión conserva esa ampliación: estrecharla invalidaría registros existentes.
-- Aplicar sección A por herramienta de migraciones; sección B por herramienta de datos.

-- A: deshabilitar todos los accesos T2 sin eliminar registros.
CREATE OR REPLACE FUNCTION public.tend_acceso(_org uuid,_escritura boolean DEFAULT false,_roles text[] DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.org_suplencias_acceso(_org uuid,_escritura boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT false $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_cambios_filtro','tend_registros','tend_semanas','tend_formato','tend_config','tend_registros_at','tend_registros_at_historial','tend_extracciones','org_suplencias'] LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
-- T3b: conservar snapshots, identidades y extracciones; cerrar operaciones servidor.
REVOKE ALL ON FUNCTION public.tend_guardar_semana(uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tend_confirmar_extraccion(uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tend_extraccion_resultado(uuid,jsonb,jsonb,text,bigint,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.org_suplencia_aviso_resultado(uuid,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tend_aviso_tomar(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tend_aviso_terminar(uuid,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.tend_avisos_control,public.tend_ia_control FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tend_resolver_instrumentos(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
-- Bloquea archivos T2 sin afectar los demás buckets ni borrar originales.
DROP POLICY IF EXISTS tend_bitacoras_select ON storage.objects;
DROP POLICY IF EXISTS tend_bitacoras_insert ON storage.objects;
-- Conservar funciones compartidas actualizadas: no restaurar versiones antiguas
-- que podrían deshacer cambios posteriores de otros módulos.
-- Conservar historial, triggers de integridad y tarea de vencimientos para trazabilidad.

-- B: ejecutar aparte como cambio de datos; todos los cambios llevan audit_trail.
WITH anterior AS (
 SELECT * FROM public.organization_features WHERE feature_key='tendencias' AND activo
), nuevo AS (
 UPDATE public.organization_features SET activo=false,updated_at=now()
 WHERE feature_key='tendencias' AND activo RETURNING *
)
INSERT INTO public.audit_trail(org_id,tabla,registro_id,accion,valor_anterior,valor_nuevo)
SELECT n.org_id,'organization_features',n.id::text,'T2_REVERTIDO',to_jsonb(a),to_jsonb(n)
FROM nuevo n JOIN anterior a ON a.id=n.id;
WITH anterior AS (
 SELECT * FROM public.modulos WHERE clave='tendencias'
), nuevo AS (
 UPDATE public.modulos SET estado='proximamente' WHERE clave='tendencias' RETURNING *
)
INSERT INTO public.audit_trail(tabla,registro_id,accion,valor_anterior,valor_nuevo)
SELECT 'modulos','tendencias','T2_REVERTIDO',to_jsonb(a),to_jsonb(n)
FROM anterior a CROSS JOIN nuevo n;