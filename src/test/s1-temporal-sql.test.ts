import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
describe('S-1 bloqueo temporal del servidor, tablas QA con rollback', () => {
  it('bloquea consultas antes del cambio, permite consultar el indicador y habilita tras confirmar sin guardar secretos', () => {
    const exec = (input: string) => execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', timeout: 60000 });
    const defs = exec("SELECT string_agg(pg_get_functiondef(oid)||';',E'\\n') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('requiere_cambio_temporal','s1_acceso_previo','marcar_password_temporal','confirmar_password_temporal')")
      .replaceAll('public.', 'pg_temp.').replaceAll('auth.uid()', 'pg_temp.uid()').replaceAll('auth.role()', 'pg_temp.role()').replaceAll('SECURITY DEFINER', '').replaceAll('SET search_path TO public', 'SET search_path TO pg_temp,public');
    const output = exec(`BEGIN; SET LOCAL check_function_bodies=off;
CREATE TEMP TABLE usuario_acceso_temporal (LIKE public.usuario_acceso_temporal INCLUDING DEFAULTS INCLUDING INDEXES);
CREATE TEMP TABLE audit_trail (LIKE public.audit_trail INCLUDING DEFAULTS);
CREATE FUNCTION pg_temp.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION pg_temp.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('qa.role')$$;
${defs}
DO $$DECLARE blocked boolean:=false; BEGIN
PERFORM set_config('qa.role','service_role',true);
PERFORM pg_temp.marcar_password_temporal(pg_temp.uid(),'00000000-0000-0000-0000-000000000100',pg_temp.uid());
PERFORM set_config('qa.role','authenticated',true); PERFORM set_config('request.path','/rpc/requiere_cambio_temporal',true); PERFORM pg_temp.s1_acceso_previo();
IF NOT pg_temp.requiere_cambio_temporal() THEN RAISE EXCEPTION 'No marcó temporal'; END IF;
PERFORM set_config('request.path','/profiles',true);
BEGIN PERFORM pg_temp.s1_acceso_previo(); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'Permitió consulta temporal'; END IF;
BEGIN PERFORM pg_temp.confirmar_password_temporal(pg_temp.uid()); RAISE EXCEPTION 'Usuario confirmó sin servidor'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Usuario confirmó sin servidor' THEN RAISE; END IF; END;
PERFORM set_config('qa.role','service_role',true); PERFORM pg_temp.confirmar_password_temporal(pg_temp.uid());
PERFORM set_config('qa.role','authenticated',true); PERFORM pg_temp.s1_acceso_previo();
IF pg_temp.requiere_cambio_temporal() OR (SELECT count(*) FROM audit_trail)<>2 OR EXISTS(SELECT 1 FROM audit_trail WHERE valor_nuevo ? 'password' OR valor_anterior ? 'password') THEN RAISE EXCEPTION 'Acceso o auditoría inválidos'; END IF;
END $$; SELECT 'S1 OK'; ROLLBACK;`);
    expect(output).toContain('S1 OK');
  });
});