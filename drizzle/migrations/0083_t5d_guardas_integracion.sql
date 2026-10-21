DO $$ DECLARE d text;BEGIN
SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='org_suplencias_acceso';
d:=replace(d,'c.soporte_log_id','c.soporte_log_id');
d:=replace(d,'c.soporte_log_id','c.soporte_log_id');
-- contexto_org_actual returns soporte_log_id, not soporte_log_id's legacy spelling soporte_log_id is retained.
END $$;
CREATE OR REPLACE FUNCTION public.org_suplencias_acceso(_org uuid,_escritura boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE c record; BEGIN IF auth.uid() IS NULL THEN RETURN false;END IF;SELECT * INTO c FROM public.contexto_org_actual();IF c.org_id IS DISTINCT FROM _org THEN RETURN false;END IF;IF c.es_super_admin THEN RETURN NOT _escritura AND c.soporte_log_id IS NOT NULL;END IF;RETURN EXISTS(SELECT 1 FROM public.org_members m JOIN public.profiles p ON p.id=m.user_id AND p.activo WHERE m.org_id=_org AND m.user_id=auth.uid());END $$;
DO $$ DECLARE d text;BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tend_at_guard';
 d:=replace(d,'IF true THEN RAISE EXCEPTION ''Separación de funciones: elaborador/modificador no autoriza ni anula''; END IF;','RAISE EXCEPTION ''Separación de funciones: elaborador/modificador no autoriza ni anula'';');
 EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.firma_suplencia_identidad() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p record;BEGIN
 IF NEW.firmado AND NOT coalesce(OLD.firmado,false) AND NEW.firma_suplencia IS NOT NULL THEN
 SELECT nombre,cargo INTO p FROM public.profiles WHERE id=NEW.firma_por AND activo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Firmante inactivo';END IF;
 NEW.nombre:=p.nombre;NEW.cargo:=p.cargo;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER z_firma_suplencia_identidad BEFORE UPDATE ON public.folio_comite FOR EACH ROW EXECUTE FUNCTION public.firma_suplencia_identidad();