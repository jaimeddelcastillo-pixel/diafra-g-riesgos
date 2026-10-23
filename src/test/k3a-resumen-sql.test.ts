import { execFileSync, spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
vi.setConfig({ testTimeout: 120000 });
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const ORG = id(300);
let defs: string | undefined;
const tablas = ['profiles', 'org_members', 'puestos', 'kpi_definiciones', 'kpi_puesto', 'kpi_resultados'];
function run(body: string) {
  if (!defs) defs = execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input: `SELECT string_agg(pg_get_functiondef(oid)||';', E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['rol_efectivo','kpi_acceso','kpi_periodo','kpi_calcular','kpi_semaforo_cumplimiento','kpi_acumulado_interno','kpi_resumen_periodo']);`, encoding: 'utf8', timeout: 30000 })
    .replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role', 'public.app_role').replace(/\b_rol app_role\b/g, '_rol public.app_role').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
  const sql = `BEGIN;SET LOCAL check_function_bodies=off;
${tablas.map(t => `CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING DEFAULTS);`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' AND column_name<>'id' LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name);END LOOP;END $$;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(1)}'::uuid$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${ORG}'::uuid$$;
CREATE FUNCTION pg_temp.contexto_org_actual() RETURNS TABLE(org_id uuid,rol_en_org text,es_super_admin boolean,soporte_log_id uuid) LANGUAGE sql AS $$SELECT '${ORG}'::uuid,NULL::text,false,NULL::uuid$$;
CREATE FUNCTION pg_temp.org_tiene_modulo(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('qa.sin_'||$2,true),'')<>'1'$$;
${defs}
INSERT INTO profiles(id,nombre,activo) VALUES('${id(1)}','QA lectura',true);
INSERT INTO org_members(org_id,user_id,role) VALUES('${ORG}','${id(1)}','lectura');
INSERT INTO puestos(id,org_id,codigo,nombre,activo) VALUES('${id(50)}','${ORG}','P1','QA puesto',true);
INSERT INTO kpi_definiciones(id,org_id,codigo,nombre,proceso,nivel,frecuencia,tendencia,meta,unidad,peso,estado,activo) VALUES
 ('${id(10)}','${ORG}','A','QA sigma','Calidad','SGC','mensual','positiva',5,'%',70,'validado',true),
 ('${id(11)}','${ORG}','B','QA anterior','Calidad','SGC','mensual','positiva',100,'%',30,'validado',true),
 ('${id(12)}','${ORG}','N','QA negativa','Producción','Proceso','mensual','negativa',5,'días',0,'validado',true),
 ('${id(13)}','${ORG}','M','QA meta','Producción','Proceso','mensual','positiva',90,'%',0,'validado',true);
INSERT INTO kpi_puesto(id,org_id,codigo,nombre,puesto_id,frecuencia,tendencia,meta,unidad,peso,estado,activo) VALUES
 ('${id(20)}','${ORG}','F1','QA con dato','${id(50)}','mensual','positiva',90,'%',60,'validado',true),
 ('${id(21)}','${ORG}','F2','QA sin dato','${id(50)}','mensual','positiva',90,'%',40,'validado',true);
CREATE FUNCTION pg_temp.res(_k uuid,_p boolean,_ini date,_n numeric,_d numeric,_meta numeric,_t text,_u text) RETURNS void LANGUAGE plpgsql AS $f$ DECLARE c record;BEGIN
 SELECT * INTO c FROM pg_temp.kpi_calcular(_u,_t,_meta,_n,_d);
 INSERT INTO kpi_resultados(id,org_id,kpi_definicion_id,kpi_puesto_id,periodo_inicio,periodo_fin,numerador,denominador,valor,cumplimiento,semaforo,meta_copia,tendencia_copia,unidad_copia,estado,activo)
 VALUES(gen_random_uuid(),'${ORG}',CASE WHEN _p THEN NULL ELSE _k END,CASE WHEN _p THEN _k END,_ini,(date_trunc('month',_ini)+interval '1 month -1 day')::date,_n,_d,c.valor,c.cumplimiento,c.semaforo,_meta,_t,_u,'capturado',true);END $f$;
SELECT pg_temp.res('${id(10)}',false,'2026-01-01',1,10,5,'positiva','%'),pg_temp.res('${id(10)}',false,'2026-02-01',1,90,5,'positiva','%'),
 pg_temp.res('${id(11)}',false,'2025-12-01',50,100,100,'positiva','%'),pg_temp.res('${id(11)}',false,'2026-01-01',100,100,100,'positiva','%'),
 pg_temp.res('${id(12)}',false,'2026-01-01',10,1,5,'negativa','días'),pg_temp.res('${id(12)}',false,'2026-02-01',2,1,5,'negativa','días'),
 pg_temp.res('${id(13)}',false,'2026-01-01',90,100,90,'positiva','%'),pg_temp.res('${id(13)}',false,'2026-02-01',90,100,95,'positiva','%'),
 pg_temp.res('${id(20)}',true,'2026-01-01',95,100,90,'positiva','%');
DO $$ DECLARE r jsonb;k jsonb;failed boolean:=false;BEGIN r:=pg_temp.kpi_resumen_periodo('trimestre','2026-02-15','{}'); ${body} END $$;
SELECT 'K3A OK';ROLLBACK;`;
  return new Promise<string>((resolve, reject) => {
    const child = spawn('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1']);
    let out = ''; let err = '';
    child.stdout.on('data', d => { out += String(d); }); child.stderr.on('data', d => { err += String(d); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err)));
    child.stdin.end(sql);
  });
}
const kpi = (c: string) => `(SELECT e FROM jsonb_array_elements(r->'kpis') e WHERE e->>'codigo'='${c}')`;
async function check(body: string) { expect(await run(body)).toContain('K3A OK'); }
describe.skipIf(!process.env.PGHOST)('K3-a resumen por periodo, QA temporal con rollback', () => {
  it('acumulado Σ/Σ: enero 1/10 y febrero 1/90 dan 2 %, no 5.6 %', () => check(`k:=${kpi('A')};
IF (k->>'valor')::numeric<>2 OR jsonb_array_length(k->'subperiodos')<>2 OR r->>'inicio'<>'2026-01-01' OR r->>'fin'<>'2026-03-31' THEN RAISE EXCEPTION 'Acumulado %',k;END IF;`));
  it('tendencia negativa acumulada', () => check(`k:=${kpi('N')};
IF (k->>'valor')::numeric<>6 OR abs((k->>'cumplimiento')::numeric-5.0/6)>0.0001 OR k->>'semaforo'<>'amarillo' THEN RAISE EXCEPTION 'Negativa %',k;END IF;`));
  it('puesto con un KPI sin dato se excluye de la ponderación', () => check(`k:=r->'puestos'->0;
IF (k->>'calificacion')::numeric<>1 OR (k->>'con_dato')::int<>1 OR (k->>'total')::int<>2 OR k->>'semaforo'<>'verde' OR ${kpi('F2')}->>'semaforo'<>'sin captura' THEN RAISE EXCEPTION 'Puesto %',k;END IF;`));
  it('índice SGC con pesos y conteo de semáforos', () => check(`k:=r->'indice_sgc';
IF abs((k->>'indice')::numeric-0.58)>0.0001 OR k->>'semaforo'<>'rojo' OR (k->>'verde')::int<>1 OR (k->>'rojo')::int<>1 OR (k->>'total')::int<>2 THEN RAISE EXCEPTION 'Índice %',k;END IF;`));
  it('«meta cambió» marcada con la meta del último resultado', () => check(`k:=${kpi('M')};
IF (k->>'meta_cambio')::boolean IS NOT TRUE OR (k->>'meta')::numeric<>95 OR jsonb_array_length(k->'metas')<>2 OR ${kpi('A')}->>'meta_cambio'<>'false' THEN RAISE EXCEPTION 'Meta %',k;END IF;`));
  it('comparación contra el periodo anterior', () => check(`k:=${kpi('B')};
IF k->>'tendencia_periodo'<>'sube' OR (k->>'valor_anterior')::numeric<>50 OR (r->'indice_sgc'->>'indice_anterior')::numeric<>0.5 OR r->'anterior'->>'inicio'<>'2025-10-01' THEN RAISE EXCEPTION 'Anterior %',k;END IF;`));
  it('con el módulo ve el tablero; sin el módulo, no', () => check(`PERFORM set_config('qa.sin_indicadores','1',true);
BEGIN PERFORM pg_temp.kpi_resumen_periodo('trimestre','2026-02-15','{}');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Sin módulo vio el tablero';END IF;`));
});
