import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

/** T4h: copia exacta del cuerpo productivo de la importación, ejecutada contra las tablas reales con sus
 * disparadores reales (tend_guard, auditoría), en la empresa QA es_prueba, dentro de BEGIN … ROLLBACK.
 * Solo se sustituyen auth.uid(), contexto_org_actual() y tend_acceso() de la RPC (el entorno de pruebas no puede
 * ejecutarlas); el rol authenticated y RLS no se simulan aquí. Nada se conserva en la base.
 */
const ORG='3868f88a-fa36-4467-9b31-653143c6ef7d';
const USUARIO='4101c851-a9ac-480b-a1a2-8c3403a44ed4';

function cuerpoRpc(){
  const archivo=process.env.T4H_SQL ?? `drizzle/migrations/${readdirSync('drizzle/migrations').filter(f=>f.includes('t4h_catalogo_excel_por_conjuntos')).sort().at(-1)}`;
  const sql=readFileSync(archivo,'utf8');
  const rpc=sql.slice(sql.indexOf('-- t4h:rpc:inicio'),sql.indexOf('-- t4h:rpc:fin'));
  expect(rpc).toContain('ON CONFLICT (id) DO UPDATE');
  expect(rpc).not.toMatch(/EXECUTE\s+format/i);
  expect(rpc).not.toMatch(/FOR\s+UPDATE/i);
  return rpc.replace('CREATE OR REPLACE FUNCTION public.tend_importar_catalogo_excel','CREATE FUNCTION pg_temp.tend_importar_catalogo_excel')
    .replace(/\n SECURITY DEFINER\n/,'\n')
    .replaceAll('public.contexto_org_actual()','pg_temp.contexto_org_actual()')
    .replaceAll('public.tend_acceso(','pg_temp.tend_acceso(')
    .replaceAll('auth.uid()','pg_temp.uid()');
}

function ejecutar(cuerpo:string){
  const setup=`BEGIN;
    SET LOCAL request.jwt.claims='{"sub":"${USUARIO}","role":"authenticated"}';
    CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
    CREATE FUNCTION pg_temp.contexto_org_actual() RETURNS TABLE(org_id uuid) LANGUAGE sql AS $$ select id from public.organizations where es_prueba and id='${ORG}' $$;
    CREATE FUNCTION pg_temp.tend_acceso(uuid,boolean,text[]) RETURNS boolean LANGUAGE sql AS 'select $1 is not null';
    CREATE TEMP TABLE t4h_resultado(clave text, valor numeric);
    ${cuerpoRpc()}
    ${cuerpo}
    SELECT clave||'='||valor FROM t4h_resultado ORDER BY clave;
    ROLLBACK;`;
  return execFileSync('psql',['-X','-q','-v','ON_ERROR_STOP=1','-At'],{input:setup,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000});
}

const fila=(hoja:string,valores:Record<string,unknown>,estado='nuevo',anterior='null')=>`jsonb_build_object('hoja','${hoja}','estado','${estado}','errores','[]'::jsonb,'anterior',${anterior}::jsonb,'valores','${JSON.stringify(valores).replaceAll("'","''")}'::jsonb)`;

