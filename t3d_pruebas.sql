-- New database rules only. QA fixtures and audit entries always roll back.
BEGIN;
DO $$
DECLARE org uuid:='3868f88a-fa36-4467-9b31-653143c6ef7d'; actor uuid:='119aa014-e89a-4075-9398-efb7db5d2a18'; operador uuid:='47b6c2b6-c423-43ca-9a04-c5995ee194df'; reg uuid; sid uuid; rows jsonb; datos jsonb; resultado jsonb; denied boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=org AND es_prueba) THEN RAISE EXCEPTION 'Solo QA'; END IF;
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 INSERT INTO public.tend_registros(org_id,modulo,nombre) VALUES(org,'presiones','T3d QA export') RETURNING id INTO reg;
 SELECT jsonb_agg(jsonb_build_object('dia',dia,'turno',turno,'valor',10,'hora','08:00','quien','QA')) INTO rows FROM unnest(ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']) dia CROSS JOIN unnest(ARRAY['Mañana','Media tarde','Tarde']) turno;
 datos:=jsonb_build_object('semana_inicio','2024-12-30','unidad','Pa','lecturas',rows);
 sid:=public.tend_guardar_semana(reg,datos);
 PERFORM public.tend_guardar_semana(reg,datos||jsonb_build_object('lecturas',jsonb_set(rows,'{0,valor}','12'::jsonb)),'QA lectura corregida');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',operador,'role','authenticated')::text,true);
 resultado:=public.tend_exportar_crudo(reg,'2025-01-01','2025-01-03');
 IF jsonb_array_length(resultado->'semanas')<>1 OR resultado->'semanas'->0->>'semana_inicio'<>'2024-12-30' THEN RAISE EXCEPTION 'Export no incluye semana cruzada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(resultado->'correcciones') c WHERE c->>'motivo'='QA lectura corregida' AND c->'anterior'->'lecturas'->0->>'valor'='10' AND c->'nuevo'->'lecturas'->0->>'valor'='12') THEN RAISE EXCEPTION 'Operador no recuperó corrección auditada'; END IF;
 denied:=false; BEGIN PERFORM public.tend_exportar_crudo(gen_random_uuid(),'2025-01-01','2025-01-03'); EXCEPTION WHEN raise_exception THEN IF SQLERRM='Registro no disponible' THEN denied:=true; ELSE RAISE; END IF; END;
 IF NOT denied THEN RAISE EXCEPTION 'Export permitió registro ajeno'; END IF;
 denied:=false; BEGIN PERFORM public.tend_exportar_crudo(reg,'2025-01-03','2025-01-01'); EXCEPTION WHEN raise_exception THEN IF SQLERRM='Periodo inválido' THEN denied:=true; ELSE RAISE; END IF; END;
 IF NOT denied THEN RAISE EXCEPTION 'Export permitió periodo invertido'; END IF;
 denied:=false; BEGIN PERFORM public.configurar_modelo_skill('extraccion_bitacora_presiones','google/modelo-qa','QA'); EXCEPTION WHEN raise_exception THEN IF SQLERRM='Solo super_admin' THEN denied:=true; ELSE RAISE; END IF; END;
 IF NOT denied THEN RAISE EXCEPTION 'Operador cambió modelo'; END IF;
 RAISE NOTICE 'T3d: 5 controles de base de datos pasan; rollback QA';
END $$;
ROLLBACK;