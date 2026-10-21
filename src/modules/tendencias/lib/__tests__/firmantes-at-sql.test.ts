import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Executes live T5c functions against temporary-only fixtures, never customer data.
 * Company/access/session helpers are scoped test doubles; actual auth/RLS and the
 * pre-existing AT calculation/issuance guards are not replaced or tested here. */
function ejecutar(cuerpo: string) {
  const nombres = ['tend_firmante_autorizante', 'tend_validar_elegibles', 'tend_validar_firmantes_at', 'tend_at_firmantes_guard', 'tend_at_firmantes_snapshot', 'tend_formato_elegibles_guard'];
  const definiciones = execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: `SELECT string_agg(pg_get_functiondef(p.oid)||';', E'\n') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY(ARRAY[${nombres.map(n => `'${n}'`).join(',')}]);`, encoding: 'utf8', timeout: 30000,
  }).replaceAll('public.', 'pg_temp.').replaceAll('auth.uid()', 'pg_temp.uid()').replace(/::(?:pg_temp\.)?app_role/g, '::text').replaceAll('SECURITY DEFINER', '').replaceAll("SET search_path TO 'public'", 'SET search_path TO pg_temp');
  const setup = `BEGIN;
    CREATE TEMP TABLE org_members(org_id uuid,user_id uuid,role text);
    CREATE TEMP TABLE profiles(id uuid,nombre text,cargo text,activo boolean);
    CREATE TEMP TABLE org_suplencias(org_id uuid,suplente_user_id uuid,revocada_en timestamptz,fecha_inicio timestamptz,fecha_fin timestamptz,facultades text[]);
    CREATE TEMP TABLE tend_formato(org_id uuid,version int,firmantes_elegibles jsonb);
    CREATE TEMP TABLE t5c_at(id int,org_id uuid,estado text,firmantes_at jsonb,elaborado_version_por uuid,formato_snapshot jsonb,datos_snapshot jsonb);
    CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
    CREATE FUNCTION pg_temp.get_user_org_id() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000100'::uuid$$;
    CREATE FUNCTION pg_temp.tend_acceso(uuid,boolean DEFAULT false,text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql AS $$SELECT $1=pg_temp.get_user_org_id()$$;
    CREATE FUNCTION pg_temp.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM pg_temp.org_members WHERE user_id=$1 AND org_id=pg_temp.get_user_org_id() AND role=$2)$$;
    ${definiciones}
    INSERT INTO profiles SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Persona QA '||i,CASE WHEN i=5 THEN NULL ELSE 'Cargo QA '||i END,i<>6 FROM generate_series(1,6) i;
    INSERT INTO org_members SELECT pg_temp.get_user_org_id(),id,CASE WHEN id='00000000-0000-0000-0000-000000000003' THEN 'responsable_sanitario' ELSE 'operador' END FROM profiles WHERE id<>'00000000-0000-0000-0000-000000000004';
    INSERT INTO org_members VALUES('00000000-0000-0000-0000-000000000200','00000000-0000-0000-0000-000000000004','responsable_sanitario');
    CREATE TRIGGER u_firmantes BEFORE INSERT OR UPDATE ON t5c_at FOR EACH ROW EXECUTE FUNCTION pg_temp.tend_at_firmantes_guard();
    CREATE TRIGGER zzz_snapshot BEFORE INSERT OR UPDATE ON t5c_at FOR EACH ROW EXECUTE FUNCTION pg_temp.tend_at_firmantes_snapshot();
    ${cuerpo}
    SELECT 'T5c OK'; ROLLBACK;`;
  return execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], { input: setup, encoding: 'utf8', timeout: 30000 });
}

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const f = (rol: string, n: number, cargo?: string) => JSON.stringify({ rol, user_id: id(n), ...(cargo ? { cargo } : {}) });
const lista = `[${f('Elaboró', 1)},${f('Revisó', 2)},${f('Autorizó', 3)}]`;

