import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { colorPendiente, ordenarPendientes, type Pendiente } from '@/lib/pendientes';
// Live server functions run only against isolated temporary QA tables, rolled back.
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let definitions: string | undefined;
function run(body: string) {
  if (!definitions) definitions = execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], {
    input: `SELECT string_agg(pg_get_functiondef(oid)||';', E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['rol_efectivo','pendientes_color','pendientes_usuario','tend_usuarios_firmantes','tend_firmante_autorizante']);`, encoding: 'utf8', timeout: 30000,
  }).replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role', 'public.app_role').replace(/\b_rol app_role\b/g, '_rol public.app_role').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
  const tables = ['organizations', 'profiles', 'org_members', 'org_suplencias', 'org_pendientes_semaforo', 'tend_registros_at', 'tend_registros', 'tend_semanas', 'riesgos', 'folios', 'brain_knowledge_items', 'kpi_definiciones', 'kpi_puesto'];
  const sql = `BEGIN; SET LOCAL check_function_bodies=off;
${tables.map(t => `CREATE TEMP TABLE ${t} (LIKE public.${t} INCLUDING DEFAULTS);`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name); END LOOP;END $$;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(100)}'::uuid$$;
CREATE FUNCTION pg_temp.org_tiene_modulo(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('qa.sin_'||$2,true),'')<>'1'$$;
CREATE FUNCTION pg_temp.tend_acceso(uuid,boolean DEFAULT false,text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql AS $$SELECT $1=pg_temp.get_user_org_id()$$;
${definitions}
INSERT INTO organizations(id,nombre,es_prueba) VALUES('${id(100)}','QA temporal P1',true);
INSERT INTO profiles(id,nombre,cargo,activo,email,perfil_confirmado_en) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'QA persona '||i,'QA cargo',true,'qa'||i||'@example.invalid',CASE WHEN i=4 THEN NULL ELSE now() END FROM generate_series(1,4) i;
INSERT INTO org_members(org_id,user_id,role) SELECT '${id(100)}',id,CASE id WHEN '${id(1)}' THEN 'responsable_sanitario'::public.app_role WHEN '${id(2)}' THEN 'admin'::public.app_role ELSE 'operador'::public.app_role END FROM profiles;
INSERT INTO tend_registros_at(id,org_id,codigo,estado,created_at) VALUES('${id(200)}','${id(100)}','AT-QA-1','borrador',now());
SELECT set_config('qa.actor','${id(1)}',true);
${body}
SELECT 'P1 OK';ROLLBACK;`;
  return execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', timeout: 30000 });
}
function check(body: string) { expect(run(`DO $$ BEGIN ${body} END $$;`)).toContain('P1 OK'); }
const tiene = (tipo: string, extra = 'true') => `EXISTS(SELECT 1 FROM pg_temp.pendientes_usuario('mio') p WHERE p.tipo='${tipo}' AND ${extra})`;
const actor = (n: number) => `PERFORM set_config('qa.actor','${id(n)}',true);`;

describe('P1 semáforo (misma regla que el servidor)', () => {
  it('operativo: verde 0-2, naranja 3-6, rojo 7+', () => {
    expect([0, 2, 3, 6, 7].map(d => colorPendiente('operativo', d, false))).toEqual(['verde', 'verde', 'naranja', 'naranja', 'rojo']);
  });
  it('gestión: verde 0-9, naranja 10-19, rojo 20+', () => {
    expect([9, 10, 19, 20].map(d => colorPendiente('gestion', d, false))).toEqual(['verde', 'naranja', 'naranja', 'rojo']);
  });
  it('fecha límite vencida siempre es rojo', () => expect(colorPendiente('gestion', 0, true)).toBe('rojo'));
  it('rojos primero', () => {
    const p = (color: Pendiente['color'], dias: number) => ({ color, dias, titulo: color } as Pendiente);
    expect(ordenarPendientes([p('verde', 1), p('rojo', 8), p('naranja', 4)]).map(x => x.color)).toEqual(['rojo', 'naranja', 'verde']);
  });
});

