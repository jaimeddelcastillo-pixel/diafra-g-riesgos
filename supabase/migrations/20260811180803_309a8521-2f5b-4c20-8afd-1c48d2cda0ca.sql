ALTER TABLE public.folio_sequence DROP CONSTRAINT folio_sequence_pkey;
DROP INDEX IF EXISTS public.folio_sequence_org_tipo_periodo_uidx;
ALTER TABLE public.folio_sequence ADD CONSTRAINT folio_sequence_pkey PRIMARY KEY (org_id, tipo, periodo_key);