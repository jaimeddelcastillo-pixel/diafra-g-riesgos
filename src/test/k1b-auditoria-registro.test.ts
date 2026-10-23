import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { TABLAS_AUDITADAS, MODULOS_AUDITADOS } from '@/config/auditoria';
import { registroEvento } from '@/lib/auditoria';

const psql = (sql: string) => execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', sql]).toString().split('\n').map((x) => x.trim()).filter(Boolean);

describe('K1-b registro completo de la auditoría general', () => {
  it('ninguna tabla que escribe en audit_trail queda sin registrar', () => {
    const porTrigger = psql(`SELECT DISTINCT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND c.relname<>'audit_trail'
      AND (p.proname ILIKE '%audit%' OR pg_get_functiondef(p.oid) ~* 'insert\\s+into\\s+(public\\.)?audit_trail')`);
    const enBitacora = psql(`SELECT DISTINCT tabla FROM public.audit_trail WHERE tabla IS NOT NULL`);
    let enFunciones: string[] = [];
    try {
      enFunciones = execFileSync('rg', ['-oN', '--no-filename', "tabla:\\s*['\"][a-z_.]+['\"]", 'supabase/functions']).toString()
        .split('\n').map((l) => l.match(/['"]([a-z_.]+)['"]/)?.[1]).filter((x): x is string => !!x);
    } catch { /* sin coincidencias */ }
    const faltan = [...new Set([...porTrigger, ...enBitacora, ...enFunciones])].filter((t) => !TABLAS_AUDITADAS[t]).sort();
    expect(faltan).toEqual([]);
  });

  it('cada tabla pertenece a un módulo conocido y nunca muestra UUID', () => {
    const uuid = '6f1c2b9e-1111-4222-8333-444455556666';
    for (const [tabla, t] of Object.entries(TABLAS_AUDITADAS)) {
      expect(MODULOS_AUDITADOS[t.modulo], tabla).toBeTruthy();
      const r = registroEvento({ id: 'x', created_at: '', user_id: null, tabla, registro_id: uuid, accion: 'INSERT', valor_anterior: null,
        valor_nuevo: { id: uuid, org_id: uuid, folio_id: uuid }, motivo: null, origen: null, solicitado_por: null, autorizado_por: null });
      expect(r, tabla).not.toContain(uuid);
    }
  });
});
