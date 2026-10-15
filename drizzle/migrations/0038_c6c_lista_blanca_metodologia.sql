-- La metodología tiene valor por omisión ('AMEF'); se define junto con la norma
-- cuando esta aún está vacía (pantalla de pago confirmado).
CREATE OR REPLACE FUNCTION public.organizations_lista_blanca_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  permitidos text[] := ARRAY['logo_url','codigo_formato','version_formato','razon_social','rfc',
    'folio_prefijo','folio_formato_periodo','folio_digitos_consecutivo','updated_at'];
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN RETURN NEW; END IF;
  IF coalesce(trim(OLD.norma_aplicable::text),'') = '' THEN
    permitidos := permitidos || ARRAY['norma_aplicable','metodologia'];
  ELSIF coalesce(trim(OLD.metodologia::text),'') = '' THEN
    permitidos := permitidos || 'metodologia';
  END IF;
  IF (to_jsonb(NEW) - permitidos) IS DISTINCT FROM (to_jsonb(OLD) - permitidos) THEN
    RAISE EXCEPTION 'Este dato solo lo puede cambiar soporte TRACEA' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;