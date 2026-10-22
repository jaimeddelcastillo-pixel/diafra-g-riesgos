import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let definitions: string | undefined;
const tablas = ['organizations','profiles','org_members','user_roles','org_suplencias','audit_trail','puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta','org_pendientes_semaforo','tend_registros_at','tend_registros','tend_semanas','riesgos','folios','brain_knowledge_items'];
const paquete = JSON.stringify({ Puestos: [{ codigo: 'AC', nombre: 'QA Calidad', area: 'QA', activo: true }], KPI_SGC: [{ codigo: '1', nombre: 'QA cumplimiento', puesto: 'AC', formula: 'a/b', nivel: 'SGC', frecuencia: 'mensual', tendencia: 'positiva', meta: 95, unidad: '%', peso: 100, activo: true }], KPI_Puesto: [{ codigo: 'F1', puesto: 'AC', nombre: 'QA seguimiento', formula: 'a/b', frecuencia: 'mensual', tendencia: 'positiva', meta: 95, unidad: '%', peso: 100, aporta_a: '1', activo: true }] });
function run(body: string) {
  if (!definitions) definitions = execFileSync('psql', ['-XqAt','-v','ON_ERROR_STOP=1'], { input: `SELECT string_agg(pg_get_functiondef(oid)||';', E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['rol_efectivo','puede_administrar_usuarios','kpi_acceso','kpi_guard','kpi_aplicar_interno','aplicar_kpis_excel','guardar_kpis','validar_kpi','audit_trigger_func','audit_suplencia_contexto','suplencia_contexto','org_suplencias_guard','designar_suplencia','responder_suplencia','pendientes_color','pendientes_usuario']);`, encoding: 'utf8', timeout: 30000 })
    .replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role','public.app_role').replace(/\b_rol app_role\b/g,'_rol public.app_role').replaceAll('auth.uid()','pg_temp.uid()').replaceAll('auth.role()','pg_temp.auth_role()').replaceAll('SECURITY DEFINER','').replaceAll("SET search_path TO 'public'",'SET search_path TO pg_temp,public');
  const sql = `BEGIN;SET LOCAL check_function_bodies=off;
${tablas.map(t => `CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING DEFAULTS ${['puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta'].includes(t) ? 'INCLUDING INDEXES' : ''});`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' AND table_name NOT IN ('puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta') LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name);END LOOP;END $$;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
CREATE FUNCTION pg_temp.auth_role() RETURNS text LANGUAGE sql AS $$SELECT 'authenticated'::text$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(100)}'::uuid$$;
CREATE FUNCTION pg_temp.is_super_admin() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE FUNCTION pg_temp.contexto_org_actual() RETURNS TABLE(org_id uuid,rol_en_org text,es_super_admin boolean,soporte_log_id uuid) LANGUAGE sql AS $$SELECT pg_temp.get_user_org_id(),NULL::text,false,NULL::uuid$$;
CREATE FUNCTION pg_temp.org_tiene_modulo(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('qa.sin_'||$2,true),'')<>'1'$$;
CREATE FUNCTION pg_temp.org_suplencias_acceso(uuid,boolean DEFAULT false) RETURNS boolean LANGUAGE sql AS $$SELECT $1=pg_temp.get_user_org_id()$$;
${definitions}
INSERT INTO organizations(id,nombre,es_prueba) VALUES('${id(100)}','QA temporal K1',true);
INSERT INTO profiles(id,nombre,cargo,activo,email,perfil_confirmado_en) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'QA persona '||i,'QA cargo',true,'qa'||i||'@example.invalid',now() FROM generate_series(1,5) i;
INSERT INTO org_members(org_id,user_id,role) SELECT '${id(100)}',id,CASE id WHEN '${id(1)}' THEN 'responsable_sanitario'::public.app_role WHEN '${id(2)}' THEN 'admin'::public.app_role WHEN '${id(3)}' THEN 'aseguramiento_calidad'::public.app_role ELSE 'operador'::public.app_role END FROM profiles;
SELECT set_config('qa.actor','${id(2)}',true);
${['puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta'].map(t => `CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION pg_temp.kpi_guard();CREATE TRIGGER audit AFTER INSERT OR UPDATE ON ${t} FOR EACH ROW EXECUTE FUNCTION pg_temp.audit_trigger_func();`).join('\n')}
CREATE TRIGGER suplencias_guard BEFORE INSERT OR UPDATE OR DELETE ON org_suplencias FOR EACH ROW EXECUTE FUNCTION pg_temp.org_suplencias_guard();
CREATE TRIGGER audit_context BEFORE INSERT ON audit_trail FOR EACH ROW EXECUTE FUNCTION pg_temp.audit_suplencia_contexto();
DO $$ DECLARE k uuid;s uuid;failed boolean:=false;BEGIN ${body} END $$;
SELECT 'K1 OK';ROLLBACK;`;
  return execFileSync('psql',['-XqAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:30000});
}
const importar = `PERFORM pg_temp.aplicar_kpis_excel('${paquete}'::jsonb,'QA importación');SELECT id INTO k FROM kpi_definiciones WHERE codigo='1';`;
const actor = (n: number) => `PERFORM set_config('qa.actor','${id(n)}',true);`;
function check(body: string) { expect(run(body)).toContain('K1 OK'); }
describe.skipIf(!process.env.PGHOST)('K1 reglas servidor, QA temporal con rollback', () => {
  it('importa puestos, KPI y aporta_a con auditoría motivada', () => check(`${importar}IF (SELECT count(*) FROM puestos)<>1 OR (SELECT count(*) FROM kpi_definiciones)<>1 OR (SELECT count(*) FROM kpi_puesto)<>1 OR (SELECT count(*) FROM kpi_puesto_aporta WHERE activo)<>1 THEN RAISE EXCEPTION 'Importación incompleta';END IF;IF NOT EXISTS(SELECT 1 FROM audit_trail WHERE tabla='kpi_definiciones' AND motivo='QA importación' AND valor_nuevo->>'estado'='borrador') THEN RAISE EXCEPTION 'Auditoría ausente';END IF;`));
  for (const [campo, valor] of [['formula', "'a/c'"], ['meta','90'], ['tendencia',"'negativa'"], ['unidad',"'días'"]]) it(`cambio de ${campo} validado regresa a borrador`, () => check(`${importar}${actor(3)}PERFORM pg_temp.validar_kpi('kpi_definiciones',k,'QA validar');UPDATE kpi_definiciones SET ${campo}=${valor} WHERE id=k;IF NOT EXISTS(SELECT 1 FROM kpi_definiciones WHERE id=k AND estado='borrador' AND validado_por IS NULL AND validado_en IS NULL) THEN RAISE EXCEPTION 'No regresó a borrador';END IF;`));
  it('cambio no crítico conserva validación manual', () => check(`${importar}${actor(3)}PERFORM pg_temp.validar_kpi('kpi_definiciones',k,'QA validar');PERFORM pg_temp.guardar_kpis(jsonb_build_object('KPI_SGC',jsonb_build_array(jsonb_build_object('codigo','1','nombre','QA cambiado','puesto','AC','formula','a/b','nivel','SGC','frecuencia','mensual','tendencia','positiva','meta',95,'unidad','%','peso',100))),'QA nombre');IF NOT EXISTS(SELECT 1 FROM kpi_definiciones WHERE id=k AND estado='validado' AND nombre='QA cambiado') THEN RAISE EXCEPTION 'Perdió validación';END IF;`));
  it('error de referencia bloquea y revierte toda la importación', () => check(`BEGIN PERFORM pg_temp.aplicar_kpis_excel(replace('${paquete}','"aporta_a":"1"','"aporta_a":"NO"')::jsonb,'QA error');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed OR EXISTS(SELECT 1 FROM puestos) OR EXISTS(SELECT 1 FROM audit_trail) THEN RAISE EXCEPTION 'No fue atómico';END IF;`));
  it('retiro conserva registro e historial; DELETE prohibido', () => check(`${importar}PERFORM pg_temp.guardar_kpis('{