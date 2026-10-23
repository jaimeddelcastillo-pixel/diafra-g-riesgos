import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/modules', () => ({ modulos: [] }));
vi.mock('xlsx', () => ({}));

import { construirNavegacion } from '@/config/navigation';
import { isItemVisible } from '@/hooks/useNavigationItems';
import { accionLegible, aplicarFiltrosAuditoria, cambiosEvento, FILTROS_VACIOS, registroEvento, titularesSuplencia, type EventoAuditoria } from '@/lib/auditoria';
import { MENSAJE_PESO, previsualizar, vacio } from '@/modules/indicadores/lib/catalogo';

const ORG = 'org-1';
const ev = (i: number, p: Partial<EventoAuditoria> = {}): EventoAuditoria => ({
  id: `e${String(i).padStart(4, '0')}`, created_at: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(), user_id: 'u1', tabla: 'kpi_puesto',
  registro_id: `r${i}`, accion: 'INSERT', valor_anterior: null, valor_nuevo: { codigo: `CARGA-${i}`, nombre: 'Masivo' }, motivo: 'Carga', origen: null,
  solicitado_por: null, autorizado_por: null, suplencias: null, org_id: ORG, ...p,
} as EventoAuditoria);

/** Constructor en memoria con la semántica de los filtros PostgREST usados. */
function fake(rows: Record<string, any>[]) {
  let r = [...rows];
  const json = (row: any, path: string) => { const [col, key] = path.split('->>'); return key ? row[col]?.[key] : row[col]; };
  const b: any = {
    eq: (c: string, v: any) => { r = r.filter((x) => json(x, c) === v); return b; },
    in: (c: string, v: any[]) => { r = r.filter((x) => v.includes(x[c])); return b; },
    gte: (c: string, v: string) => { r = r.filter((x) => x[c] >= v); return b; },
    lte: (c: string, v: string) => { r = r.filter((x) => x[c] <= v); return b; },
    or: (s: string) => {
      const conds = s.split(',').map((p) => { const m = p.match(/^(.+?)\.(ilike|eq)\.(.*)$/)!; return m; });
      r = r.filter((x) => conds.some(([, c, op, v]) => {
        const val = json(x, c); if (val == null) return false;
        return op === 'eq' ? String(val) === v : String(val).toLowerCase().includes(v.replaceAll('*', '').toLowerCase());
      }));
      return b;
    },
    order: (c: string, o: { ascending: boolean }) => { r.sort((a, z) => (a[c] < z[c] ? -1 : a[c] > z[c] ? 1 : 0) * (o.ascending ? 1 : -1)); return b; },
    range: (a: number, z: number) => r.slice(a, z + 1),
    total: () => r.length,
  };
  return b;
}