describe.skipIf(!process.env.PGHOST)('P1 pendientes_usuario, temporary QA only', () => {
  it('AT en borrador aparece al RS y desaparece al emitirse', () => check(`
    IF NOT ${tiene('at_borrador')} THEN RAISE EXCEPTION 'RS no ve AT borrador'; END IF;
    UPDATE tend_registros_at SET estado='emitido';
    IF ${tiene('at_borrador')} THEN RAISE EXCEPTION 'AT emitido sigue pendiente'; END IF;`), 30000);

  it('semana terminada sin captura aparece en rojo a los 7 días', () => check(`
    INSERT INTO tend_registros(id,org_id,nombre,activo,created_at) VALUES('${id(300)}','${id(100)}','REG-QA',true,(date_trunc('week',now() AT TIME ZONE 'America/Mexico_City')-interval '14 day') AT TIME ZONE 'America/Mexico_City');
    ${actor(3)}
    IF NOT ${tiene('semana_sin_captura', "p.dias>=7 AND p.color='rojo'")} THEN RAISE EXCEPTION 'Semana sin captura no está roja a los 7 días'; END IF;
    INSERT INTO tend_semanas(org_id,registro_id,semana_inicio,activo,lecturas) VALUES('${id(100)}','${id(300)}',(date_trunc('week',now() AT TIME ZONE 'America/Mexico_City')-interval '14 day')::date,true,'[]');
    IF ${tiene('semana_sin_captura', "p.dias>=7")} THEN RAISE EXCEPTION 'Semana capturada sigue pendiente'; END IF;
    IF pg_temp.pendientes_color('operativo',6,false,3,7,10,20)<>'naranja' THEN RAISE EXCEPTION 'Día 6 debe ser naranja'; END IF;`), 30000);

  it('sin el módulo no se ven sus pendientes', () => check(`
    PERFORM set_config('qa.sin_tendencias','1',true);
    IF ${tiene('at_borrador')} THEN RAISE EXCEPTION 'Pendiente de módulo inactivo visible'; END IF;`), 30000);

  it('el suplente aceptado ve los del RS; sin aceptar no', () => check(`
    ${actor(3)}
    IF ${tiene('at_borrador')} THEN RAISE EXCEPTION 'Operador ve AT sin suplencia'; END IF;
    INSERT INTO org_suplencias(id,org_id,rol_sustituido,titular_user_id,suplente_user_id,estado,fecha_inicio,fecha_fin) VALUES('${id(400)}','${id(100)}','responsable_sanitario','${id(1)}','${id(3)}','pendiente de aceptación',now()-interval '1 hour',now()+interval '1 day');
    IF ${tiene('at_borrador')} THEN RAISE EXCEPTION 'Suplencia sin aceptar da pendientes'; END IF;
    IF NOT ${tiene('suplencia_por_aceptar')} THEN RAISE EXCEPTION 'Suplente no ve suplencia por aceptar'; END IF;
    UPDATE org_suplencias SET estado='activa',aceptada_en=now();
    IF NOT ${tiene('at_borrador')} THEN RAISE EXCEPTION 'Suplente aceptado no ve AT'; END IF;`), 30000);

  it('usuario sin perfil confirmado no aparece como firmante y ve su pendiente', () => check(`
    IF EXISTS(SELECT 1 FROM pg_temp.tend_usuarios_firmantes() f WHERE f.id='${id(4)}') THEN RAISE EXCEPTION 'Perfil sin confirmar elegible'; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_temp.tend_usuarios_firmantes() f WHERE f.id='${id(3)}') THEN RAISE EXCEPTION 'Perfil confirmado no elegible'; END IF;
    ${actor(4)}
    IF NOT ${tiene('perfil_sin_confirmar', "p.titulo='Confirma tu nombre completo y tu cargo'")} THEN RAISE EXCEPTION 'Falta pendiente de perfil'; END IF;`), 30000);
});