describe.skipIf(!process.env.PGHOST)('T4h importación del catálogo por conjuntos (PostgreSQL, reversión total)',()=>{
  it('alta, cambio, auditoría motivada, bloqueo, reversión, relaciones, saturación y retiro sin borrar',()=>{
    const out=ejecutar(`DO $$ DECLARE org uuid:='${ORG}'; pkg jsonb; failed boolean:=false; row_before jsonb; antes integer; BEGIN
      pkg:=jsonb_build_object('version','T4e-1','filas',jsonb_build_array(${fila('Sistemas_HVAC',{codigo:'T4H-QA',nombre_uma:'Inicial',descripcion:'',activo:true})}));
      PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba automática T4h');
      IF (SELECT nombre_uma FROM tend_sistemas_hvac WHERE org_id=org AND codigo='T4H-QA') IS DISTINCT FROM 'Inicial' THEN RAISE EXCEPTION 'Alta falló'; END IF;
      SELECT to_jsonb(t) INTO row_before FROM tend_sistemas_hvac t WHERE org_id=org AND codigo='T4H-QA';
      pkg:=jsonb_set(pkg,'{filas,0,anterior}',row_before);pkg:=jsonb_set(pkg,'{filas,0,estado}','"cambia"');pkg:=jsonb_set(pkg,'{filas,0,valores,nombre_uma}','"Corregida"');
      PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Corrección automática T4h');
      IF (SELECT nombre_uma FROM tend_sistemas_hvac WHERE org_id=org AND codigo='T4H-QA') IS DISTINCT FROM 'Corregida' THEN RAISE EXCEPTION 'Cambio falló'; END IF;
      IF (SELECT count(*) FROM audit_trail WHERE org_id=org AND tabla='tend_sistemas_hvac' AND motivo='Prueba automática T4h' AND accion='INSERT' AND user_id='${USUARIO}' AND valor_nuevo->>'codigo'='T4H-QA')<>1
        OR (SELECT count(*) FROM audit_trail WHERE org_id=org AND motivo='Corrección automática T4h' AND accion='UPDATE' AND valor_anterior->>'nombre_uma'='Inicial' AND valor_nuevo->>'nombre_uma'='Corregida')<>1
        THEN RAISE EXCEPTION 'Auditoría por renglón falló'; END IF;
      -- Concurrencia optimista: el mismo paquete con el "anterior" ya viejo se rechaza.
      BEGIN PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba vista previa vieja'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
      IF NOT failed THEN RAISE EXCEPTION 'Vista previa vieja aceptada'; END IF;
      SELECT count(*) INTO antes FROM audit_trail WHERE org_id=org AND created_at=now();
      failed:=false;
      pkg:=jsonb_build_object('version','T4e-1','filas',jsonb_build_array(${fila('Sistemas_HVAC',{codigo:'ROLLBACK-QA',nombre_uma:'No conservar',descripcion:'',activo:true})},${fila('Areas',{codigo:'ERROR-QA',nombre:'Inválida',iso:'ISO-99',activo:true})}));
      BEGIN PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba de reversión T4h'); EXCEPTION WHEN check_violation THEN failed:=true; END;
      IF NOT failed OR EXISTS(SELECT 1 FROM tend_sistemas_hvac WHERE org_id=org AND codigo='ROLLBACK-QA') OR (SELECT count(*) FROM audit_trail WHERE org_id=org AND created_at=now())<>antes THEN RAISE EXCEPTION 'Reversión falló'; END IF;
      failed:=false;pkg:=jsonb_set(pkg,'{version}','"otra"');
      BEGIN PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba versión inválida'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
      IF NOT failed THEN RAISE EXCEPTION 'Versión inválida aceptada'; END IF;
      pkg:=jsonb_build_object('version','T4e-1','filas',jsonb_build_array(
        ${fila('Areas',{codigo:'AREA-T4H',nombre:'Área QA',iso:'ISO-8',hvac_codigo:'T4H-QA',activo:true})},
        ${fila('Instrumentos',{codigo:'FILTRO-T4H',tipo:'manometro_filtro',clase_instrumento:'filtro_ducto',parametro:'ΔP de filtro',area_codigo:'AREA-T4H',escala_unidad:'Pa',spec_estado:'pendiente',activo:true})},
        ${fila('Objetivos_presion',{codigo:'OBJ-T4H',nombre:'Objetivo QA',uso:'par de cuartos',instrumento_codigo:'FILTRO-T4H',cuarto_x_codigo:'AREA-T4H',limite_normativo_pa:5,unidad:'Pa',activo:true})},
        ${fila('Objetivos_presion',{uso:'saturación',instrumento_codigo:'FILTRO-T4H',dp_final_fabricante:250,escala_unidad:'Pa',activo:true})}));
      PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba relación y saturación');
      IF NOT EXISTS(SELECT 1 FROM tend_instrumentos i JOIN tend_areas a ON a.id=i.area_id JOIN tend_sistemas_hvac h ON h.id=a.hvac_id JOIN tend_objetivos_presion o ON o.instrumento_id=i.id WHERE i.org_id=org AND i.codigo='FILTRO-T4H' AND i.dp_final_fabricante=250 AND i.baseline_tolerancia_pct=25 AND NOT i.spec_lie_estricto AND o.limite_normativo_pa=5 AND o.unidad='Pa' AND h.codigo='T4H-QA' AND i.created_by='${USUARIO}') THEN RAISE EXCEPTION 'Relaciones de catálogo fallaron'; END IF;
      IF (SELECT count(*) FROM audit_trail WHERE org_id=org AND motivo='Prueba relación y saturación')<>4 THEN RAISE EXCEPTION 'Auditoría de relaciones falló'; END IF;
      SELECT to_jsonb(i) INTO row_before FROM tend_instrumentos i WHERE org_id=org AND codigo='FILTRO-T4H';
      pkg:=jsonb_build_object('version','T4e-1','filas',jsonb_build_array(jsonb_build_object('hoja','Instrumentos','estado','cambia','errores','[]'::jsonb,'anterior',row_before,'valores',jsonb_build_object('codigo','FILTRO-T4H','tipo','manometro_filtro','clase_instrumento','filtro_ducto','parametro','ΔP de filtro','area_codigo','AREA-T4H','escala_unidad','Pa','spec_estado','pendiente','activo',false))));
      PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Prueba desactivación motivada');
      IF NOT EXISTS(SELECT 1 FROM tend_instrumentos WHERE org_id=org AND codigo='FILTRO-T4H' AND NOT activo AND dp_final_fabricante=250) THEN RAISE EXCEPTION 'Retiro sin borrar falló'; END IF;
      IF current_setting('tracea.catalogo_lote',true)<>'' THEN RAISE EXCEPTION 'El lote quedó abierto'; END IF;
      INSERT INTO t4h_resultado VALUES('funcional',1);
    END $$;`);
    expect(out).toContain('funcional=1');
  },60000);

  it('rendimiento: 200 renglones (alta y cambio) en menos de 2 s cada uno, con auditoría completa',()=>{
    const out=ejecutar(`DO $$ DECLARE org uuid:='${ORG}'; pkg jsonb; t0 timestamptz; ms numeric; BEGIN
      SELECT jsonb_build_object('version','T4e-1','filas',
        (SELECT jsonb_agg(jsonb_build_object('hoja','Sistemas_HVAC','estado','nuevo','errores','[]'::jsonb,'anterior',null,'valores',jsonb_build_object('codigo','T4H-H'||g,'nombre_uma','UMA '||g,'descripcion','','activo',true))) FROM generate_series(1,20) g)
        ||(SELECT jsonb_agg(jsonb_build_object('hoja','Areas','estado','nuevo','errores','[]'::jsonb,'anterior',null,'valores',jsonb_build_object('codigo','T4H-A'||g,'nombre','Área '||g,'iso','ISO-8','hvac_codigo','T4H-H'||(1+g%20),'activo',true))) FROM generate_series(1,100) g)
        ||(SELECT jsonb_agg(jsonb_build_object('hoja','Instrumentos','estado','nuevo','errores','[]'::jsonb,'anterior',null,'valores',jsonb_build_object('codigo','T4H-I'||g,'tipo','manometro_diferencial','clase_instrumento','diferencial_sala','parametro','Presión diferencial','area_codigo','T4H-A'||g,'escala_unidad','Pa','spec_estado','validada','spec_lie',5,'spec_lie_estricto',true,'activo',true))) FROM generate_series(1,60) g)
        ||(SELECT jsonb_agg(jsonb_build_object('hoja','Objetivos_presion','estado','nuevo','errores','[]'::jsonb,'anterior',null,'valores',jsonb_build_object('codigo','T4H-O'||g,'nombre','Objetivo '||g,'uso','par de cuartos','instrumento_codigo','T4H-I'||g,'cuarto_x_codigo','T4H-A'||g,'cuarto_y_codigo','T4H-A'||(g+20),'limite_normativo_pa',10,'unidad','Pa','activo',true))) FROM generate_series(1,20) g)) INTO pkg;
      IF jsonb_array_length(pkg->'filas')<>200 THEN RAISE EXCEPTION 'Paquete de prueba incompleto'; END IF;
      t0:=clock_timestamp();
      PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Rendimiento T4h alta');
      ms:=round(extract(epoch FROM clock_timestamp()-t0)*1000);
      INSERT INTO t4h_resultado VALUES('alta_ms',ms),('alta_auditoria',(SELECT count(*) FROM audit_trail WHERE org_id=org AND motivo='Rendimiento T4h alta'));
      IF (SELECT count(*) FROM tend_instrumentos WHERE org_id=org AND codigo LIKE 'T4H-I%' AND spec_texto='> 5 Pa')<>60 THEN RAISE EXCEPTION 'Alta masiva incompleta'; END IF;
      SELECT jsonb_build_object('version','T4e-1','filas',
        (SELECT jsonb_agg(jsonb_build_object('hoja','Sistemas_HVAC','estado','cambia','errores','[]'::jsonb,'anterior',to_jsonb(t),'valores',jsonb_build_object('codigo',t.codigo,'nombre_uma',t.nombre_uma||' rev','descripcion','','activo',true))) FROM tend_sistemas_hvac t WHERE t.org_id=org AND t.codigo LIKE 'T4H-H%')
        ||(SELECT jsonb_agg(jsonb_build_object('hoja','Areas','estado','cambia','errores','[]'::jsonb,'anterior',to_jsonb(t),'valores',jsonb_build_object('codigo',t.codigo,'nombre',t.nombre||' rev','iso','ISO-7','hvac_codigo','T4H-H1','activo',true))) FROM tend_areas t WHERE t.org_id=org AND t.codigo LIKE 'T4H-A%')
        ||(SELECT jsonb_agg(jsonb_build_object('hoja','Instrumentos','estado','cambia','errores','[]'::jsonb,'anterior',to_jsonb(t),'valores',jsonb_build_object('codigo',t.codigo,'tipo',t.tipo,'clase_instrumento',t.clase_instrumento,'parametro',t.parametro,'area_codigo',replace(t.codigo,'-I','-A'),'escala_unidad','Pa','spec_estado','validada','spec_lie',10,'spec_lie_estricto',true,'activo',true))) FROM tend_instrumentos t WHERE t.org_id=org AND t.codigo LIKE 'T4H-I%')
        ||(SELECT jsonb_agg(jsonb_build_object('hoja','Objetivos_presion','estado','cambia','errores','[]'::jsonb,'anterior',to_jsonb(t),'valores',jsonb_build_object('codigo',t.codigo,'nombre',t.nombre,'uso','par de cuartos','instrumento_codigo',replace(t.codigo,'-O','-I'),'cuarto_x_codigo',replace(t.codigo,'-O','-A'),'limite_normativo_pa',15,'unidad','Pa','activo',true))) FROM tend_objetivos_presion t WHERE t.org_id=org AND t.codigo LIKE 'T4H-O%')) INTO pkg;
      IF jsonb_array_length(pkg->'filas')<>200 THEN RAISE EXCEPTION 'Paquete de cambio incompleto'; END IF;
      t0:=clock_timestamp();
      PERFORM pg_temp.tend_importar_catalogo_excel(pkg,'Rendimiento T4h cambio');
      ms:=round(extract(epoch FROM clock_timestamp()-t0)*1000);
      INSERT INTO t4h_resultado VALUES('cambio_ms',ms),('cambio_auditoria',(SELECT count(*) FROM audit_trail WHERE org_id=org AND motivo='Rendimiento T4h cambio' AND accion='UPDATE' AND valor_anterior IS NOT NULL));
      IF (SELECT count(*) FROM tend_areas WHERE org_id=org AND codigo LIKE 'T4H-A%' AND iso='ISO-7' AND nombre LIKE '% rev')<>100 THEN RAISE EXCEPTION 'Cambio masivo incompleto'; END IF;
    END $$;`);
    const valores=Object.fromEntries(out.trim().split('\n').filter(l=>l.includes('=')).map(l=>{const [k,v]=l.split('=');return [k,Number(v)];}));
    console.info('T4h rendimiento (ms):',valores);
    expect(valores.alta_auditoria).toBe(200);
    expect(valores.cambio_auditoria).toBe(200);
    expect(valores.alta_ms).toBeLessThan(2000);
    expect(valores.cambio_ms).toBeLessThan(2000);
  },60000);
});
