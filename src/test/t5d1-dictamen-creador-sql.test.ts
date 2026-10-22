import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// T5d-1: live server functions run only against isolated temporary QA tables, rolled back.
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let definitions: string | undefined;
function run(body: string) {
  if (!definitions) definitions = execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], {
    input: `SELECT string_agg(pg_get_functiondef(oid)||';', E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['rol_efectivo','suplencia_contexto','firmar_folio_suplencia','dictaminar_folio_efectivo']);`, encoding: 'utf8', timeout: 30000,
  }).replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role', 'public.app_role').replaceAll('pg_temp.estado_folio','public.estado_folio').replace(/\b_rol app_role\b/g,'_rol public.app_role').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('auth.role()', 'pg_temp.auth_role()').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
  const tables = ['organizations','profiles','org_members','user_roles','org_suplencias','folio_comite','folios','audit_trail'];
  const sql = `BEGIN; SET LOCAL check_function_bodies=off;
${tables.map(t=>`CREATE TEMP TABLE ${t} (LIKE public.${t} INCLUDING DEFAULTS);`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name); END LOOP;END $$;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
CREATE FUNCTION pg_temp.auth_role() RETURNS text LANGUAGE sql AS $$SELECT 'authenticated'::text$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(100)}'::uuid$$;
CREATE FUNCTION pg_temp.is_super_admin() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE FUNCTION pg_temp.mi_org_tiene_modulo(text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
${definitions}
INSERT INTO organizations(id,nombre,es_prueba) VALUES('${id(100)}','QA temporal T5d-1',true);
INSERT INTO profiles(id,nombre,cargo,activo,email) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'QA persona '||i,'QA cargo',true,'qa'||i||'@example.invalid' FROM generate_series(1,4) i;
INSERT INTO org_members(org_id,user_id,role) SELECT '${id(100)}',id,CASE id WHEN '${id(1)}' THEN 'responsable_sanitario'::public.app_role WHEN '${id(2)}' THEN 'admin'::public.app_role ELSE 'operador'::public.app_role END FROM profiles;
${body}
SELECT 'T5d-1 OK';ROLLBACK;`;
  return execFileSync('psql', ['-XqAt','-v','ON_ERROR_STOP=1'], {input:sql,encoding:'utf8',timeout:30000});
}
function check(body: string) { expect(run(`DO $$ DECLARE failed boolean:=false;BEGIN ${body} END $$;`)).toContain('T5d-1 OK'); }
describe.skipIf(!process.env.PGHOST)('T5d-1 creator signature and dictamen, temporary QA only',()=>{
  it('creator who is a committee member signs as usual',()=>check(`
INSERT INTO folios(id,org_id,estado,created_by) VALUES('${id(30)}','${id(100)}','En Firma','${id(2)}');
INSERT INTO folio_comite(id,folio_id,user_id,nombre,cargo,firmado) VALUES('${id(31)}','${id(30)}','${id(2)}','Creador QA','Cargo',false);
PERFORM set_config('qa.actor','${id(2)}',true);
IF pg_temp.firmar_folio_suplencia('${id(30)}','QA hash','QA IP','QA agent','QA compromiso')<>'${id(31)}' THEN RAISE EXCEPTION 'Creator signature rejected';END IF;
IF NOT EXISTS(SELECT 1 FROM folio_comite WHERE id='${id(31)}' AND firmado AND firma_por='${id(2)}') THEN RAISE EXCEPTION 'Creator signature not recorded';END IF;`),30000);
  it('RS creator approves with mandatory reason, flagged and audited',()=>check(`
INSERT INTO folios(id,org_id,estado,created_by) VALUES('${id(30)}','${id(100)}','En Firma','${id(1)}');
PERFORM set_config('qa.actor','${id(1)}',true);
PERFORM pg_temp.dictaminar_folio_efectivo('${id(30)}','Aprobado','autoemisión en empresa pequeña');
IF NOT EXISTS(SELECT 1 FROM folios WHERE id='${id(30)}' AND estado='Aprobado' AND dictamen_autoemitido AND dictamen_por='${id(1)}') THEN RAISE EXCEPTION 'Creator dictamen not applied';END IF;
IF NOT EXISTS(SELECT 1 FROM audit_trail WHERE registro_id='${id(30)}' AND accion='DICTAMEN' AND motivo='autoemisión en empresa pequeña' AND valor_nuevo->>'autoemitido'='true') THEN RAISE EXCEPTION 'Creator dictamen not audited';END IF;`),30000);
  it('creator dictamen without reason is rejected',()=>check(`
INSERT INTO folios(id,org_id,estado,created_by) VALUES('${id(30)}','${id(100)}','En Firma','${id(1)}');
PERFORM set_config('qa.actor','${id(1)}',true);
BEGIN PERFORM pg_temp.dictaminar_folio_efectivo('${id(30)}','Aprobado','');EXCEPTION WHEN raise_exception THEN failed:=true;END;
IF NOT failed THEN RAISE EXCEPTION 'Creator dictamen without reason accepted';END IF;
IF EXISTS(SELECT 1 FROM folios WHERE id='${id(30)}' AND estado='Aprobado') THEN RAISE EXCEPTION 'Folio changed despite rejection';END IF;`),30000);
  it('non-creator approval without reason still works',()=>check(`
INSERT INTO folios(id,org_id,estado,created_by) VALUES('${id(30)}','${id(100)}','En Firma','${id(2)}');
PERFORM set_config('qa.actor','${id(1)}',true);
PERFORM pg_temp.dictaminar_folio_efectivo('${id(30)}','Aprobado','');
IF NOT EXISTS(SELECT 1 FROM folios WHERE id='${id(30)}' AND estado='Aprobado' AND NOT dictamen_autoemitido) THEN RAISE EXCEPTION 'Non-creator dictamen broke';END IF;`),30000);
});
