-- T2: siete pruebas reales; solo QA; todo se revierte, incluidos los avisos/auditoría.
BEGIN;
DO $$
DECLARE
 a uuid:='3868f88a-fa36-4467-9b31-653143c6ef7d';
 b uuid:='508ebdb4-12c1-4a9a-9767-cae539afef15';
 admin_a uuid:='119aa014-e89a-4075-9398-efb7db5d2a18';
 admin_b uuid:='a918192d-7e2e-4a6c-a984-384619478e96';
 consultor uuid:='4101c851-a9ac-480b-a1a2-8c3403a44ed4';
 operador uuid:='47b6c2b6-c423-43ca-9a04-c5995ee194df';
 rs uuid:='5f1c62c9-2971-4f2f-8068-fac70b332b20';
 sa uuid:='28104b5b-dd9e-430d-9c19-9e62bfeab5cd';
 ra uuid; rb uuid; ins uuid; at_op uuid; at_rs uuid; su uuid;
 den boolean; n integer; t text; anterior jsonb;
BEGIN
 IF (SELECT count(*) FROM public.organizations WHERE id IN(a,b) AND es_prueba)<>2 THEN RAISE EXCEPTION 'Solo QA'; END IF;
 INSERT INTO public.organization_features(org_id,feature_key,activo,notas) VALUES(b,'tendencias',true,'T2 test rollback') ON CONFLICT(org_id,feature_key) DO UPDATE SET activo=true;
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_b,'role','authenticated')::text,true);
 INSERT INTO public.tend_sistemas_hvac(org_id,codigo,nombre_uma) VALUES(b,'T2-B','T2 B') RETURNING id INTO rb;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_a,'role','authenticated')::text,true);
 INSERT INTO public.tend_sistemas_hvac(org_id,codigo,nombre_uma) VALUES(a,'T2-A','T2 A') RETURNING id INTO ra;
 INSERT INTO public.tend_instrumentos(org_id,codigo,tipo,parametro,spec_estado) VALUES(a,'T2-I','otro','T2','validada') RETURNING id INTO ins;
 INSERT INTO public.tend_registros(org_id,modulo,nombre,instrumento_id) VALUES(a,'presiones','T2 registro QA',ins);
 INSERT INTO public.tend_config(org_id,permitir_autoemision) VALUES(a,false) ON CONFLICT(org_id) DO UPDATE SET permitir_autoemision=false;
 -- 1: fila positiva visible; fila real B oculta.
 IF NOT EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=ra) OR EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=rb) THEN RAISE EXCEPTION 'P1 aislamiento falla'; END IF;
 -- 2: B contiene fila, pero sin módulo no lee ni inserta.
 EXECUTE 'RESET ROLE';
 UPDATE public.organization_features SET activo=false WHERE org_id=b AND feature_key='tendencias';
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_b,'role','authenticated')::text,true);
 IF public.org_tiene_modulo(b,'tendencias') OR EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=rb) THEN RAISE EXCEPTION 'P2 lectura falla'; END IF;
 den:=false;
 BEGIN INSERT INTO public.tend_sistemas_hvac(org_id,codigo,nombre_uma) VALUES(b,'T2-X','X');
 EXCEPTION WHEN insufficient_privilege THEN den:=true; WHEN raise_exception THEN IF SQLERRM='Sin permiso de escritura en Tendencias' THEN den:=true; ELSE RAISE; END IF; END;
 IF NOT den THEN RAISE EXCEPTION 'P2 escritura falla'; END IF;
 UPDATE public.tend_sistemas_hvac SET nombre_uma='prohibido' WHERE id=rb; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'P2 update falla'; END IF;
 -- 3: ambos módulos habilitados temporalmente; consultor cambia A/B.
 EXECUTE 'RESET ROLE';
 UPDATE public.organization_features SET activo=true WHERE org_id=b AND feature_key='tendencias';
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',consultor,'role','authenticated')::text,true);
 IF public.get_user_org_id()<>a OR NOT EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=ra) OR EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=rb) THEN RAISE EXCEPTION 'P3 activa A falla'; END IF;
 EXECUTE 'RESET ROLE';
 UPDATE public.profiles SET org_activa_id=b WHERE id=consultor;
 EXECUTE 'SET LOCAL ROLE authenticated';
 IF public.get_user_org_id()<>b OR NOT EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=rb) OR EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=ra) THEN RAISE EXCEPTION 'P3 activa B falla'; END IF;
 -- 4: operador ve y captura borrador válido, pero no emite.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',operador,'role','authenticated')::text,true);
 INSERT INTO public.tend_registros_at(org_id,sistema,periodo_desde,periodo_hasta,instrumentos) VALUES(a,'T2',current_date,current_date,jsonb_build_array(jsonb_build_object('id',ins))) RETURNING id INTO at_op;
 den:=false;
 BEGIN UPDATE public.tend_registros_at SET estado='emitido' WHERE id=at_op;
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Solo RS o suplente vigente autoriza/anula' THEN den:=true; ELSE RAISE; END IF; END;
 IF NOT den OR NOT EXISTS(SELECT 1 FROM public.tend_registros_at WHERE id=at_op AND estado='borrador' AND emitido_por IS NULL) THEN RAISE EXCEPTION 'P4 operador emite'; END IF;
 -- 5: RS con facultad, pero autor de esta versión: no autoriza.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',rs,'role','authenticated')::text,true);
 INSERT INTO public.tend_registros_at(org_id,sistema,periodo_desde,periodo_hasta,instrumentos) VALUES(a,'T2 RS autor',current_date,current_date,jsonb_build_array(jsonb_build_object('id',ins))) RETURNING id INTO at_rs;
 den:=false;
 BEGIN UPDATE public.tend_registros_at SET estado='emitido' WHERE id=at_rs;
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Separación de funciones: elaborador/modificador no autoriza ni anula' THEN den:=true; ELSE RAISE; END IF; END;
 IF NOT den THEN RAISE EXCEPTION 'P5 autor emite'; END IF;
 -- Control positivo: RS distinto del elaborador emite y genera historial.
 UPDATE public.tend_registros_at SET estado='emitido' WHERE id=at_op;
 IF NOT EXISTS(SELECT 1 FROM public.tend_registros_at WHERE id=at_op AND estado='emitido' AND emitido_por=rs AND emitido_nombre IS NOT NULL AND emitido_cargo IS NOT NULL) THEN RAISE EXCEPTION 'Emisión válida falla'; END IF;
 -- 6: UPDATE puede denegarse por permiso o filtrar cero filas; nunca cambiar datos.
 SELECT datos INTO anterior FROM public.tend_registros_at_historial WHERE registro_id=at_op;
 IF anterior IS NULL THEN RAISE EXCEPTION 'P6 historial no generado'; END IF;
 BEGIN UPDATE public.tend_registros_at_historial SET datos='{}' WHERE registro_id=at_op; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'P6 authenticated modifica'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.tend_registros_at_historial WHERE registro_id=at_op; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'P6 authenticated borra'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT datos FROM public.tend_registros_at_historial WHERE registro_id=at_op) IS DISTINCT FROM anterior THEN RAISE EXCEPTION 'P6 contenido cambió'; END IF;
 EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE service_role';
 den:=false;
 BEGIN UPDATE public.tend_registros_at_historial SET datos='{}' WHERE registro_id=at_op;
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Historial AT inmutable, incluso service_role' THEN den:=true; ELSE RAISE; END IF; END;
 IF NOT den THEN RAISE EXCEPTION 'P6 service modifica'; END IF;
 den:=false;
 BEGIN DELETE FROM public.tend_registros_at_historial WHERE registro_id=at_op;
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Historial AT inmutable, incluso service_role' THEN den:=true; ELSE RAISE; END IF; END;
 IF NOT den THEN RAISE EXCEPTION 'P6 service borra'; END IF;
 -- Suplencia: aviso admin=true, RS=false, motivo y facultades controladas.
 EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_a,'role','authenticated')::text,true);
 INSERT INTO public.org_suplencias(org_id,suplente_user_id,facultades,fecha_inicio,fecha_fin,motivo) VALUES(a,operador,ARRAY['autorizar'],now(),now()+interval '1 day','Ausencia RS prueba') RETURNING id INTO su;
 IF NOT EXISTS(SELECT 1 FROM public.org_suplencias WHERE id=su AND aviso_rs_requerido AND aviso_rs_enviado_en IS NULL AND aviso_rs_error IS NULL AND registrada_por=admin_a) THEN RAISE EXCEPTION 'Aviso admin falla'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',rs,'role','authenticated')::text,true);
 INSERT INTO public.org_suplencias(org_id,suplente_user_id,facultades,fecha_inicio,fecha_fin,motivo) VALUES(a,operador,ARRAY['anular'],now(),now()+interval '1 day','Alta RS prueba') RETURNING id INTO su;
 IF NOT EXISTS(SELECT 1 FROM public.org_suplencias WHERE id=su AND NOT aviso_rs_requerido AND registrada_por=rs) THEN RAISE EXCEPTION 'Aviso RS falla'; END IF;
 -- 7: soporte temporal real en DB, sin cambiar la sesión persistente.
 EXECUTE 'RESET ROLE';
 INSERT INTO public.impersonation_logs(super_admin_id,super_admin_email,org_id,org_nombre,motivo) SELECT sa,p.email,a,'QA T2','T2 prueba rollback' FROM public.profiles p WHERE p.id=sa;
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',sa,'role','authenticated')::text,true);
 IF NOT public.tend_acceso(a) OR public.tend_acceso(a,true) OR public.org_suplencias_acceso(a,true) OR NOT EXISTS(SELECT 1 FROM public.tend_sistemas_hvac WHERE id=ra) THEN RAISE EXCEPTION 'P7 soporte falla'; END IF;
 den:=false;
 BEGIN INSERT INTO public.tend_sistemas_hvac(org_id,codigo,nombre_uma) VALUES(a,'T2-SA','SA');
 EXCEPTION WHEN insufficient_privilege THEN den:=true; WHEN raise_exception THEN IF SQLERRM='Sin permiso de escritura en Tendencias' THEN den:=true; ELSE RAISE; END IF; END;
 IF NOT den THEN RAISE EXCEPTION 'P7 SA inserta'; END IF;
 den:=false;
 BEGIN INSERT INTO public.org_suplencias(org_id,suplente_user_id,facultades,fecha_inicio,fecha_fin,motivo) VALUES(a,operador,ARRAY['autorizar'],now(),now()+interval '1 day','T2');
 EXCEPTION WHEN insufficient_privilege THEN den:=true; WHEN raise_exception THEN IF SQLERRM='Sin permiso para registrar o revocar suplencias' THEN den:=true; ELSE RAISE; END IF; END;
 IF NOT den THEN RAISE EXCEPTION 'P7 SA inserta suplencia'; END IF;
 FOREACH t IN ARRAY ARRAY['tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_cambios_filtro','tend_registros','tend_semanas','tend_formato','tend_config','tend_registros_at','tend_registros_at_historial','org_suplencias'] LOOP
  BEGIN EXECUTE format('UPDATE public.%I SET updated_at=updated_at WHERE org_id=$1',t) USING a; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'P7 SA update %',t; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE format('DELETE FROM public.%I WHERE org_id=$1',t) USING a; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'P7 SA delete %',t; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 EXECUTE 'RESET ROLE';
