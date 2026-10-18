-- Solo QA; cambios y auditoría revertidos al finalizar.
BEGIN;
DO $$
DECLARE
 org uuid := '3868f88a-fa36-4467-9b31-653143c6ef7d';
 admin_qa uuid := '119aa014-e89a-4075-9398-efb7db5d2a18';
 rs_qa uuid := '5f1c62c9-2971-4f2f-8068-fac70b332b20';
 at_id uuid; rechazado boolean := false; aviso uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=org AND es_prueba) THEN RAISE EXCEPTION 'Solo QA'; END IF;
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_qa,'role','authenticated')::text,true);
 INSERT INTO public.tend_registros_at(org_id,sistema,periodo_desde,periodo_hasta)
 VALUES(org,'QA prueba anulación cierre',current_date,current_date) RETURNING id INTO at_id;
 BEGIN
  UPDATE public.tend_registros_at SET estado='anulado',motivo_anulacion='QA rechazo admin autor' WHERE id=at_id;
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Solo RS o suplente vigente anula borrador' THEN rechazado:=true; ELSE RAISE; END IF;
 END;
 IF NOT rechazado THEN RAISE EXCEPTION 'Admin autor pudo anular borrador'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',rs_qa,'role','authenticated')::text,true);
 UPDATE public.tend_registros_at SET estado='anulado',motivo_anulacion='QA anulación RS' WHERE id=at_id;
 IF NOT EXISTS(SELECT 1 FROM public.tend_registros_at WHERE id=at_id AND estado='anulado') THEN RAISE EXCEPTION 'RS no anuló o borró registro'; END IF;
 EXECUTE 'RESET ROLE';
 SELECT id INTO aviso FROM public.org_suplencias WHERE org_id=org AND aviso_rs_enviado_en IS NOT NULL LIMIT 1;
 IF aviso IS NULL THEN RAISE EXCEPTION 'Falta aviso QA enviado para prueba'; END IF;
 EXECUTE 'SET LOCAL ROLE service_role';
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 IF public.tend_aviso_tomar(aviso) THEN RAISE EXCEPTION 'Aviso enviado se reclamó otra vez'; END IF;
 RAISE NOTICE '3/3: admin rechazado, RS anula sin borrar, aviso enviado no se reclama';
END $$;
ROLLBACK;