describe.skipIf(!process.env.PGHOST)('T5c SQL real sobre fixtures temporales', () => {
  it('acepta RS y suplente vigente; rechaza usuario ajeno, inactivo y suplencia revocada/vencida/sin autorizar', () => {
    const out = ejecutar(`DO $$ DECLARE org uuid:=pg_temp.get_user_org_id(); failed boolean; BEGIN
      IF NOT pg_temp.tend_firmante_autorizante(org,'${id(3)}') OR pg_temp.tend_firmante_autorizante(org,'${id(2)}') OR pg_temp.tend_firmante_autorizante(org,'${id(4)}') THEN RAISE EXCEPTION 'RS o aislamiento incorrecto'; END IF;
      INSERT INTO org_suplencias VALUES(org,'${id(2)}',NULL,now()-interval '1 day',now()+interval '1 day',ARRAY['autorizar']);
      IF NOT pg_temp.tend_firmante_autorizante(org,'${id(2)}') THEN RAISE EXCEPTION 'Suplente vigente rechazado'; END IF;
      UPDATE org_suplencias SET fecha_fin=now() WHERE suplente_user_id='${id(2)}';
      IF pg_temp.tend_firmante_autorizante(org,'${id(2)}') THEN RAISE EXCEPTION 'Suplencia vencida aceptada'; END IF;
      UPDATE org_suplencias SET fecha_fin=now()+interval '1 day',revocada_en=now() WHERE suplente_user_id='${id(2)}';
      IF pg_temp.tend_firmante_autorizante(org,'${id(2)}') THEN RAISE EXCEPTION 'Revocada aceptada'; END IF;
      UPDATE org_suplencias SET revocada_en=NULL,facultades=ARRAY['anular'] WHERE suplente_user_id='${id(2)}';
      IF pg_temp.tend_firmante_autorizante(org,'${id(2)}') THEN RAISE EXCEPTION 'Facultad incorrecta aceptada'; END IF;
      FOR i IN 4..6 LOOP
        IF i=5 THEN CONTINUE; END IF; failed:=false;
        BEGIN PERFORM pg_temp.tend_validar_firmantes_at(org,jsonb_build_array(jsonb_build_object('rol','Revisó','user_id',('00000000-0000-0000-0000-'||lpad(i::text,12,'0')))),NULL,false,'${id(1)}'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Ajeno/inactivo aceptado'; END IF;
      END LOOP;
    END $$;`);
    expect(out).toContain('T5c OK');
  });
  it('valida elegibles y predeterminado, múltiples personas, edición de cargo y rechazos concretos', () => {
    const out = ejecutar(`DO $$ DECLARE org uuid:=pg_temp.get_user_org_id(); failed boolean:=false; v jsonb; BEGIN
      PERFORM pg_temp.tend_validar_elegibles(org,'[{"rol":"Autorizó","user_ids":["${id(3)}"],"default_user_id":"${id(3)}"}]');
      BEGIN PERFORM pg_temp.tend_validar_elegibles(org,'[{"rol":"Autorizó","user_ids":["${id(2)}"]}]'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
      IF NOT failed THEN RAISE EXCEPTION 'Autorizó no RS aceptado'; END IF; failed:=false;
      BEGIN PERFORM pg_temp.tend_validar_elegibles(org,'[{"rol":"Revisó","user_ids":["${id(2)}"],"default_user_id":"${id(3)}"}]'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
      IF NOT failed THEN RAISE EXCEPTION 'Default ajeno a lista aceptado'; END IF;
      v:=pg_temp.tend_validar_firmantes_at(org,'${lista}'::jsonb||'${f('Revisó', 5, 'Cargo escrito QA')}'::jsonb||'${f('Elaboró', 2)}'::jsonb,NULL,true,'${id(1)}');
      IF jsonb_array_length(v)<>5 OR v->0->>'nombre'<>'Persona QA 1' OR v->3->>'cargo'<>'Cargo escrito QA' THEN RAISE EXCEPTION 'Múltiples/perfil/edición falló'; END IF;
      failed:=false;
      BEGIN PERFORM pg_temp.tend_validar_firmantes_at(org,'${lista}'::jsonb||'${f('Revisó', 5)}'::jsonb,NULL,true,'${id(1)}'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
      IF NOT failed THEN RAISE EXCEPTION 'Cargo vacío emitido'; END IF; failed:=false;
      BEGIN PERFORM pg_temp.tend_validar_firmantes_at(org,'${lista}'::jsonb||'${f('Revisó', 2)}'::jsonb,NULL,false,'${id(1)}'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
      IF NOT failed THEN RAISE EXCEPTION 'Duplicado aceptado'; END IF;
    END $$;`);
    expect(out).toContain('T5c OK');
  });
  it('incluye autor, congela ambos snapshots y conserva AT antiguo sin firmantes', () => {
    const out = ejecutar(`DO $$ DECLARE org uuid:=pg_temp.get_user_org_id(); congelado jsonb; failed boolean:=false; BEGIN
      INSERT INTO t5c_at VALUES(1,org,'borrador','[${f('Revisó', 2)},${f('Autorizó', 3)}]','${id(1)}',NULL,NULL);
      IF NOT EXISTS(SELECT 1 FROM t5c_at a CROSS JOIN jsonb_array_elements(a.firmantes_at) f WHERE a.id=1 AND f->>'rol'='Elaboró' AND f->>'user_id'='${id(1)}') THEN RAISE EXCEPTION 'No agregó autor'; END IF;
      UPDATE t5c_at SET estado='emitido',formato_snapshot='{}',datos_snapshot='{"registro_at":{}}' WHERE id=1;
      SELECT firmantes_at INTO congelado FROM t5c_at WHERE id=1;
      IF (SELECT formato_snapshot->'firmantes' FROM t5c_at WHERE id=1) IS DISTINCT FROM congelado OR (SELECT datos_snapshot->'registro_at'->'firmantes_at' FROM t5c_at WHERE id=1) IS DISTINCT FROM congelado THEN RAISE EXCEPTION 'No congeló ambos snapshots'; END IF;
      UPDATE profiles SET nombre='Perfil cambiado QA' WHERE id='${id(2)}';
      IF (SELECT formato_snapshot->'firmantes' FROM t5c_at WHERE id=1) IS DISTINCT FROM congelado THEN RAISE EXCEPTION 'Perfil alteró histórico'; END IF;
      BEGIN UPDATE t5c_at SET firmantes_at='[]' WHERE id=1; EXCEPTION WHEN raise_exception THEN failed:=true; END;
      IF NOT failed THEN RAISE EXCEPTION 'Permitió cambiar emitido'; END IF;
      INSERT INTO t5c_at VALUES(2,org,'emitido',NULL,'${id(1)}','{"firmantes":[{"rol":"Revisó","nombre":"Histórico QA","cargo":"Cargo anterior"}]}','{"registro_at":{}}');
      IF (SELECT firmantes_at FROM t5c_at WHERE id=2) IS NOT NULL OR (SELECT formato_snapshot->'firmantes'->0->>'nombre' FROM t5c_at WHERE id=2)<>'Histórico QA' THEN RAISE EXCEPTION 'Alteró antiguo'; END IF;
    END $$;`);
    expect(out).toContain('T5c OK');
  });
});