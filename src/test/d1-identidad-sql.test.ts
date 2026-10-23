import { execFileSync, spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
vi.setConfig({ testTimeout: 120000 });
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let defs: string | undefined;
function run(body: string) {
  if (!defs) defs = execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input: `SELECT string_agg(pg_get_functiondef(oid)||';',E'\\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['documental_solo_insercion','documental_puede_editar','guardar_identidad_documental','guardar_formato_documento','registrar_documento_generado']);`, encoding: 'utf8', timeout: 60000 })
    .replaceAll('public.', 'pg_temp.').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
  const sql = `BEGIN;SET LOCAL check_function_bodies=off;
CREATE TEMP TABLE org_identidad_documental(LIKE public.org_identidad_documental INCLUDING ALL);
CREATE TEMP TABLE org_formatos(LIKE public.org_formatos INCLUDING ALL);
CREATE TEMP TABLE documentos_generados(LIKE public.documentos_generados INCLUDING ALL);
CREATE TEMP SEQUENCE documentos_generados_folio_seq;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(100)}'::uuid$$;
CREATE FUNCTION pg_temp.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT $2::text=current_setting('qa.rol',true)$$;
${defs}
${['org_identidad_documental', 'org_formatos', 'documentos_generados'].map(t => `CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION pg_temp.documental_solo_insercion();`).join('\n')}
SELECT set_config('qa.actor','${id(1)}',true);SELECT set_config('qa.rol','aseguramiento_calidad',true);
DO $$ DECLARE d jsonb; d2 jsonb; failed boolean:=false; BEGIN ${body} END $$;
SELECT 'D1 OK';ROLLBACK;`;
  return new Promise<string>((resolve, reject) => {
    const child = spawn('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1']); let out = ''; let err = '';
    child.stdout.on('data', x => { out += String(x); }); child.stderr.on('data', x => { err += String(x); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err))); child.stdin.end(sql);
  });
}
const check = async (body: string) => expect(await run(body)).toContain('D1 OK');
const formato = (codigo: string, motivo: string) => `PERFORM pg_temp.guardar_formato_documento('indicadores.resultados_excel','${codigo}','01','Resultados','[{"rol":"Elaboró","nombre":"QA","cargo":"AC"}]'::jsonb,'2026-01-01',${motivo});`;
describe.skipIf(!process.env.PGHOST)('D1 identidad documental, QA temporal con rollback', () => {
  it('una versión nueva de un formato no altera los documentos ya registrados', () => check(`
PERFORM pg_temp.guardar_identidad_documental('QA Razón','Calle 1','Confidencial','Documento controlado','Pie','QA identidad');
${formato('FOR-QA-01', "'QA versión 1'")}
d:=pg_temp.registrar_documento_generado('indicadores.resultados_excel','a.xlsx');
IF d->>'folio' !~ '^DOC-[0-9]{4}-[0-9]{6}$' OR d->'formato'->>'codigo'<>'FOR-QA-01' OR d->'identidad'->>'razon_social'<>'QA Razón' THEN RAISE EXCEPTION 'Registro incorrecto %',d;END IF;
${formato('FOR-QA-02', "'QA versión 2'")}
IF (SELECT count(*) FROM org_formatos)<>2 OR NOT EXISTS(SELECT 1 FROM documentos_generados g JOIN org_formatos f ON f.id=g.formato_id WHERE g.folio=d->>'folio' AND g.formato_version=1 AND f.codigo='FOR-QA-01') THEN RAISE EXCEPTION 'Documento previo alterado';END IF;
d2:=pg_temp.registrar_documento_generado('indicadores.resultados_excel','b.xlsx');IF d2->'formato'->>'codigo'<>'FOR-QA-02' OR d2->>'folio'=d->>'folio' THEN RAISE EXCEPTION 'No tomó la vigente';END IF;
BEGIN UPDATE documentos_generados SET formato_version=2 WHERE folio=d->>'folio';EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Documento modificable';END IF;
failed:=false;BEGIN UPDATE org_formatos SET codigo='X' WHERE version=1;EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Formato modificable';END IF;`));
  it('cambiar un formato o la identidad sin motivo se rechaza; operador no edita', () => check(`
BEGIN ${formato('FOR-QA-01', "''")} EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed OR EXISTS(SELECT 1 FROM org_formatos) THEN RAISE EXCEPTION 'Formato sin motivo aceptado';END IF;
failed:=false;BEGIN PERFORM pg_temp.guardar_identidad_documental('QA','','','Documento controlado','','abc');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Identidad sin motivo aceptada';END IF;
PERFORM set_config('qa.rol','operador',true);failed:=false;BEGIN ${formato('FOR-QA-01', "'QA operador'")} EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Operador editó formato';END IF;
d:=pg_temp.registrar_documento_generado('auditoria.bitacora_pdf','x.pdf');IF d->'formato' IS DISTINCT FROM 'null'::jsonb AND d->'formato' IS NOT NULL THEN RAISE EXCEPTION 'Formato inesperado';END IF;`));
});