END $$;
-- P8 (T3d): catálogos editables solo por admin y responsable_sanitario (política y trigger).
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tend_sistemas_hvac','tend_areas','tend_instrumentos','tend_objetivos_presion','tend_formato','tend_config'] LOOP
  IF (SELECT count(*) FROM pg_policies WHERE tablename=t AND policyname IN (t||'_insert',t||'_update') AND coalesce(with_check,'') LIKE '%''admin''::text, ''responsable_sanitario''::text]%' AND coalesce(with_check,'') NOT LIKE '%operador%' AND coalesce(with_check,'') NOT LIKE '%comite%')<>2 THEN RAISE EXCEPTION 'P8 política %',t; END IF;
 END LOOP;
 IF pg_get_functiondef('public.tend_guard'::regproc) NOT LIKE '%THEN ARRAY[''admin'',''responsable_sanitario''] ELSE%' THEN RAISE EXCEPTION 'P8 trigger'; END IF;
END $$;
SELECT unnest(ARRAY['P1 A no ve B: PASA','P2 Sin módulo no lee/escribe: PASA','P3 Consultor solo empresa activa A/B: PASA','P4 Operador no emite: PASA','P5 RS autor no autoriza: PASA','P6 Historial authenticated/service_role inmutable: PASA','P7 Super_admin soporte solo lectura: PASA','Aviso RS admin=true / RS=false: PASA']) AS resultado;
ROLLBACK;