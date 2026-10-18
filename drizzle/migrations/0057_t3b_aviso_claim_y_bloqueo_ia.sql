CREATE TABLE public.tend_avisos_control (suplencia_id uuid PRIMARY KEY REFERENCES public.org_suplencias(id), tomado_en timestamptz NOT NULL DEFAULT now(), terminado_en timestamptz);
GRANT ALL ON public.tend_avisos_control TO service_role;
ALTER TABLE public.tend_avisos_control ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.tend_aviso_tomar(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Reservado al sistema'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,718));
IF NOT EXISTS(SELECT 1 FROM public.org_suplencias WHERE id=_id AND aviso_rs_requerido AND aviso_rs_enviado_en IS NULL) THEN RETURN false; END IF;
IF EXISTS(SELECT 1 FROM public.tend_avisos_control WHERE suplencia_id=_id AND terminado_en IS NULL AND tomado_en>now()-interval '10 minutes') THEN RETURN false; END IF;
INSERT INTO public.tend_avisos_control(suplencia_id) VALUES(_id) ON CONFLICT(suplencia_id) DO UPDATE SET tomado_en=now(),terminado_en=NULL; RETURN true; END $$;
REVOKE ALL ON FUNCTION public.tend_aviso_tomar(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tend_aviso_tomar(uuid) TO service_role;
CREATE FUNCTION public.tend_aviso_terminar(_id uuid,_enviado boolean,_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Reservado al sistema'; END IF;
PERFORM public.org_suplencia_aviso_resultado(_id,_enviado,_error);
UPDATE public.tend_avisos_control SET terminado_en=now() WHERE suplencia_id=_id;
END $$;
REVOKE ALL ON FUNCTION public.tend_aviso_terminar(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tend_aviso_terminar(uuid,boolean,text) TO service_role;
CREATE TABLE public.tend_ia_control(org_id uuid PRIMARY KEY REFERENCES public.organizations(id),bloqueado boolean NOT NULL DEFAULT false,status integer,mensaje text,updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.tend_ia_control TO authenticated;
GRANT ALL ON public.tend_ia_control TO service_role;
ALTER TABLE public.tend_ia_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY tend_ia_control_lectura ON public.tend_ia_control FOR SELECT TO authenticated USING(public.tend_acceso(org_id));
COMMENT ON TABLE public.tend_ia_control IS 'Server-only persistent terminal AI access/credit pause; owner/system repairs access before fresh user work. No automatic retries.';