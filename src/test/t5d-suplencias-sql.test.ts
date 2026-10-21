import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// Live server functions run only against isolated temporary QA tables, rolled back.
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let definitions: string | undefined;
function run(body: string) {
  if (!definitions) definitions = execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], {
    input: `SELECT string_agg(pg_get_functiondef(oid)||';', E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['rol_efectivo','suplencia_contexto','puede_administrar_usuarios','org_suplencias_guard','org_suplencia_titular_snapshot','designar_suplencia','responder_suplencia','terminar_suplencia','tend_suplencia','tend_at_guard','firmar_folio_suplencia','audit_suplencia_contexto','registro_suplencia_contexto','firma_suplencia_identidad']);`, encoding: 'utf8', timeout: 30000,
  }).replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role', 'public.app_role').replaceAll('pg_temp.estado_folio','public.estado_folio').replace(/\b_rol app_role\b/g,'_rol public.app_role').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('auth.role()', 'pg_temp.auth_role()').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
  const tables = ['organizations','profiles','org_members','user_roles','org_suplencias','tend_registros_at','tend_config','tend_instrumentos','folio_comite','folios','audit_trail'];
  const sql = `BEGIN; SET LOCAL check_function_bodies=off;
${tables.map(t=>`CREATE TEMP TABLE ${t} (LIKE public.${t} INCLUDING DEFAULTS);`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name); END LOOP;END $$;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
CREATE FUNCTION pg_temp.auth_role() RETURNS text LANGUAGE sql AS $$SELECT 'authenticated'::text$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(100)}'::uuid$$;
CREATE FUNCTION pg_temp.is_super_admin() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE FUNCTION pg_temp.mi_org_tiene_modulo(text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
CREATE FUNCTION pg_temp.org_suplencias_acceso(uuid,boolean DEFAULT false) RETURNS boolean LANGUAGE sql AS $$SELECT $1=pg_temp.get_user_org_id()$$;
CREATE FUNCTION pg_temp.tend_acceso(uuid,boolean DEFAULT false,text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql AS $$SELECT $1=pg_temp.get_user_org_id() AND ($3 IS NULL OR EXISTS(SELECT 1 FROM unnest($3) r WHERE pg_temp.rol_efectivo(pg_temp.uid(),r::public.app_role)))$$;
CREATE FUNCTION pg_temp.tend_resolver_instrumentos(uuid,jsonb,jsonb) RETURNS jsonb LANGUAGE sql AS $$SELECT $3$$;
${definitions}
INSERT INTO organizations(id,nombre,es_prueba) VALUES('${id(100)}','QA temporal T5d',true);
INSERT INTO profiles(id,nombre,cargo,activo,email) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'QA persona '||i,'QA cargo',true,'qa'||i||'@example.invalid' FROM generate_series(1,6) i;
INSERT INTO org_members(org_id,user_id,role) SELECT '${id(100)}',id,CASE id WHEN '${id(1)}' THEN 'responsable_sanitario'::public.app_role WHEN '${id(2)}' THEN 'admin'::public.app_role ELSE 'operador'::public.app_role END FROM profiles;
SELECT set_config('qa.actor','${id(1)}',true);
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON org_suplencias FOR EACH ROW EXECUTE FUNCTION pg_temp.org_suplencias_guard();
CREATE TRIGGER snapshot BEFORE INSERT OR UPDATE ON org_suplencias FOR EACH ROW EXECUTE FUNCTION pg_temp.org_suplencia_titular_snapshot();
CREATE TRIGGER audit_context BEFORE INSERT ON audit_trail FOR EACH ROW EXECUTE FUNCTION pg_temp.audit_suplencia_contexto();
CREATE TRIGGER at_guard BEFORE INSERT OR UPDATE ON tend_registros_at FOR EACH ROW EXECUTE FUNCTION pg_temp.tend_at_guard();
CREATE TRIGGER firma_identidad BEFORE UPDATE ON folio_comite FOR EACH ROW EXECUTE FUNCTION pg_temp.firma_suplencia_identidad();
${body}
SELECT 'T5d OK';ROLLBACK;`;
  return execFileSync('psql', ['-XqAt','-v','ON_ERROR_STOP=1'], {input:sql,encoding:'utf8',timeout:30000});
}
const designation = (role='responsable_sanitario', actor=3) => `pg_temp.designar_suplencia('${role}','${id(role==='admin'?2:1)}','${id(actor)}',now()-interval '1 hour',now()+interval '1 day','vacaciones','QA motivo')`;
const accept = `PERFORM set_config('qa.actor','${id(3)}',true);PERFORM pg_temp.responder_suplencia(s,true);`;
function check(body: string) { expect(run(`DO $$ DECLARE s uuid;v uuid;failed boolean:=false;BEGIN ${body} END $$;`)).toContain('T5d OK'); }
describe.skipIf(!process.env.PGHOST)('T5d server rules, temporary QA only',()=>{
  it('pending gives neither RS nor administrative permissions',()=>check(`s:=${designation()}; IF pg_temp.rol_efectivo('${id(3)}','responsable_sanitario') THEN RAISE EXCEPTION 'Pending grants RS';END IF;PERFORM set_config('qa.actor','${id(3)}',true);IF pg_temp.puede_administrar_usuarios() THEN RAISE EXCEPTION 'Pending grants administration';END IF;`),30000);
  it('accepted RS authorizes AT and signs the titular assignment, not users administration',()=>check(`s:=${designation()};${accept} IF NOT pg_temp.rol_efectivo('${id(3)}','responsable_sanitario') OR pg_temp.rol_efectivo('${id(3)}','admin') OR pg_temp.puede_administrar_usuarios() THEN RAISE EXCEPTION 'RS isolation failed';END IF;
INSERT INTO tend_instrumentos(id,org_id,activo,spec_estado,area_estado) VALUES('${id(20)}','${id(100)}',true,'validada','validada');
INSERT INTO tend_registros_at(id,org_id,codigo,fecha,estado,instrumentos) VALUES('${id(21)}','${id(100)}','AT-2026-001','2026-07-01','borrador','[{"id":"${id(20)}"}]');
PERFORM set_config('qa.actor','${id(2)}',true);UPDATE tend_registros_at SET texto='QA corrección' WHERE id='${id(21)}';
PERFORM set_config('qa.actor','${id(3)}',true);UPDATE tend_registros_at SET estado='emitido' WHERE id='${id(21)}';
IF NOT EXISTS(SELECT 1 FROM tend_registros_at WHERE id='${id(21)}' AND estado='emitido' AND suplencia_id=s) THEN RAISE EXCEPTION 'AT not issued under substitution';END IF;
INSERT INTO folios(id,org_id,estado,created_by) VALUES('${id(30)}','${id(100)}','En Firma','${id(2)}');
INSERT INTO folio_comite(id,folio_id,user_id,nombre,cargo,firmado) VALUES('${id(31)}','${id(30)}','${id(1)}','Titular QA','Cargo',false);
v:=pg_temp.firmar_folio_suplencia('${id(30)}','QA hash','QA IP','QA agent','QA compromiso');
IF v<>'${id(31)}' OR NOT EXISTS(SELECT 1 FROM folio_comite WHERE id=v AND firmado AND firma_por='${id(3)}' AND firma_suplencia->>'titular_user_id'='${id(1)}' AND nombre='QA persona 3') THEN RAISE EXCEPTION 'Risk signature attribution failed';END IF;
INSERT INTO audit_trail(user_id,org_id,tabla,registro_id,accion) VALUES('${id(3)}','${id(100)}','folios','${id(30)}','QA');
IF NOT EXISTS(SELECT 1 FROM audit_trail WHERE accion='QA' AND suplencias->0->>'titular_user_id'='${id(1)}') THEN RAISE EXCEPTION 'Audit attribution missing';END IF;`),30000);
  it('expired or revoked RS grants no role',()=>check(`s:=pg_temp.designar_suplencia('responsable_sanitario','${id(1)}','${id(3)}',now()-interval '1 hour',now()+interval '1 millisecond','ausencia','QA');PERFORM pg_sleep(0.02); -- transaction now remains fixed, use statement_timestamp through a past fixture instead
ALTER TABLE org_suplencias DISABLE TRIGGER guard;UPDATE org_suplencias SET estado='activa',aceptada_en=now(),fecha_fin=now()-interval '1 second' WHERE id=s;ALTER TABLE org_suplencias ENABLE TRIGGER guard;
IF pg_temp.rol_efectivo('${id(3)}','responsable_sanitario') THEN RAISE EXCEPTION 'Expired grants role';END IF;`),30000);
  it('two overlapping accepted substitutions of the same role are rejected',()=>check(`s:=${designation()};v:=${designation('responsable_sanitario',4)};${accept}PERFORM set_config('qa.actor','${id(4)}',true);BEGIN PERFORM pg_temp.responder_suplencia(v,true);EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Overlapping role accepted';END IF;`),30000);
  it('accepted admin manages users but cannot issue AT',()=>check(`s:=${designation('admin')};${accept}IF NOT pg_temp.rol_efectivo('${id(3)}','admin') OR NOT pg_temp.puede_administrar_usuarios() OR pg_temp.rol_efectivo('${id(3)}','responsable_sanitario') THEN RAISE EXCEPTION 'Admin isolation failed';END IF;
INSERT INTO tend_registros_at(id,org_id,codigo,fecha,estado) VALUES('${id(21)}','${id(100)}','AT-2026-001','2026-07-01','borrador');
BEGIN UPDATE tend_registros_at SET estado='emitido' WHERE id='${id(21)}';EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Admin authorized AT';END IF;`),30000);
  it('reject and early termination retain history and remove permissions, with mandatory reason',()=>check(`s:=${designation()};${accept}BEGIN PERFORM pg_temp.terminar_suplencia(s,'');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Termination without reason';END IF;PERFORM pg_temp.terminar_suplencia(s,'QA regreso');IF pg_temp.rol_efectivo('${id(3)}','responsable_sanitario') OR NOT EXISTS(SELECT 1 FROM org_suplencias WHERE id=s AND estado='terminada' AND motivo_terminacion='QA regreso') THEN RAISE EXCEPTION 'History or permissions incorrect';END IF;
PERFORM set_config('qa.actor','${id(1)}',true);v:=${designation('responsable_sanitario',4)};PERFORM set_config('qa.actor','${id(4)}',true);PERFORM pg_temp.responder_suplencia(v,false);IF pg_temp.rol_efectivo('${id(4)}','responsable_sanitario') THEN RAISE EXCEPTION 'Rejected grants role';END IF;`),30000);
  it('an accepted substitute cannot authorize their own AT or sign their own folio',()=>check(`s:=${designation()};${accept}INSERT INTO tend_registros_at(id,org_id,codigo,fecha,estado) VALUES('${id(21)}','${id(100)}','AT-2026-001','2026-07-01','borrador');BEGIN UPDATE tend_registros_at SET estado='emitido' WHERE id='${id(21)}';EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Self-authorization accepted';END IF;failed:=false;
INSERT INTO folios(id,org_id,estado,created_by) VALUES('${id(30)}','${id(100)}','En Firma','${id(3)}');BEGIN PERFORM pg_temp.firmar_folio_suplencia('${id(30)}','hash','ip','agent','commitment');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Self-signature accepted';END IF;`),30000);
});
