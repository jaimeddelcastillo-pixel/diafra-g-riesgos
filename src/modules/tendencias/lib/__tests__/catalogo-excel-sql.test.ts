import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Exact production import body, isolated in temporary PostgreSQL tables.
 * No production writes or auth impersonation. Production role/RLS is not simulated as verified.
 */
describe.skipIf(!process.env.PGHOST)('T4e transacción PostgreSQL aislada',()=>{
  it('alta, cambio, auditoría motivada, bloqueo y reversión de todas las filas',()=>{
    const original=readFileSync('drizzle/migrations/0070_t4e_catalogo_excel_atomico.sql','utf8');
    const body=original.slice(0,original.indexOf('REVOKE ALL'));
    const setup=`BEGIN;
      CREATE TEMP TABLE tend_sistemas_hvac (LIKE public.tend_sistemas_hvac INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
      CREATE TEMP TABLE tend_areas (LIKE public.tend_areas INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
      CREATE TEMP TABLE tend_instrumentos (LIKE public.tend_instrumentos INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
      CREATE TEMP TABLE tend_objetivos_presion (LIKE public.tend_objetivos_presion INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
      CREATE TEMP TABLE t4e_audit(tabla text,motivo text,antes jsonb,despues jsonb);
      CREATE FUNCTION pg_temp.contexto_org_actual() RETURNS TABLE(org_id uuid) LANGUAGE sql AS 'select id from public.organizations where es_prueba and id=''3868f88a-fa36-4467-9b31-653143c6ef7d''';
      CREATE FUNCTION pg_temp.tend_acceso(uuid,boolean,text[]) RETURNS boolean LANGUAGE sql AS 'select $1 is not null';
      CREATE FUNCTION pg_temp.t4e_auditar() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO t4e_audit VALUES(TG_TABLE_NAME,current_setting('tracea.motivo',true),to_jsonb(OLD),to_jsonb(NEW)); RETURN NEW; END $$;
      CREATE TRIGGER t4e_audit AFTER INSERT OR UPDATE ON tend_sistemas_hvac FOR EACH ROW EXECUTE FUNCTION pg_temp.t4e_auditar();
      ${body.replaceAll('public.','pg_temp.').replace('SET search_path=public','SET search_path=pg_temp,public')}
      ${readFileSync('drizzle/migrations/0071_t4e_catalogo_consistencia_saturacion.sql','utf8').replaceAll('public.','pg_temp.')}
      DO $$ DECLARE org uuid; pkg jsonb; before_count integer; failed boolean:=false; row_before jsonb; BEGIN
        SELECT org_id INTO org FROM pg_temp.contexto_org_actual();
        IF org IS NULL THEN RAISE EXCEPTION 'Prueba requiere empresa es_prueba'; END IF;
        pkg:=jsonb_build_object('version','T4e-1','filas',jsonb_build_array(jsonb_build_object('hoja','Sistemas_HVAC','estado','nuevo','errores','[]'::jsonb,'anterior',null,'valores',jsonb_build_object('codigo','T4E-QA','nombre_uma','Inicial','descripcion','','activo',true))));
        PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba automática T4e');
        IF (SELECT nombre_uma FROM tend_sistemas_hvac WHERE codigo='T4E-QA') IS DISTINCT FROM 'Inicial' THEN RAISE EXCEPTION 'Alta falló'; END IF;
        SELECT to_jsonb(t) INTO row_before FROM tend_sistemas_hvac t WHERE codigo='T4E-QA';
        pkg:=jsonb_set(pkg,'{filas,0,anterior}',row_before);pkg:=jsonb_set(pkg,'{filas,0,estado}','"cambia"');pkg:=jsonb_set(pkg,'{filas,0,valores,nombre_uma}','"Corregida"');
        PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Corrección automática T4e');
        IF (SELECT nombre_uma FROM tend_sistemas_hvac WHERE codigo='T4E-QA') IS DISTINCT FROM 'Corregida' OR (SELECT count(*) FROM t4e_audit WHERE motivo IN ('Prueba automática T4e','Corrección automática T4e'))<>2 THEN RAISE EXCEPTION 'Cambio o auditoría falló'; END IF;
        SELECT count(*) INTO before_count FROM t4e_audit;
        pkg:=jsonb_build_object('version','T4e-1','filas',jsonb_build_array(jsonb_build_object('hoja','Sistemas_HVAC','estado','nuevo','errores','[]'::jsonb,'anterior',null,'valores',jsonb_build_object('codigo','ROLLBACK-QA','nombre_uma','No conservar','descripcion','','activo',true)),jsonb_build_object('hoja','Areas','estado','nuevo','errores','[]'::jsonb,'anterior',null,'valores',jsonb_build_object('codigo','ERROR-QA','nombre','Inválida','iso','ISO-99','activo',true))));
        BEGIN PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba de reversión T4e'); EXCEPTION WHEN check_violation THEN failed:=true; END;
        IF NOT failed OR EXISTS(SELECT 1 FROM tend_sistemas_hvac WHERE codigo='ROLLBACK-QA') OR (SELECT count(*) FROM t4e_audit)<>before_count THEN RAISE EXCEPTION 'Reversión falló'; END IF;
        failed:=false;pkg:=jsonb_set(pkg,'{version}','"otra"');
        BEGIN PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba versión inválida'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Versión inválida aceptada'; END IF;
      END $$;
      SELECT 'T4e SQL OK'; ROLLBACK;`;
    const result=execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-At'],{input:setup,encoding:'utf8',stdio:['pipe','pipe','pipe']});
    expect(result).toContain('T4e SQL OK');
    expect(result.trim().endsWith('ROLLBACK')).toBe(true);
  });
});