ALTER TABLE public.cursos ADD COLUMN modulo_clave text REFERENCES public.modulos(clave);
COMMENT ON COLUMN public.cursos.modulo_clave IS 'Owning platform module; P1c assigns existing risk courses without changing course entitlement.';
DO $$
DECLARE v_old public.cursos%ROWTYPE; v_new public.cursos%ROWTYPE;
BEGIN
  FOR v_old IN SELECT * FROM public.cursos WHERE norma IN ('NOM-241','NOM-059') AND modulo_clave IS NULL LOOP
    UPDATE public.cursos SET modulo_clave = 'riesgos' WHERE id = v_old.id RETURNING * INTO v_new;
    INSERT INTO public.audit_trail (tabla, registro_id, accion, valor_anterior, valor_nuevo)
    VALUES ('cursos', v_old.id::text, 'P1C_ASIGNAR_MODULO', to_jsonb(v_old), to_jsonb(v_new));
  END LOOP;
END $$;