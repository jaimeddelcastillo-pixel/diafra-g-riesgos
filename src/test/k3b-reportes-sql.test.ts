import { execFileSync, spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
vi.setConfig({ testTimeout: 120000 });
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const ORG = id(400);
let defs: string | undefined;
const tablas = ['organizations', 'profiles', 'org_members', 'org_suplencias', 'puestos', 'kpi_definiciones', 'kpi_puesto', 'kpi_resultados', 'kpi_reporte_config', 'kpi_reportes', 'kpi_reportes_historial', 'org_formatos', 'org_identidad_documental', 'documentos_generados'];
const funciones = ['rol_efectivo', 'kpi_acceso', 'kpi_periodo', 'kpi_calcular', 'kpi_semaforo_cumplimiento', 'kpi_acumulado_interno', 'kpi_resumen_periodo', 'kpi_reportes_guard', 'kpi_reporte_autoriza', 'kpi_reporte_preparar', 'guardar_kpi_reporte_config', 'crear_kpi_reporte', 'guardar_kpi_reporte', 'kpi_reporte_faltantes', 'enviar_kpi_reporte', 'revisar_kpi_reporte', 'preparar_emision_kpi_word', 'confirmar_emision_kpi_word', 'reclamar_emision_kpi_word', 'cancelar_reserva_emision_kpi_word', 'emitir_kpi_reporte', 'nueva_version_kpi_reporte', 'anular_kpi_reporte', 'registrar_documento_generado'];
function run(body: string) {
  if (!defs) defs = execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input: `SELECT string_agg(pg_get_functiondef(oid)||';', E'\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY[${funciones.map(f => `'${f}'`).join(',')}]);`, encoding: 'utf8', timeout: 30000 })
    .replaceAll('public.', 'pg_temp.').replaceAll('pg_temp.app_role', 'public.app_role').replace(/\b_rol app_role\b/g, '_rol public.app_role').replaceAll('storage.objects', 'pg_temp.objects').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp,public');
  const sql = `BEGIN;SET LOCAL check_function_bodies=off;
${tablas.map(t => `CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING DEFAULTS);`).join('\n')}
DO $$ DECLARE c record;BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND is_nullable='NO' AND column_name<>'id' AND column_default IS NULL LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name);END LOOP;END $$;
CREATE TEMP TABLE objects(bucket_id text,name text);
CREATE TEMP SEQUENCE documentos_generados_folio_seq;
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('qa.actor',true),'')::uuid$$;
CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${ORG}'::uuid$$;
CREATE FUNCTION pg_temp.contexto_org_actual() RETURNS TABLE(org_id uuid,rol_en_org text,es_super_admin boolean,soporte_log_id uuid) LANGUAGE sql AS $$SELECT '${ORG}'::uuid,NULL::text,false,NULL::uuid$$;
CREATE FUNCTION pg_temp.org_tiene_modulo(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
${defs}
CREATE OR REPLACE FUNCTION pg_temp.emitir_kpi_reporte(_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$DECLARE s jsonb;BEGIN s:=pg_temp.preparar_emision_kpi_word(_id);INSERT INTO objects VALUES('documentos-generados',s->>'path');RETURN pg_temp.confirmar_emision_kpi_word(_id,(s->>'token')::uuid,NULL,repeat('a',64));END$$;
${['kpi_reportes', 'kpi_reportes_historial', 'kpi_reporte_config'].map(t => `CREATE TRIGGER guard BEFORE INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION pg_temp.kpi_reportes_guard();`).join('\n')}
INSERT INTO organizations(id,nombre,es_prueba) VALUES('${ORG}','QA reportes',true);
INSERT INTO profiles(id,nombre,cargo,activo,perfil_confirmado_en) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'QA persona '||i,'QA cargo '||i,true,now() FROM generate_series(1,5) i;
INSERT INTO org_members(org_id,user_id,role) VALUES('${ORG}','${id(1)}','responsable_sanitario'),('${ORG}','${id(2)}','admin'),('${ORG}','${id(3)}','aseguramiento_calidad'),('${ORG}','${id(4)}','operador'),('${ORG}','${id(5)}','operador');
INSERT INTO kpi_definiciones(id,org_id,codigo,nombre,proceso,nivel,frecuencia,tendencia,meta,unidad,peso,estado,activo) VALUES('${id(10)}','${ORG}','A','QA rojo','Calidad','SGC','mensual','positiva',95,'%',100,'validado',true);
INSERT INTO kpi_resultados(id,org_id,kpi_definicion_id,periodo_inicio,periodo_fin,numerador,denominador,valor,cumplimiento,semaforo,meta_copia,tendencia_copia,unidad_copia,estado,activo)
 SELECT gen_random_uuid(),'${ORG}','${id(10)}','2026-01-01','2026-01-31',50,100,c.valor,c.cumplimiento,c.semaforo,95,'positiva','%','capturado',true FROM pg_temp.kpi_calcular('%','positiva',95,50,100) c;
DO $$ DECLARE rid uuid;r record;failed boolean:=false;BEGIN ${body} END $$;
SELECT 'K3B OK';ROLLBACK;`;
  return new Promise<string>((resolve, reject) => {
    const child = spawn('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1']);
    let out = ''; let err = '';
    child.stdout.on('data', d => { out += String(d); }); child.stderr.on('data', d => { err += String(d); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(out) : reject(new Error(err)));
    child.stdin.end(sql);
  });
}
const actor = (n: number) => `PERFORM set_config('qa.actor','${id(n)}',true);`;
const analisis = `'{"analisis":{"${id(10)}":{"causa":"QA causa","accion":"QA acción","capa":"CAPA-QA-1"}},"conclusiones":"QA conclusiones"}'::jsonb`;
/** Draft created by `autor`, completed and sent; RS (1) reviews → ready to authorize. */
const listo = (autor = 2) => `${actor(autor)}rid:=pg_temp.crear_kpi_reporte('trimestre','2026-01-01');PERFORM pg_temp.guardar_kpi_reporte(rid,${analisis});PERFORM pg_temp.enviar_kpi_reporte(rid);${actor(1)}PERFORM pg_temp.revisar_kpi_reporte(rid,true,'');`;
const falla = (stmt: string, msg: string) => `failed:=false;BEGIN ${stmt};EXCEPTION WHEN raise_exception THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION '${msg}';END IF;`;
async function check(body: string) { expect(await run(body)).toContain('K3B OK'); }
describe.skipIf(!process.env.PGHOST)('K3-b reporte periódico de indicadores, QA temporal con rollback', () => {
  it('K3-b-1 no emite sin el original guardado y congela logo y ruta con folio', () => check(`${listo()}${actor(3)}
DECLARE s jsonb; logo jsonb:='{"format":"PNG","dataUrl":"data:image/png;base64,QUFB"}'; BEGIN
s:=pg_temp.preparar_emision_kpi_word(rid);
${falla("PERFORM pg_temp.confirmar_emision_kpi_word(rid,(s->>'token')::uuid,logo,repeat('a',64))", 'Emitió sin archivo')}
INSERT INTO objects VALUES('documentos-generados',s->>'path');
PERFORM pg_temp.confirmar_emision_kpi_word(rid,(s->>'token')::uuid,logo,repeat('a',64));
UPDATE organizations SET logo_url='logo-nuevo.png' WHERE id='${ORG}';
IF (SELECT formato_snapshot->'logo' FROM kpi_reportes WHERE id=rid) IS DISTINCT FROM logo THEN RAISE EXCEPTION 'El logo emitido cambió'; END IF;
IF NOT EXISTS(SELECT 1 FROM documentos_generados d JOIN kpi_reportes k ON d.folio=k.formato_snapshot->>'folio' WHERE k.id=rid AND d.archivo_path=s->>'path' AND d.archivo_sha256=repeat('a',64)) THEN RAISE EXCEPTION 'No registró original y folio'; END IF;
END;`));
  it('K3-b-2 emisión que falla a la mitad: no queda atorada ni con Word a medias; se reintenta o se cancela la reserva', () => check(`${listo()}${actor(3)}
DECLARE s jsonb; s2 jsonb; BEGIN
s:=pg_temp.preparar_emision_kpi_word(rid);
IF NOT pg_temp.reclamar_emision_kpi_word(rid,(s->>'token')::uuid) THEN RAISE EXCEPTION 'No reclamó'; END IF;
-- falla a la mitad: sin archivo subido, la confirmación se rechaza
${falla("PERFORM pg_temp.confirmar_emision_kpi_word(rid,(s->>'token')::uuid,NULL,repeat('a',64))", 'Confirmó sin archivo')}
IF EXISTS(SELECT 1 FROM documentos_generados) OR (SELECT estado FROM kpi_reportes WHERE id=rid)<>'borrador' THEN RAISE EXCEPTION 'Quedó un Word registrado a medias'; END IF;
${falla("PERFORM pg_temp.cancelar_reserva_emision_kpi_word(rid,'QA reserva vencida')", 'Canceló reserva vigente')}
PERFORM set_config('tracea.kpi_reportes_rpc','1',true);UPDATE kpi_reportes SET emision_preparada=emision_preparada||jsonb_build_object('lease_hasta',now()-interval '1 minute') WHERE id=rid;
${actor(4)}${falla("PERFORM pg_temp.cancelar_reserva_emision_kpi_word(rid,'QA reserva vencida')", 'Operador canceló')}
${actor(2)}${falla("PERFORM pg_temp.cancelar_reserva_emision_kpi_word(rid,'QA')", 'Canceló sin motivo')}
PERFORM pg_temp.cancelar_reserva_emision_kpi_word(rid,'QA reserva vencida');
IF current_setting('tracea.motivo',true) NOT LIKE '%QA reserva vencida%' THEN RAISE EXCEPTION 'Motivo no llega a la auditoría'; END IF;
SELECT * INTO r FROM kpi_reportes WHERE id=rid;
IF r.emision_preparada IS NOT NULL OR r.estado<>'borrador' OR r.etapa<>'autorizacion' OR EXISTS(SELECT 1 FROM documentos_generados) THEN RAISE EXCEPTION 'No regresó a autorización'; END IF;
-- reintento tras cancelar: nueva reserva con nuevo token, emisión completa
${actor(3)}s2:=pg_temp.preparar_emision_kpi_word(rid);
IF s2->>'token'=s->>'token' THEN RAISE EXCEPTION 'Reutilizó la reserva cancelada'; END IF;
${falla("PERFORM pg_temp.confirmar_emision_kpi_word(rid,(s->>'token')::uuid,NULL,repeat('a',64))", 'Token cancelado confirmó')}
INSERT INTO objects VALUES('documentos-generados',s2->>'path');
PERFORM pg_temp.confirmar_emision_kpi_word(rid,(s2->>'token')::uuid,NULL,repeat('b',64));
IF (SELECT estado FROM kpi_reportes WHERE id=rid)<>'emitido' OR (SELECT count(*) FROM documentos_generados)<>1 THEN RAISE EXCEPTION 'Reintento no emitió una sola vez'; END IF;
${falla("PERFORM pg_temp.cancelar_reserva_emision_kpi_word(rid,'QA reserva vencida')", 'Canceló un emitido')}
END;`));
  it('K3-b-2 reintento directo del mismo autorizador tras la falla reutiliza la reserva', () => check(`${listo()}${actor(3)}
DECLARE s jsonb; s2 jsonb; BEGIN
s:=pg_temp.preparar_emision_kpi_word(rid); PERFORM pg_temp.reclamar_emision_kpi_word(rid,(s->>'token')::uuid);
IF pg_temp.reclamar_emision_kpi_word(rid,(s->>'token')::uuid) THEN RAISE EXCEPTION 'Doble reclamo con lease vigente'; END IF;
PERFORM set_config('tracea.kpi_reportes_rpc','1',true);UPDATE kpi_reportes SET emision_preparada=emision_preparada||jsonb_build_object('lease_hasta',now()-interval '1 minute') WHERE id=rid;
s2:=pg_temp.preparar_emision_kpi_word(rid);
IF s2->>'token'<>s->>'token' OR NOT pg_temp.reclamar_emision_kpi_word(rid,(s2->>'token')::uuid) THEN RAISE EXCEPTION 'No pudo reintentar'; END IF;
INSERT INTO objects VALUES('documentos-generados',s2->>'path');
PERFORM pg_temp.confirmar_emision_kpi_word(rid,(s2->>'token')::uuid,NULL,repeat('a',64));
IF (SELECT estado FROM kpi_reportes WHERE id=rid)<>'emitido' THEN RAISE EXCEPTION 'Reintento no emitió'; END IF;
END;`));
  it('flujo completo hasta emitido con firmantes, folio DOC y snapshot congelado', () => check(`${listo()}${actor(3)}PERFORM pg_temp.emitir_kpi_reporte(rid);
SELECT * INTO r FROM kpi_reportes WHERE id=rid;
IF r.estado<>'emitido' OR r.codigo<>'IND-2026-001' OR r.firmantes->'autorizo'->>'leyenda'<>'' OR r.firmantes->'elaboro'->>'nombre'<>'QA persona 2' OR jsonb_array_length(r.firmantes->'revisaron')<>1
 OR r.formato_snapshot->>'folio' NOT LIKE 'DOC-%' OR r.datos_snapshot->'indice_sgc'->>'semaforo'<>'rojo' THEN RAISE EXCEPTION 'Emisión incompleta %',row_to_json(r);END IF;
${falla(`PERFORM pg_temp.guardar_kpi_reporte(rid,'{"conclusiones":"cambio"}'::jsonb)`, 'Editó un emitido')}`));
  it('quien elaboró no puede autorizar', () => check(`${listo(3)}${actor(3)}${falla('PERFORM pg_temp.emitir_kpi_reporte(rid)', 'Autoemisión permitida')}
${actor(4)}${falla('PERFORM pg_temp.emitir_kpi_reporte(rid)', 'Operador autorizó')}`));
  it('sin AC activo autoriza el designado y queda la leyenda', () => check(`UPDATE org_members SET role='operador' WHERE user_id='${id(3)}';
${actor(1)}${falla(`PERFORM pg_temp.guardar_kpi_reporte_config('','','',ARRAY['${id(4)}']::uuid[],'QA designación')`, 'RS designó')}
${actor(2)}PERFORM pg_temp.guardar_kpi_reporte_config('','','',ARRAY['${id(4)}']::uuid[],'QA designación');
${listo()}${actor(4)}PERFORM pg_temp.emitir_kpi_reporte(rid);
IF (SELECT firmantes->'autorizo'->>'leyenda' FROM kpi_reportes WHERE id=rid)<>', en ausencia de Aseguramiento de Calidad' THEN RAISE EXCEPTION 'Sin leyenda de ausencia';END IF;`));
  it('con AC en suplencia, la leyenda de suplencia', () => check(`INSERT INTO org_suplencias(id,org_id,suplente_user_id,titular_user_id,titular_nombre,rol_sustituido,facultades,estado,aceptada_en,fecha_inicio,fecha_fin)
 VALUES(gen_random_uuid(),'${ORG}','${id(5)}','${id(3)}','QA persona 3','aseguramiento_calidad',ARRAY['autorizar'],'activa',now(),now()-interval '1 day',now()+interval '5 day');
${listo()}${actor(5)}PERFORM pg_temp.emitir_kpi_reporte(rid);
IF (SELECT firmantes->'autorizo'->>'leyenda' FROM kpi_reportes WHERE id=rid)<>'— En suplencia de QA persona 3' THEN RAISE EXCEPTION 'Sin leyenda de suplencia';END IF;`));
  it('no se emite ni envía si falta el análisis de un KPI SGC en rojo', () => check(`${actor(2)}rid:=pg_temp.crear_kpi_reporte('trimestre','2026-01-01');PERFORM pg_temp.guardar_kpi_reporte(rid,'{"conclusiones":"QA"}'::jsonb);
${falla('PERFORM pg_temp.enviar_kpi_reporte(rid)', 'Envió sin análisis')}
PERFORM pg_temp.guardar_kpi_reporte(rid,${analisis});PERFORM pg_temp.enviar_kpi_reporte(rid);${actor(1)}PERFORM pg_temp.revisar_kpi_reporte(rid,true,'');
PERFORM set_config('tracea.kpi_reportes_rpc','1',true);UPDATE kpi_reportes SET analisis='{}'::jsonb WHERE id=rid;PERFORM set_config('tracea.kpi_reportes_rpc','',true);
${actor(3)}${falla('PERFORM pg_temp.emitir_kpi_reporte(rid)', 'Emitió sin análisis')}`));
  it('el snapshot no cambia si después se corrige un resultado', () => check(`${listo()}${actor(3)}PERFORM pg_temp.emitir_kpi_reporte(rid);
UPDATE kpi_resultados SET numerador=99,valor=99,cumplimiento=1,semaforo='verde';
IF (SELECT (datos_snapshot->'kpis'->0->>'valor')::numeric FROM kpi_reportes WHERE id=rid)<>50 THEN RAISE EXCEPTION 'Snapshot cambió';END IF;
IF (pg_temp.kpi_resumen_periodo('trimestre','2026-01-01','{}')->'kpis'->0->>'valor')::numeric<>99 THEN RAISE EXCEPTION 'Dato vivo no cambió';END IF;`));
  it('nueva versión y anulación con motivo', () => check(`${listo()}${actor(3)}PERFORM pg_temp.emitir_kpi_reporte(rid);${actor(2)}
${falla(`PERFORM pg_temp.nueva_version_kpi_reporte(rid,'')`, 'Nueva versión sin motivo')}
PERFORM pg_temp.nueva_version_kpi_reporte(rid,'QA nueva versión');
IF NOT EXISTS(SELECT 1 FROM kpi_reportes WHERE id=rid AND version=2 AND estado='borrador' AND datos_snapshot IS NULL) OR (SELECT count(*) FROM kpi_reportes_historial WHERE reporte_id=rid AND version=1 AND motivo='QA nueva versión' AND contenido->>'estado'='emitido')<>1 THEN RAISE EXCEPTION 'Nueva versión incorrecta';END IF;
${falla(`PERFORM pg_temp.anular_kpi_reporte(rid,'')`, 'Anuló sin motivo')}
PERFORM pg_temp.anular_kpi_reporte(rid,'QA anulación');IF NOT EXISTS(SELECT 1 FROM kpi_reportes WHERE id=rid AND estado='anulado' AND motivo_anulacion='QA anulación') THEN RAISE EXCEPTION 'No anuló';END IF;
${falla(`DELETE FROM kpi_reportes WHERE id=rid`, 'Borró')}`));
  it('anular emitido: nunca quien lo elaboró ni quien no puede autorizar; sí quien autoriza', () => check(`INSERT INTO org_suplencias(id,org_id,suplente_user_id,titular_user_id,titular_nombre,rol_sustituido,facultades,estado,aceptada_en,fecha_inicio,fecha_fin)
 VALUES(gen_random_uuid(),'${ORG}','${id(5)}','${id(3)}','QA persona 3','aseguramiento_calidad',ARRAY['autorizar'],'activa',now(),now()-interval '1 day',now()+interval '5 day');
${listo(3)}${actor(5)}PERFORM pg_temp.emitir_kpi_reporte(rid);
${actor(3)}${falla(`PERFORM pg_temp.anular_kpi_reporte(rid,'QA autor anula')`, 'El autor anuló el emitido')}
${actor(2)}${falla(`PERFORM pg_temp.anular_kpi_reporte(rid,'QA admin anula')`, 'Admin sin facultad anuló el emitido')}
${actor(5)}PERFORM pg_temp.anular_kpi_reporte(rid,'QA autorizador anula');IF NOT EXISTS(SELECT 1 FROM kpi_reportes WHERE id=rid AND estado='anulado' AND anulado_por='${id(5)}') THEN RAISE EXCEPTION 'Autorizador no anuló';END IF;`));
  it('anular borrador: quien lo elabora o un admin; nadie más', () => check(`${actor(3)}rid:=pg_temp.crear_kpi_reporte('trimestre','2026-01-01');
${actor(4)}${falla(`PERFORM pg_temp.anular_kpi_reporte(rid,'QA operador anula')`, 'Operador anuló borrador')}
${actor(1)}${falla(`PERFORM pg_temp.anular_kpi_reporte(rid,'QA RS anula')`, 'RS no autor anuló borrador')}
${actor(2)}PERFORM pg_temp.anular_kpi_reporte(rid,'QA admin anula');
${actor(3)}rid:=pg_temp.crear_kpi_reporte('trimestre','2026-01-01');PERFORM pg_temp.anular_kpi_reporte(rid,'QA autor anula');
IF (SELECT count(*) FROM kpi_reportes WHERE estado='anulado')<>2 THEN RAISE EXCEPTION 'Anulación de borrador incorrecta';END IF;`));
});
