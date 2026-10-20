CREATE OR REPLACE FUNCTION public.tend_at_apendice_compartido() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE tabla_texto text := $tabla$Clasificación | Partículas ≥0.5 µm /m³ (estático / dinámico) | Partículas ≥5 µm /m³ (estático / dinámico) | Frecuencia de monitoreo | UFC | Presión diferencial | Cambios de aire por hora | Temperatura | Humedad relativa
Clase A (ISO-5) | 3 520 / 3 520 | 20 / 20 | Continuo | < 1/placa sed.; < 1/m³; < 1/placa contacto; < 1/guante | > 15 Pa con respecto a cuartos adyacentes, en cascada | n.a. | 18–25 °C | 30–65 % HR
Clase B | 3 520 / 352 000 | 29 / 2 900 | Cada 3 meses | < 5/placa sed.; < 10/m³; < 5/placa contacto; < 5/guante | > 15 Pa con respecto a áreas no asépticas, en cascada | 20 a 50 | 18–25 °C | 30–65 % HR
Clase C (ISO-7) | 352 000 / 3 520 000 | 2 900 / 29 000 | Cada 6 meses | < 50/placa sed.; < 100/m³; < 25/placa contacto | > 10 Pa | 20 a 50 | 18–25 °C | 30–65 % HR
Clase D (ISO-8) | 3 520 000 / n.a. | 29 000 / n.a. | Cada 6 meses | < 100/placa sed.; < 200/m³; < 50/placa contacto | > 5 Pa; negativa donde se generan polvos con respecto a adyacentes y positiva donde no | 10 a 20 | 18–25 °C | 30–65 % HR
ISO-9 | 35 200 000 / n.a. | 293 000 / n.a. | Anual | n.a. | Positiva con respecto a áreas no clasificadas | n.a. | 18–25 °C | n.a.
Área limpia (libre de clasificación) | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | 18–25 °C | n.a.
Área gris (libre de clasificación) | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a.$tabla$;
textos jsonb; tabla jsonb;
BEGIN
 IF coalesce(current_setting('tracea.migracion',true),'')='1' THEN RETURN NEW; END IF;
 IF NEW.estado='emitido' AND (TG_OP='INSERT' OR OLD.estado IS DISTINCT FROM 'emitido') THEN
  SELECT jsonb_object_agg(key,to_jsonb(regexp_replace(value,'NOM-(241|059)(-SSA1(-[0-9]{4})?)?( *\/ *NOM-(241|059)(-SSA1(-[0-9]{4})?)?)?','NOM-241-SSA1-2025 / NOM-059-SSA1-2015','g'))) INTO textos FROM jsonb_each_text(coalesce(NEW.formato_snapshot->'textos','{}'::jsonb));
  SELECT jsonb_agg(to_jsonb(string_to_array(linea,' | ')) ORDER BY n) INTO tabla FROM unnest(string_to_array(tabla_texto,E'\n')) WITH ORDINALITY t(linea,n);
  NEW.formato_snapshot:=NEW.formato_snapshot||jsonb_build_object('textos',coalesce(textos,'{}'::jsonb)||jsonb_build_object('tablaClases',tabla_texto),'tabla_iso',tabla);
  IF NEW.texto ? 's11' THEN
   NEW.texto:=jsonb_set(NEW.texto,'{s11}',to_jsonb(regexp_replace(NEW.texto->>'s11','NOM-(241|059)(-SSA1(-[0-9]{4})?)?( *\/ *NOM-(241|059)(-SSA1(-[0-9]{4})?)?)?','NOM-241-SSA1-2025 / NOM-059-SSA1-2015','g')));
   NEW.datos_snapshot:=jsonb_set(NEW.datos_snapshot,'{registro_at,texto}',NEW.texto);
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.tend_at_apendice_compartido() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_tend_at_apendice_compartido BEFORE INSERT OR UPDATE ON public.tend_registros_at FOR EACH ROW EXECUTE FUNCTION public.tend_at_apendice_compartido();