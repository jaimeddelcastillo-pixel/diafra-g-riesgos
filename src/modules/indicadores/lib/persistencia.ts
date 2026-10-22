import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { vacio, type Catalogo, type Fila, type Hoja } from './catalogo';

export const TABLAS = { Puestos: 'puestos', KPI_SGC: 'kpi_definiciones', KPI_Puesto: 'kpi_puesto' } as const;
export async function listarCatalogo(): Promise<Catalogo> {
  const [puestos, sgc, kp, enlaces] = await Promise.all([
    supabase.from('puestos').select('*').order('codigo'), supabase.from('kpi_definiciones').select('*').order('codigo'),
    supabase.from('kpi_puesto').select('*').order('codigo'), supabase.from('kpi_puesto_aporta').select('*').eq('activo', true),
  ]);
  for (const q of [puestos, sgc, kp, enlaces]) if (q.error) throw q.error;
  const c = vacio(); c.Puestos = (puestos.data ?? []) as unknown as Fila[];
  const p = new Map((puestos.data ?? []).map(x => [x.id, x.codigo]));
  const d = new Map((sgc.data ?? []).map(x => [x.id, x.codigo]));
  c.KPI_SGC = (sgc.data ?? []).map(x => ({ ...x, puesto: p.get(x.puesto_id) ?? '' })) as unknown as Fila[];
  c.KPI_Puesto = (kp.data ?? []).map(x => ({ ...x, puesto: p.get(x.puesto_id) ?? '', aporta_a: (enlaces.data ?? []).filter(e => e.kpi_puesto_id === x.id).map(e => d.get(e.kpi_definicion_id) ?? '').sort().join(', ') })) as unknown as Fila[];
  const ids = [...new Set([...c.KPI_SGC, ...c.KPI_Puesto].map(f => f.validado_por).filter((v): v is string => typeof v === 'string' && !!v))];
  if (ids.length) {
    const { data, error } = await supabase.rpc('nombres_personas', { _ids: ids });
    if (error) throw error;
    const nombres = new Map((data ?? []).map(p => [p.id, p.nombre]));
    for (const f of [...c.KPI_SGC, ...c.KPI_Puesto]) if (typeof f.validado_por === 'string') f.validador_nombre = nombres.get(f.validado_por) ?? f.validado_por;
  }
  return c;
}
export async function aplicarExcel(paquete: Catalogo, motivo: string) {
  const { error } = await supabase.rpc('aplicar_kpis_excel', { _paquete: paquete as unknown as Json, _motivo: motivo }); if (error) throw error;
}
export async function guardarFila(hoja: Hoja, fila: Fila, motivo: string) {
  const c = vacio(); c[hoja] = [fila];
  const { error } = await supabase.rpc('guardar_kpis', { _paquete: c as unknown as Json, _motivo: motivo }); if (error) throw error;
}
export async function validarFila(hoja: Hoja, id: string, motivo: string) {
  const { error } = await supabase.rpc('validar_kpi', { _tabla: TABLAS[hoja], _id: id, _motivo: motivo }); if (error) throw error;
}