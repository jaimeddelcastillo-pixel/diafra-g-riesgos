import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const qa = '00000000-0000-0000-0000-000000000100';
const actor = '00000000-0000-0000-0000-000000000001';
describe.skipIf(!process.env.PGHOST)('D1-a originales, QA temporal con rollback', () => {
  it('solo confirma archivo completo propio, conserva versiones y rechaza modificaciones', () => {
    const defs = execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input: "SELECT string_agg(pg_get_functiondef(oid)||';',E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('preparar_documento_archivo','confirmar_documento_archivo','documental_solo_insercion','guardar_formato_documento');", encoding: 'utf8' }).replaceAll('public.', 'pg_temp.').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('storage.objects', 'pg_temp.objects').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
    const sql = `BEGIN; SET LOCAL check_function_bodies=off;
CREATE TEMP TABLE organizations(id uuid,nombre text,logo_url text,es_prueba boolean);
CREATE TEMP TABLE profiles(id uuid,nombre text,email text,cargo text);
CREATE TEMP TABLE org_formatos(LIKE public.org_formatos INCLUDING ALL);
CREATE TEMP TABLE org_identidad_documental(LIKE public.org_identidad_documental INCLUDING ALL);
CREATE TEMP TABLE documentos_generados(LIKE public.documentos_generados INCLUDING ALL);
CREATE TEMP TABLE documento_reservas(LIKE public.documento_reservas INCLUDING ALL);
CREATE TEMP TABLE objects(bucket_id text,name text,owner_id text);
CREATE TEMP SEQUENCE documentos_generados_folio_seq;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${actor}'::uuid $$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${qa}'::uuid $$;
CREATE FUNCTION pg_temp.documental_puede_editar() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
${defs}
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON documentos_generados FOR EACH ROW EXECUTE FUNCTION pg_temp.documental_solo_insercion();
INSERT INTO organizations VALUES('${qa}','Empresa QA',NULL,true);
INSERT INTO profiles VALUES('${actor}','QA Generador','qa@example.invalid','Analista QA');
DO $$ DECLARE reg jsonb; failed boolean:=false; sha text:=repeat('a',64); BEGIN
INSERT INTO org_formatos(org_id,tipo,version,firmas,motivo) VALUES('${qa}','auditoria.bitacora_pdf',1,'[{"rol":"Elaboró","nombre":"Histórico","cargo":"Anterior"}]','QA histórico');
PERFORM pg_temp.guardar_formato_documento('auditoria.bitacora_pdf','','02','QA','[{"rol":"Elaboró","nombre":"No guardar","cargo":"Analista","aplica":true}]',NULL,'QA nuevos puestos');
IF (SELECT firmas->0->>'nombre' FROM org_formatos WHERE version=1)<>'Histórico' OR (SELECT firmas->0 ? 'nombre' FROM org_formatos WHERE version=2) THEN RAISE EXCEPTION 'Nombres históricos o nuevos alterados'; END IF;
reg:=pg_temp.preparar_documento_archivo('auditoria.bitacora_pdf','qa.pdf');
IF reg->'generador'->>'nombre'<>'QA Generador' OR reg->'generador'->>'cargo'<>'Analista QA' OR reg->>'archivo_path' NOT LIKE '${qa}/2026/DOC-2026-%.pdf' THEN RAISE EXCEPTION 'Reserva inválida %',reg; END IF;
BEGIN PERFORM pg_temp.confirmar_documento_archivo(reg->>'folio',sha); EXCEPTION WHEN raise_exception THEN failed:=true; END;
IF NOT failed OR EXISTS(SELECT 1 FROM documentos_generados) THEN RAISE EXCEPTION 'Publicó sin archivo'; END IF;
INSERT INTO objects VALUES('documentos-generados',reg->>'archivo_path','${actor}');
PERFORM pg_temp.confirmar_documento_archivo(reg->>'folio',sha); PERFORM pg_temp.confirmar_documento_archivo(reg->>'folio',sha);
IF (SELECT count(*) FROM documentos_generados)<>1 OR NOT EXISTS(SELECT 1 FROM documentos_generados WHERE formato_version=2 AND archivo_sha256=sha) THEN RAISE EXCEPTION 'Original duplicado o sin versiones'; END IF;
failed:=false; BEGIN UPDATE documentos_generados SET archivo_sha256=repeat('b',64); EXCEPTION WHEN raise_exception THEN failed:=true; END;
IF NOT failed THEN RAISE EXCEPTION 'Original modificable'; END IF;
END $$; SELECT 'D1-a OK'; ROLLBACK;`;
    expect(execFileSync('psql', ['-XqAt','-v','ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', timeout: 60000 })).toContain('D1-a OK');
  });
});
