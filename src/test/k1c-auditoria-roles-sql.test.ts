import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// K1-c: funciones vivas copiadas a pg_temp sobre tablas temporales con RLS forzada; todo se revierte.
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const ORG = id(100), RS = id(1), SUPLENTE = id(2), ADMIN = id(3), OPERADOR = id(4);
const psql = (input: string) => execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', timeout: 60000 });
let defs: string | undefined;
const FUNCIONES = ['rol_efectivo', 'get_user_org_id', 'is_super_admin', 'puede_ver_auditoria', 'audit_trigger_func', 'org_members_motivo_guard', 'cambiar_rol_miembro'];

function entorno(body: string) {
  defs ??= psql(`SELECT string_agg(pg_get_functiondef(oid)||';', E'\\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['${FUNCIONES.join("','")}']);`)
    .replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role', 'public.app_role').replace(/\b_rol app_role\b/g, '_rol public.app_role')
    .replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
  const tablas = ['organizations', 'profiles', 'org_members', 'user_roles', 'org_suplencias', 'impersonation_logs', 'audit_trail'];
  return psql(`BEGIN; SET LOCAL check_function_bodies=off;
${tablas.map((t) => `CREATE TEMP TABLE ${t} (LIKE public.${t} INCLUDING DEFAULTS INCLUDING INDEXES);`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' AND column_name NOT IN ('id','created_at') LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name); END LOOP;END $$;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
${defs}
CREATE TRIGGER g BEFORE UPDATE OR DELETE ON pg_temp.org_members FOR EACH ROW EXECUTE FUNCTION pg_temp.org_members_motivo_guard();
CREATE TRIGGER a AFTER INSERT OR UPDATE OR DELETE ON pg_temp.org_members FOR EACH ROW EXECUTE FUNCTION pg_temp.audit_trigger_func();
INSERT INTO organizations(id,nombre,es_prueba) VALUES('${ORG}','QA temporal K1-c',true);
INSERT INTO profiles(id,nombre,activo,email,org_activa_id) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'QA '||i,true,'qa'||i||'@example.invalid','${ORG}' FROM generate_series(1,4) i;
INSERT INTO org_members(org_id,user_id,role) VALUES('${ORG}','${RS}','responsable_sanitario'),('${ORG}','${SUPLENTE}','operador'),('${ORG}','${ADMIN}','admin'),('${ORG}','${OPERADOR}','operador');
INSERT INTO org_suplencias(org_id,titular_user_id,rs_titular_user_id,suplente_user_id,rol_sustituido,estado,aceptada_en,fecha_inicio,fecha_fin)
  VALUES('${ORG}','${RS}','${RS}','${SUPLENTE}','responsable_sanitario','activa',now(),now()-interval '1 day',now()+interval '7 days');
DELETE FROM audit_trail WHERE true;
${body}
SELECT 'K1-c OK';ROLLBACK;`);
}
// Expresión de la política «Org admin read audit» (el rol de pruebas omite RLS, por eso se aplica explícita y se compara con la viva).
const POLITICA = "((org_id = (SELECT pg_temp.get_user_org_id()) AND (SELECT pg_temp.puede_ver_auditoria((SELECT pg_temp.get_user_org_id())))) OR (SELECT pg_temp.is_super_admin()))";
const check = (body: string) => expect(entorno(`DO $$ DECLARE failed boolean:=false;BEGIN ${body} END $$;`)).toContain('K1-c OK');