describe('K1-a auditoría general', () => {
  it('con más de 100 eventos, el filtro encuentra uno antiguo', () => {
    const rows = [ev(0, { tabla: 'kpi_definiciones', valor_nuevo: { codigo: 'F1', nombre: 'Antiguo' } }), ...Array.from({ length: 180 }, (_, i) => ev(i + 1))];
    const sinFiltro = aplicarFiltrosAuditoria(fake(rows), ORG, FILTROS_VACIOS).range(0, 49);
    expect(sinFiltro.some((x: any) => x.id === 'e0000')).toBe(false);
    const q = aplicarFiltrosAuditoria(fake(rows), ORG, { ...FILTROS_VACIOS, modulo: 'indicadores', codigo: 'F1' });
    expect(q.range(0, 49).map((x: any) => x.id)).toEqual(['e0000']);
  });

  it('kpi_puesto_aporta se filtra y muestra por código, nunca por UUID', () => {
    const ref = { 'kp-1': 'OPE-FAB-01', 'kd-1': 'F1' };
    const e = ev(1, { tabla: 'kpi_puesto_aporta', valor_nuevo: { kpi_puesto_id: 'kp-1', kpi_definicion_id: 'kd-1' } });
    expect(registroEvento(e, ref)).toBe('OPE-FAB-01 aporta a F1');
    expect(aplicarFiltrosAuditoria(fake([e, ev(2)]), ORG, { ...FILTROS_VACIOS, codigo: 'OPE-FAB' }, ref).range(0, 9)).toHaveLength(1);
  });

  it('un cambio de Indicadores muestra antes → después y su motivo', () => {
    const e = ev(1, { tabla: 'kpi_definiciones', accion: 'UPDATE', motivo: 'Ajuste de meta anual',
      valor_anterior: { codigo: '1', meta: 95, estado: 'validado', updated_at: 'a' },
      valor_nuevo: { codigo: '1', meta: 90, estado: 'borrador', updated_at: 'b' },
      suplencias: [{ titular_nombre: 'Janet Gil' }] });
    expect(cambiosEvento(e)).toEqual([{ campo: 'meta', antes: '95', despues: '90' }, { campo: 'estado', antes: 'validado', despues: 'borrador' }]);
    expect(e.motivo).toBe('Ajuste de meta anual');
    expect(accionLegible(e)).toBe('Regreso a borrador');
    expect(titularesSuplencia(e)).toEqual(['Janet Gil']);
    expect(accionLegible({ accion: 'UPDATE', valor_anterior: { activo: true }, valor_nuevo: { activo: false } })).toBe('Retiro');
    expect(accionLegible({ accion: 'UPDATE', valor_anterior: { estado: 'borrador' }, valor_nuevo: { estado: 'validado' } })).toBe('Validación');
  });

  const item = construirNavegacion([]).find((i) => i.id === 'auditoria')!;
  const ctx = (roles: string[], features: Record<string, boolean>) => ({ plan: 'starter', roles, isSuperAdmin: false, features });
  it('un operador no ve «Auditoría» en el menú', () => {
    expect(isItemVisible(item, ctx(['operador'], { riesgos: true }))).toBe(false);
    expect(isItemVisible(item, ctx(['lectura'], { riesgos: true }))).toBe(false);
  });
  it('una empresa con solo Indicadores sí la ve', () => {
    for (const r of ['admin', 'responsable_sanitario', 'comite_tecnico', 'aseguramiento_calidad']) expect(isItemVisible(item, ctx([r], { indicadores: true, riesgos: false }))).toBe(true);
    expect(isItemVisible(item, ctx(['admin'], {}))).toBe(false);
  });

  it('un peso en un KPI operativo se rechaza (pantalla y base de datos)', () => {
    const c = vacio();
    c.Puestos = [{ codigo: 'AC', nombre: 'Calidad', area: 'QA', activo: true }];
    c.KPI_SGC = [{ codigo: 'O1', nombre: 'Operativo', proceso: 'P', nivel: 'Operativo', puesto: 'AC', frecuencia: 'mensual', tendencia: 'positiva', meta: 1, unidad: '%', peso: 10, activo: true }];
    expect(previsualizar(c, vacio()).errores.some((e) => e.includes(MENSAJE_PESO))).toBe(true);
    c.KPI_SGC[0].peso = 0;
    expect(previsualizar(c, vacio()).errores).toEqual([]);
    const sql = `BEGIN;CREATE TEMP TABLE k(LIKE public.kpi_definiciones INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
DO $$BEGIN
INSERT INTO k(org_id,codigo,nombre,puesto_id,nivel,peso) VALUES(gen_random_uuid(),'S1','SGC',gen_random_uuid(),'SGC',40);
INSERT INTO k(org_id,codigo,nombre,puesto_id,nivel,peso) VALUES(gen_random_uuid(),'O0','Op',gen_random_uuid(),'Operativo',0);
BEGIN INSERT INTO k(org_id,codigo,nombre,puesto_id,nivel,peso) VALUES(gen_random_uuid(),'O1','Op',gen_random_uuid(),'Operativo',10); RAISE EXCEPTION 'no rechazó';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'rechazado'; END;
END$$;SELECT 'OK';ROLLBACK;`;
    expect(execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1'], { input: sql }).toString()).toContain('OK');
  });
});
