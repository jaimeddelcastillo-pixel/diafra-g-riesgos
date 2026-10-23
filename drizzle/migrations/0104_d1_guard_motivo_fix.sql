-- D1: generated documents have no reason column; read the reason without referencing a missing field.
CREATE OR REPLACE FUNCTION public.documental_solo_insercion() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Registro documental inalterable: guarda una versión nueva';END IF;
  IF TG_TABLE_NAME<>'documentos_generados' AND length(btrim(coalesce(to_jsonb(NEW)->>'motivo','')))<5 THEN RAISE EXCEPTION 'Motivo obligatorio (mínimo 5 caracteres)';END IF;
  RETURN NEW;
END $$;