describe.skipIf(!process.env.PGHOST)('K1-c auditoría rápida y trazabilidad de roles (QA temporal)', () => {
  it('5 000 eventos: el suplente de RS filtra en < 2 s y el rol se evalúa una sola vez (InitPlan)', () => {
    const out = entorno(`
INSERT INTO audit_trail(org_id,tabla,registro_id,accion,valor_nuevo,created_at)
  SELECT '${ORG}',(ARRAY['puestos','kpi_definiciones','kpi_puesto','folios','riesgos'])[1+i%5],i::text,'INSERT',jsonb_build_object('codigo','K'||i),
         timestamptz '2026-10-01' + (i||' minutes')::interval FROM generate_series(1,5000) i;
ANALYZE audit_trail;
SELECT set_config('qa.actor','${SUPLENTE}',true);
EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM audit_trail WHERE ${POLITICA} AND org_id='${ORG}' AND tabla IN ('puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta')
  AND created_at >= '2026-10-02' AND created_at <= '2026-10-05' ORDER BY created_at DESC, id DESC LIMIT 51;
SELECT 'FILAS:'||count(*) FROM audit_trail WHERE ${POLITICA} AND tabla='puestos';`);
    const plan = JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1));
    expect(plan[0]['Execution Time']).toBeLessThan(2000);
    const texto = JSON.stringify(plan);
    expect(texto).toContain('InitPlan');
    expect(texto).not.toMatch(/"Filter":"[^"]*(has_role|rol_efectivo|puede_ver_auditoria)\(/);
    expect(out).toContain('FILAS:1000'); // el suplente de RS sí ve los eventos
  }, 60000);

  it('la política viva usa exactamente esa expresión, con subconsultas de una sola evaluación', () => {
    const viva = psql(`SELECT pg_get_expr(polqual,polrelid) FROM pg_policy WHERE polrelid='public.audit_trail'::regclass AND polcmd='r';`).trim();
    const norm = (x: string) => x.replace(/ AS \w+/g, '').replace(/[\s()]/g, '');
    expect(norm(viva)).toBe(norm(POLITICA.replaceAll('pg_temp.', '')));
    expect(viva).not.toMatch(/has_role|rol_efectivo/);
  });

  it('sin suplencia ni rol permitido no ve nada (mismas reglas que antes)', () => check(`
PERFORM set_config('qa.actor','${OPERADOR}',true);
IF pg_temp.puede_ver_auditoria('${ORG}') THEN RAISE EXCEPTION 'Operador ve auditoría'; END IF;
PERFORM set_config('qa.actor','${SUPLENTE}',true);
IF NOT pg_temp.puede_ver_auditoria('${ORG}') THEN RAISE EXCEPTION 'Suplente RS no ve auditoría'; END IF;`));

  it('cambio de rol sin motivo se rechaza; con motivo queda con antes → después', () => check(`
PERFORM set_config('qa.actor','${ADMIN}',true);
BEGIN UPDATE org_members SET role='comite_tecnico' WHERE user_id='${OPERADOR}' AND org_id='${ORG}'; EXCEPTION WHEN check_violation THEN failed:=true; END;
IF NOT failed THEN RAISE EXCEPTION 'Cambio de rol sin motivo aceptado'; END IF;
failed:=false;
BEGIN PERFORM pg_temp.cambiar_rol_miembro('${OPERADOR}','comite_tecnico','abc'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
IF NOT failed THEN RAISE EXCEPTION 'Motivo corto aceptado'; END IF;
PERFORM pg_temp.cambiar_rol_miembro('${OPERADOR}','comite_tecnico','Reasignación QA');
IF NOT EXISTS(SELECT 1 FROM audit_trail WHERE tabla='org_members' AND accion='UPDATE' AND motivo='Reasignación QA'
  AND valor_anterior->>'role'='operador' AND valor_nuevo->>'role'='comite_tecnico' AND user_id='${ADMIN}') THEN RAISE EXCEPTION 'Cambio de rol no auditado'; END IF;
failed:=false;
BEGIN DELETE FROM org_members WHERE user_id='${OPERADOR}' AND org_id='${ORG}'; EXCEPTION WHEN check_violation THEN failed:=true; END;
IF NOT failed THEN RAISE EXCEPTION 'Baja sin motivo aceptada'; END IF;`));
});

describe.skipIf(!process.env.PGHOST)('K1-c línea base de roles (datos reales, solo lectura)', () => {
  it('cada miembro de cada empresa tiene línea base o alta auditada', () => {
    const faltan = psql(`SELECT count(*) FROM public.org_members m WHERE NOT EXISTS (SELECT 1 FROM public.audit_trail a
      WHERE a.tabla='org_members' AND a.registro_id=m.id::text AND (a.accion='LINEA_BASE_ROLES' AND a.motivo='Inicio de trazabilidad de roles' OR a.accion='INSERT'));`).trim();
    expect(faltan).toBe('0');
  });
});
