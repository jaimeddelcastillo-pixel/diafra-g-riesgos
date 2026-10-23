import { execFileSync, spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { plantillaAnio, leerResultadosExcel, type KpiExcel } from '@/modules/indicadores/lib/excel-resultados';
import type { Resultado } from '@/modules/indicadores/lib/resultados';
vi.setConfig({ testTimeout: 120000 });
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let definitions: string | undefined;
const tablas = ['organizations','profiles','org_members','user_roles','org_suplencias','audit_trail','puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta','kpi_resultados','kpi_reportes','kpi_reporte_config','kpi_evidencias','kpi_resultado_evidencia','org_pendientes_semaforo','tend_registros_at','tend_registros','tend_semanas','riesgos','folios','brain_knowledge_items'];
const paquete = JSON.stringify({ Puestos: [{ codigo: 'AC', nombre: 'QA Calidad', area: 'QA', activo: true }], KPI_SGC: [{ codigo: '1', nombre: 'QA cumplimiento', puesto: 'AC', formula: 'a/b', nivel: 'SGC', frecuencia: 'mensual', tendencia: 'positiva', meta: 95, unidad: '%', peso: 100, activo: true }], KPI_Puesto: [{ codigo: 'F1', puesto: 'AC', nombre: 'QA seguimiento', formula: 'a/b', frecuencia: 'mensual', tendencia: 'positiva', meta: 95, unidad: '%', peso: 100, aporta_a: '1', activo: true }] });
function run(body: string) {
  if (!definitions) definitions = execFileSync('psql', ['-XqAt','-v','ON_ERROR_STOP=1'], { input: `SELECT string_agg(pg_get_functiondef(oid)||';', E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['rol_efectivo','puede_administrar_usuarios','kpi_acceso','kpi_guard','kpi_aplicar_interno','aplicar_kpis_excel','guardar_kpis','validar_kpi','kpi_puede_capturar','kpi_periodo','kpi_calcular','kpi_resultados_guard','capturar_kpi_resultado','guardar_kpi_resultado','kpi_ultimo_cerrado','registrar_kpi_evidencia','ligar_kpi_evidencia','kpi_evidencias_guard','revisar_kpi_resultado','anular_kpi_resultado','asignar_capturistas','audit_trigger_func','audit_suplencia_contexto','pendientes_color','pendientes_usuario','kpi_reporte_autoriza','kpi_excel_periodo','kpi_excel_numero','kpi_excel_fecha','previsualizar_resultados_excel','aplicar_resultados_excel']);`, encoding: 'utf8', timeout: 30000 })
    .replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role','public.app_role').replace(/\b_rol app_role\b/g,'_rol public.app_role').replaceAll('auth.uid()','pg_temp.uid()').replaceAll('auth.role()','pg_temp.auth_role()').replaceAll('SECURITY DEFINER','').replaceAll("SET search_path TO 'public'",'SET search_path TO pg_temp,public');
  const sql = `BEGIN;SET LOCAL check_function_bodies=off;
${tablas.map(t => `CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING DEFAULTS ${['puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta','kpi_resultados','kpi_resultado_evidencia'].includes(t) ? 'INCLUDING INDEXES' : ''});`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' AND table_name NOT IN ('puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta','kpi_resultados','kpi_resultado_evidencia') LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name);END LOOP;END $$;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
CREATE FUNCTION pg_temp.auth_role() RETURNS text LANGUAGE sql AS $$SELECT 'authenticated'::text$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(100)}'::uuid$$;
CREATE FUNCTION pg_temp.is_super_admin() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE FUNCTION pg_temp.contexto_org_actual() RETURNS TABLE(org_id uuid,rol_en_org text,es_super_admin boolean,soporte_log_id uuid) LANGUAGE sql AS $$SELECT pg_temp.get_user_org_id(),NULL::text,false,NULL::uuid$$;
CREATE FUNCTION pg_temp.org_tiene_modulo(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('qa.sin_'||$2,true),'')<>'1'$$;
${definitions}
INSERT INTO organizations(id,nombre,es_prueba) VALUES('${id(100)}','QA temporal K2',true);
INSERT INTO profiles(id,nombre,cargo,activo,email,perfil_confirmado_en) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'QA persona '||i,'QA cargo',true,'qa'||i||'@example.invalid',now() FROM generate_series(1,5) i;
INSERT INTO org_members(org_id,user_id,role) SELECT '${id(100)}',id,CASE id WHEN '${id(1)}' THEN 'responsable_sanitario'::public.app_role WHEN '${id(2)}' THEN 'admin'::public.app_role WHEN '${id(3)}' THEN 'aseguramiento_calidad'::public.app_role ELSE 'operador'::public.app_role END FROM profiles;
SELECT set_config('qa.actor','${id(2)}',true);
${['puestos','kpi_definiciones','kpi_puesto','kpi_puesto_aporta'].map(t => `CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION pg_temp.kpi_guard();CREATE TRIGGER audit AFTER INSERT OR UPDATE ON ${t} FOR EACH ROW EXECUTE FUNCTION pg_temp.audit_trigger_func();`).join('\n')}
CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON kpi_resultados FOR EACH ROW EXECUTE FUNCTION pg_temp.kpi_resultados_guard();
CREATE TRIGGER audit AFTER INSERT OR UPDATE ON kpi_resultados FOR EACH ROW EXECUTE FUNCTION pg_temp.audit_trigger_func();
${['kpi_evidencias','kpi_resultado_evidencia'].map(t => `CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION pg_temp.kpi_evidencias_guard();`).join('\n')}
CREATE TRIGGER audit_context BEFORE INSERT ON audit_trail FOR EACH ROW EXECUTE FUNCTION pg_temp.audit_suplencia_contexto();
DO $$ DECLARE k uuid;kp uuid;r uuid;r2 uuid;r3 uuid;ev uuid;c2 record;pi date;pf date;failed boolean:=false;BEGIN pi:=date_trunc('month',now()-interval '1 month')::date;pf:=date_trunc('month',now())::date-1; ${body} END $$;
SELECT 'K2 OK';ROLLBACK;`;
  return new Promise<string>((resolve, reject) => {
    const child = spawn('psql',['-XqAt','-v','ON_ERROR_STOP=1']);
    let out = ''; let err = '';
    child.stdout.on('data', d => { out += String(d); }); child.stderr.on('data', d => { err += String(d); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err)));
    child.stdin.end(sql);
  });
}
const importar = `PERFORM pg_temp.aplicar_kpis_excel('${paquete}'::jsonb,'QA importación');SELECT id INTO k FROM kpi_definiciones WHERE codigo='1';`;
const actor = (n: number) => `PERFORM set_config('qa.actor','${id(n)}',true);`;
const base = `${importar}${actor(3)}PERFORM pg_temp.validar_kpi('kpi_definiciones',k,'QA validar');${actor(2)}PERFORM pg_temp.asignar_capturistas('kpi_definiciones','1',ARRAY['${id(5)}']::uuid[],'QA capturistas');`;
const captura = (num: number, den: number | null, motivo = "''", rid = 'NULL') => `pg_temp.capturar_kpi_resultado('kpi_definiciones',k,pi,pf,NULL,'',${num},${den ?? 'NULL'},'qa/ev.pdf','QA comentario',${motivo},${rid})`;
const guardar = (tabla: string, kv: string, num: number, den: number | null, ref: string, motivo = "''", rid = 'NULL') => `pg_temp.guardar_kpi_resultado('${tabla}',${kv},pi,NULL,'',${num},${den ?? 'NULL'},${ref},'',${motivo},${rid})`;
const celda = (tipo = 'puesto', codigo = 'F1', inicio = '2026-01-01', num: string | number = 98, den: string | number = 100, referencia = '') => ({ tipo, codigo, inicio, numerador: num, denominador: den, referencia });
const lote = (cells: ReturnType<typeof celda>[]) => `'${JSON.stringify(cells)}'::jsonb`;
const puestoValidado = `${base}SELECT id INTO kp FROM kpi_puesto WHERE codigo='F1';${actor(3)}PERFORM pg_temp.validar_kpi('kpi_puesto',kp,'QA validar');${actor(2)}`;
async function check(body: string) { expect(await run(body)).toContain('K2 OK'); }
describe.skipIf(!process.env.PGHOST)('K2 captura de resultados, QA temporal con rollback', () => {
  it('K2-a T1–T3 de dos KPI, sin escritura previa, cálculo manual igual y auditoría', () => check(`${puestoValidado}
PERFORM pg_temp.guardar_kpis('{"KPI_Puesto":[{"codigo":"F2","puesto":"AC","nombre":"QA segundo","formula":"a/b","frecuencia":"trimestral","tendencia":"positiva","meta":98,"unidad":"%","peso":0}]}'::jsonb,'QA segundo');
SELECT id INTO r2 FROM kpi_puesto WHERE codigo='F2';${actor(3)}PERFORM pg_temp.validar_kpi('kpi_puesto',r2,'QA validar');${actor(2)}
PERFORM pg_temp.guardar_kpis('{"KPI_Puesto":[{"codigo":"F1","puesto":"AC","nombre":"QA seguimiento","formula":"a/b","frecuencia":"trimestral","tendencia":"positiva","meta":98,"unidad":"%","peso":100}]}'::jsonb,'QA trimestral');${actor(3)}PERFORM pg_temp.validar_kpi('kpi_puesto',kp,'QA validar');${actor(2)}
IF (SELECT count(*) FROM jsonb_array_elements(pg_temp.previsualizar_resultados_excel(${lote(['F1','F2'].flatMap(code => ['2026-01-01','2026-04-01','2026-07-01'].map(inicio => celda('puesto', code, inicio))))})) e WHERE e->>'estado'='nuevo')<>6 OR EXISTS(SELECT 1 FROM kpi_resultados) THEN RAISE EXCEPTION 'Preview escribió o incorrecto';END IF;
IF pg_temp.aplicar_resultados_excel(${lote(['F1','F2'].flatMap(code => ['2026-01-01','2026-04-01','2026-07-01'].map(inicio => celda('puesto', code, inicio))))},'QA importar tres trimestres')<>6 THEN RAISE EXCEPTION 'No importó 6';END IF;
IF (SELECT count(*) FROM kpi_resultados WHERE valor=98 AND cumplimiento=1 AND semaforo='verde' AND estado='capturado')<>6 THEN RAISE EXCEPTION 'Importado no verde';END IF;
IF (SELECT count(*) FROM audit_trail WHERE tabla='kpi_resultados' AND motivo='QA importar tres trimestres')<>6 THEN RAISE EXCEPTION 'Auditoría incompleta';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('%','positiva',98,98,100);IF EXISTS(SELECT 1 FROM kpi_resultados WHERE valor IS DISTINCT FROM c2.valor OR cumplimiento IS DISTINCT FROM c2.cumplimiento OR semaforo IS DISTINCT FROM c2.semaforo) THEN RAISE EXCEPTION 'Cálculo diferente';END IF;
IF pg_temp.aplicar_resultados_excel(${lote([celda()])},'QA sin cambio')<>0 THEN RAISE EXCEPTION 'Reescribió sin cambio';END IF;`));
  it('K2-a una celda inválida en 3 meses bloquea todo', () => check(`${puestoValidado}
IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pg_temp.previsualizar_resultados_excel(${lote([celda(),celda('puesto','F1','2026-02-01'),celda('puesto','F1','2026-03-01','inválido')])})) e WHERE e->>'estado'='error') THEN RAISE EXCEPTION 'Preview no detectó error';END IF;
BEGIN PERFORM pg_temp.aplicar_resultados_excel(${lote([celda(),celda('puesto','F1','2026-02-01'),celda('puesto','F1','2026-03-01','inválido')])},'QA archivo inválido');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed OR EXISTS(SELECT 1 FROM kpi_resultados) THEN RAISE EXCEPTION 'Importación parcial';END IF;`));
  it('K2-a SGC sin referencia bloquea; con referencia se revisa sin archivo', () => check(`${base}${actor(2)}
BEGIN PERFORM pg_temp.aplicar_resultados_excel(${lote([celda('SGC','1')])},'QA sin fuente');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed OR EXISTS(SELECT 1 FROM kpi_resultados) THEN RAISE EXCEPTION 'SGC sin fuente';END IF;
PERFORM pg_temp.aplicar_resultados_excel(${lote([celda('SGC','1','2026-01-01',98,100,'Bitácora QA')])},'QA con fuente');SELECT id INTO r FROM kpi_resultados;${actor(1)}PERFORM pg_temp.revisar_kpi_resultado(r,'');IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND estado='revisado' AND semaforo='verde' AND evidencia_path IS NULL) THEN RAISE EXCEPTION 'Revisión sin archivo';END IF;`));
  it('K2-a corrección de revisado usa copia histórica, vuelve capturado y audita antes/después', () => check(`${puestoValidado}pi:='2026-01-01';r:=${guardar('kpi_puesto','kp',98,100,"''")};${actor(1)}PERFORM pg_temp.revisar_kpi_resultado(r,'');${actor(2)}
IF (pg_temp.previsualizar_resultados_excel(${lote([celda('puesto','F1','2026-01-01',97)])})->0->>'estado')<>'cambia' THEN RAISE EXCEPTION 'No detectó cambio';END IF;
PERFORM pg_temp.aplicar_resultados_excel(${lote([celda('puesto','F1','2026-01-01',97)])},'QA corrección Excel');
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND numerador=97 AND estado='capturado' AND revisado_por IS NULL AND meta_copia=95 AND semaforo='verde') OR NOT EXISTS(SELECT 1 FROM audit_trail WHERE tabla='kpi_resultados' AND motivo='QA corrección Excel' AND valor_anterior->>'estado'='revisado' AND valor_nuevo->>'estado'='capturado') THEN RAISE EXCEPTION 'Corrección incorrecta';END IF;`));
  it('D1-a: periodos abiertos con resultado se ignoran incluso con cambios', () => check(`${puestoValidado}r:=${guardar('kpi_puesto','kp',98,100,"''")};
ALTER TABLE kpi_resultados DISABLE TRIGGER guard;UPDATE kpi_resultados SET periodo_inicio=date_trunc('month',(now() AT TIME ZONE 'America/Mexico_City'))::date,periodo_fin=NULL WHERE id=r;ALTER TABLE kpi_resultados ENABLE TRIGGER guard;
c2:=NULL;SELECT e INTO c2 FROM jsonb_array_elements(pg_temp.previsualizar_resultados_excel(jsonb_build_array(jsonb_build_object('tipo','puesto','codigo','F1','inicio',date_trunc('month',(now() AT TIME ZONE 'America/Mexico_City'))::date::text,'numerador',98,'denominador',100,'referencia',(SELECT coalesce(referencia_fuente,'') FROM kpi_resultados WHERE id=r))))) e;
IF c2.e->>'estado'<>'ignorado (periodo abierto)' OR c2.e->>'error'<>'' THEN RAISE EXCEPTION 'Sin cambio en abierto marcado %',c2.e;END IF;
SELECT e INTO c2 FROM jsonb_array_elements(pg_temp.previsualizar_resultados_excel(jsonb_build_array(jsonb_build_object('tipo','puesto','codigo','F1','inicio',date_trunc('month',(now() AT TIME ZONE 'America/Mexico_City'))::date::text,'numerador',97,'denominador',100,'referencia',(SELECT coalesce(referencia_fuente,'') FROM kpi_resultados WHERE id=r))))) e;
IF c2.e->>'estado'<>'ignorado (periodo abierto)' OR c2.e->>'error'<>'' THEN RAISE EXCEPTION 'Cambio en abierto aceptado %',c2.e;END IF;`));
  it('D1-a plantilla real KPI 1 octubre lleno sin referencia se ignora y septiembre se aplica', async () => {
    const qa: KpiExcel = { tabla: 'kpi_definiciones', id: 'qa', codigo: '1', nombre: 'QA', grupo: 'QA', nivel: 'SGC', frecuencia: 'mensual', meta: 95, unidad: '%', fuente: 'QA fuente', estado: 'validado' };
    const bytes = await plantillaAnio([qa], [{ kpi_definicion_id: 'qa', periodo_inicio: '2026-10-01', numerador: 98, denominador: 100, referencia_fuente: '' }, { kpi_definicion_id: 'qa', periodo_inicio: '2026-09-01', numerador: 97, denominador: 100, referencia_fuente: 'QA fuente' }] as Resultado[], 2026, '2026-10-23');
    const cells = leerResultadosExcel(bytes.buffer as ArrayBuffer);
    const october = cells.find(c => c.inicio === '2026-10-01');
    expect(october?.numerador).toBe(98);
    expect(october?.referencia).toBe('');
    await check(`${base}${actor(2)}r:=${guardar('kpi_definiciones','k',98,100,"'QA fuente'")};
ALTER TABLE kpi_resultados DISABLE TRIGGER guard;UPDATE kpi_resultados SET periodo_inicio='2026-10-01',referencia_fuente='' WHERE id=r;ALTER TABLE kpi_resultados ENABLE TRIGGER guard;
IF (pg_temp.previsualizar_resultados_excel('${JSON.stringify(cells)}'::jsonb)->1->>'estado')<>'ignorado (periodo abierto)' THEN RAISE EXCEPTION 'Octubre no ignorado';END IF;
IF pg_temp.aplicar_resultados_excel('${JSON.stringify(cells)}'::jsonb,'QA plantilla real')<>1 THEN RAISE EXCEPTION 'No aplicó septiembre';END IF;
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND numerador=98 AND referencia_fuente='') THEN RAISE EXCEPTION 'Octubre alterado';END IF;`);
  });
  it('K2-a bloquea abierto, inexistente, borrador, permiso, denominador y duplicados', () => check(`${puestoValidado}
IF (SELECT count(*) FROM jsonb_array_elements(pg_temp.previsualizar_resultados_excel(${lote([celda('puesto','NO-EXISTE'),celda('puesto','F1','2099-01-01'),celda('puesto','F1','2026-02-01',98,''),celda('puesto','F1','2026-03-01'),celda('puesto','F1','2026-03-01')])})) e WHERE e->>'estado'='error')<>5 THEN RAISE EXCEPTION 'Validaciones incompletas';END IF;
${actor(4)}IF (pg_temp.previsualizar_resultados_excel(${lote([celda()])})->0->>'error') NOT LIKE '%Sin permiso%' THEN RAISE EXCEPTION 'Permiso incompleto';END IF;
BEGIN PERFORM pg_temp.aplicar_resultados_excel(${lote([celda()])},'QA sin permiso');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed OR EXISTS(SELECT 1 FROM kpi_resultados) THEN RAISE EXCEPTION 'Escribió sin permiso';END IF;`));
  it('K2-a límite de 5000 y motivo obligatorio', () => check(`${puestoValidado}
BEGIN PERFORM pg_temp.previsualizar_resultados_excel((SELECT jsonb_agg(${lote([celda()])}->0) FROM generate_series(1,5001)));EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Aceptó 5001';END IF;
failed:=false;BEGIN PERFORM pg_temp.aplicar_resultados_excel(${lote([celda()])},'');EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed OR EXISTS(SELECT 1 FROM kpi_resultados) THEN RAISE EXCEPTION 'Escribió sin motivo';END IF;`));
  it('cálculo positivo, negativo, días, número y sin base', () => check(`
SELECT * INTO c2 FROM pg_temp.kpi_calcular('%','positiva',95,96,100);IF c2.valor<>96 OR c2.cumplimiento<>1 OR c2.semaforo<>'verde' THEN RAISE EXCEPTION 'Positivo verde';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('%','positiva',95,80,100);IF c2.semaforo<>'amarillo' OR abs(c2.cumplimiento-80.0/95)>0.0001 THEN RAISE EXCEPTION 'Positivo amarillo';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('%','positiva',95,70,100);IF c2.semaforo<>'rojo' THEN RAISE EXCEPTION 'Positivo rojo';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('días','negativa',5,4,1);IF c2.cumplimiento<>1 OR c2.semaforo<>'verde' THEN RAISE EXCEPTION 'Negativo bajo meta';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('días','negativa',5,6,1);IF c2.semaforo<>'amarillo' OR abs(c2.cumplimiento-5.0/6)>0.0001 THEN RAISE EXCEPTION 'Negativo sobre meta';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('días','positiva',10,30,3);IF c2.valor<>10 OR c2.cumplimiento<>1 THEN RAISE EXCEPTION 'Promedio de días';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('número','positiva',10,12,NULL);IF c2.valor<>12 OR c2.semaforo<>'verde' THEN RAISE EXCEPTION 'Número';END IF;
SELECT * INTO c2 FROM pg_temp.kpi_calcular('%','positiva',95,5,0);IF c2.valor IS NOT NULL OR c2.cumplimiento IS NOT NULL OR c2.semaforo<>'sin base' THEN RAISE EXCEPTION 'Sin base';END IF;`));
  it('captura copia la meta y un cambio posterior no recalcula', () => check(`${base}${actor(5)}r:=${captura(92, 100)};
${actor(2)}PERFORM pg_temp.guardar_kpis(jsonb_build_object('KPI_SGC',jsonb_build_array(jsonb_build_object('codigo','1','nombre','QA cumplimiento','puesto','AC','formula','a/b','nivel','SGC','frecuencia','mensual','tendencia','positiva','meta',90,'unidad','%','peso',100))),'QA cambio meta');
${actor(3)}PERFORM pg_temp.validar_kpi('kpi_definiciones',k,'QA revalidar');${actor(5)}PERFORM ${captura(92, 100, "'QA corrección'", 'r')};
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND meta_copia=95 AND abs(cumplimiento-92.0/95)<0.0001 AND semaforo='verde') THEN RAISE EXCEPTION 'Recalculó con la meta nueva';END IF;`));
  it('evidencia obligatoria en KPI de nivel SGC', () => check(`${base}${actor(5)}BEGIN PERFORM pg_temp.capturar_kpi_resultado('kpi_definiciones',k,pi,pf,NULL,'',92,100,'','QA comentario','',NULL);EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Capturó sin evidencia';END IF;`));
  it('captura bloqueada en borrador', () => check(`${importar}${actor(2)}BEGIN PERFORM ${captura(92, 100)};EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Capturó en borrador';END IF;`));
  it('corregir un revisado regresa a capturado', () => check(`${base}${actor(5)}r:=${captura(92, 100)};${actor(1)}PERFORM pg_temp.revisar_kpi_resultado(r,'');
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND estado='revisado' AND revisado_por='${id(1)}') THEN RAISE EXCEPTION 'No revisó';END IF;
${actor(5)}PERFORM ${captura(93, 100, "'QA corrección'", 'r')};
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND estado='capturado' AND revisado_por IS NULL AND revisado_en IS NULL AND numerador=93) THEN RAISE EXCEPTION 'No regresó a capturado';END IF;`));
  it('pendientes agrupados: capturista y revisor', () => check(`${base}${actor(5)}
IF (SELECT count(*) FROM pg_temp.pendientes_usuario() WHERE tipo='kpi_por_capturar' AND perfil='gestion' AND titulo ~ '^[0-9]+ KPI por capturar del periodo ')<>1 THEN RAISE EXCEPTION 'Pendiente de captura ausente';END IF;
${actor(4)}IF EXISTS(SELECT 1 FROM pg_temp.pendientes_usuario() WHERE tipo='kpi_por_capturar') THEN RAISE EXCEPTION 'Operador sin asignación ve captura';END IF;
${actor(5)}r:=${captura(92, 100)};IF EXISTS(SELECT 1 FROM pg_temp.pendientes_usuario() WHERE tipo='kpi_por_capturar') THEN RAISE EXCEPTION 'Pendiente tras captura';END IF;
${actor(1)}IF (SELECT count(*) FROM pg_temp.pendientes_usuario() WHERE tipo='kpi_por_revisar' AND titulo='1 resultados por revisar')<>1 THEN RAISE EXCEPTION 'Pendiente de revisión ausente';END IF;`));
  it('un operador sin asignación no captura; asignado sí', () => check(`${importar}${actor(3)}PERFORM pg_temp.validar_kpi('kpi_definiciones',k,'QA validar');${actor(4)}
BEGIN PERFORM ${captura(92, 100)};EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Operador capturó';END IF;
${actor(2)}PERFORM pg_temp.asignar_capturistas('kpi_definiciones','1',ARRAY['${id(4)}']::uuid[],'QA capturistas');${actor(4)}r:=${captura(92, 100)};
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND capturado_por='${id(4)}') THEN RAISE EXCEPTION 'Capturista no capturó';END IF;`));
  it('un solo resultado activo por KPI y periodo; anular con motivo', () => check(`${base}${actor(5)}r:=${captura(92, 100)};
BEGIN PERFORM ${captura(93, 100)};EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Duplicado permitido';END IF;
${actor(2)}PERFORM pg_temp.anular_kpi_resultado(r,'QA anulación');
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND NOT activo) OR NOT EXISTS(SELECT 1 FROM audit_trail WHERE tabla='kpi_resultados' AND motivo='QA anulación' AND valor_anterior->>'activo'='true' AND valor_nuevo->>'activo'='false') THEN RAISE EXCEPTION 'Anulación incorrecta';END IF;
r:=${captura(94, 100)};IF r IS NULL THEN RAISE EXCEPTION 'No recapturó tras anular';END IF;`));
  it('corregir sin motivo se rechaza', () => check(`${base}${actor(5)}r:=${captura(92, 100)};
BEGIN PERFORM ${captura(93, 100, "''", 'r')};EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Corrigió sin motivo';END IF;`));
  it('K2-b: captura de kpi_puesto; denominador faltante se bloquea; revisar/anular/asignar con puesto', () => check(`${base}SELECT id INTO kp FROM kpi_puesto WHERE codigo='F1';${actor(3)}PERFORM pg_temp.validar_kpi('kpi_puesto',kp,'QA validar');
${actor(2)}PERFORM pg_temp.asignar_capturistas('kpi_puesto','F1',ARRAY['${id(5)}']::uuid[],'QA capturistas');${actor(5)}
BEGIN PERFORM ${guardar('kpi_puesto', 'kp', 90, null, "''")};EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Puesto sin denominador';END IF;
r:=${guardar('kpi_puesto', 'kp', 90, 100, "''")};IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND kpi_puesto_id=kp AND valor=90 AND referencia_fuente='') THEN RAISE EXCEPTION 'Puesto no capturó';END IF;
${actor(1)}PERFORM pg_temp.revisar_kpi_resultado(r,'');${actor(5)}r:=${guardar('kpi_puesto', 'kp', 91, 100, "''", "'QA corrección'", 'r')};
${actor(2)}PERFORM pg_temp.anular_kpi_resultado(r,'QA anulación');IF EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND activo) THEN RAISE EXCEPTION 'No anuló puesto';END IF;`));
  it('K2-b: SGC sin referencia no se guarda; con referencia y sin archivo sí y se revisa', () => check(`${base}${actor(5)}
BEGIN PERFORM ${guardar('kpi_definiciones', 'k', 92, 100, "''")};EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'SGC sin referencia';END IF;
r:=${guardar('kpi_definiciones', 'k', 92, 100, "'Bitácora QA · mes'")};${actor(1)}PERFORM pg_temp.revisar_kpi_resultado(r,'');
IF NOT EXISTS(SELECT 1 FROM kpi_resultados WHERE id=r AND estado='revisado' AND evidencia_path IS NULL) THEN RAISE EXCEPTION 'No revisó con referencia';END IF;`));
  it('K2-b: un archivo ligado a 3 resultados', () => check(`${base}SELECT id INTO kp FROM kpi_puesto WHERE codigo='F1';${actor(3)}PERFORM pg_temp.validar_kpi('kpi_puesto',kp,'QA validar');${actor(2)}
r:=${guardar('kpi_definiciones', 'k', 92, 100, "'QA ref'")};r2:=${guardar('kpi_puesto', 'kp', 90, 100, "''")};
r3:=pg_temp.guardar_kpi_resultado('kpi_definiciones',k,(pi-interval '1 month')::date,NULL,'',80,100,'QA ref','','',NULL);
ev:=pg_temp.registrar_kpi_evidencia((pi-interval '1 month')::date,pf,'qa.pdf','${id(100)}/periodo/qa.pdf');
IF pg_temp.ligar_kpi_evidencia(ev,ARRAY[r,r2,r3])<>3 THEN RAISE EXCEPTION 'No ligó 3';END IF;
IF (SELECT count(*) FROM kpi_resultado_evidencia WHERE evidencia_id=ev)<>3 THEN RAISE EXCEPTION 'Ligas incompletas';END IF;`));
  it('K2-b: último periodo cerrado en 3 fechas y 4 frecuencias; periodo futuro no se captura', () => check(`
IF (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('mensual','2026-10-23'))<>'2026-09-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('trimestral','2026-10-23'))<>'2026-07-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('semestral','2026-10-23'))<>'2026-01-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('anual','2026-10-23'))<>'2025-01-01' THEN RAISE EXCEPTION '23/10/2026';END IF;
IF (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('mensual','2027-01-01'))<>'2026-12-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('trimestral','2027-01-01'))<>'2026-10-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('semestral','2027-01-01'))<>'2026-07-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('anual','2027-01-01'))<>'2026-01-01' THEN RAISE EXCEPTION '1/1/2027';END IF;
IF (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('mensual','2026-07-15'))<>'2026-06-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('trimestral','2026-07-15'))<>'2026-04-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('semestral','2026-07-15'))<>'2026-01-01' OR (SELECT inicio FROM pg_temp.kpi_ultimo_cerrado('anual','2026-07-15'))<>'2025-01-01' THEN RAISE EXCEPTION '15/7/2026';END IF;
${base}${actor(5)}BEGIN PERFORM pg_temp.guardar_kpi_resultado('kpi_definiciones',k,date_trunc('month',now() AT TIME ZONE 'America/Mexico_City')::date,NULL,'',92,100,'QA ref','','',NULL);EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Capturó periodo abierto';END IF;`));
});
