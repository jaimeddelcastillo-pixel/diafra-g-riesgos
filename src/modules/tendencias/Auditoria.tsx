import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx-js-style';
import { Bot, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { nombresPersonas } from '@/lib/nombresPersonas';
import Marco from './Marco';

/** Auditoría de Tendencias (T4i): bitácora de solo lectura de las tablas tend_* de la empresa activa.
 *  Mismo patrón que «Auditoría de Cerebro»; no depende del módulo Gestión de Riesgos. */

const TABLAS: Record<string, string> = {
  tend_sistemas_hvac: 'Sistema HVAC',
  tend_areas: 'Área',
  tend_instrumentos: 'Instrumento',
  tend_objetivos_presion: 'Objetivo de presión',
  tend_cambios_filtro: 'Cambio de filtro',
  tend_registros: 'Registro',
  tend_semanas: 'Semana de lecturas',
  tend_registros_at: 'Reporte AT',
  tend_registros_at_historial: 'Historial de reporte AT',
  tend_formato: 'Plantilla del reporte',
  tend_config: 'Configuración',
  tend_extracciones: 'Extracción de bitácora',
  tend_norma_especificaciones: 'Catálogo normativo',
};
const ACCIONES: Record<string, string> = {
  INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Baja',
  SEMANA_CORREGIDA: 'Semana corregida', REGISTRO_RETIRADO: 'Retiro',
  CATALOGO_EXCEL: 'Importación de catálogo (Excel)',
};
const IGNORAR = new Set(['updated_at', 'org_id']);
const PAGE = 100;
const MAX_EXPORT = 50000;
const COLS = 'id, created_at, user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo, motivo, origen, solicitado_por, autorizado_por';

type Fila = {
  id: string; created_at: string; user_id: string | null; tabla: string; registro_id: string | null;
  accion: string; valor_anterior: Record<string, unknown> | null; valor_nuevo: Record<string, unknown> | null;
  motivo: string | null; origen: string | null; solicitado_por: string | null; autorizado_por: string | null;
};
type Filtros = { desde: string; hasta: string; tabla: string; accion: string; persona: string };

const fmt = (v: unknown): string => (v === null || v === undefined || v === '' ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function cambios(f: Fila): string {
  const a = f.valor_anterior ?? {}, n = f.valor_nuevo ?? {};
  if (!Object.keys(a).length) return '';
  return Object.keys(n)
    .filter((k) => !IGNORAR.has(k) && JSON.stringify(a[k]) !== JSON.stringify(n[k]))
    .map((k) => `${k}: ${fmt(a[k])} → ${fmt(n[k])}`)
    .join('; ');
}

function etiquetaRegistro(f: Fila): string {
  const r = f.valor_nuevo ?? f.valor_anterior ?? {};
  return String(r.codigo ?? r.nombre ?? r.nombre_uma ?? r.semana_inicio ?? r.fecha ?? f.registro_id ?? '—');
}

function aplicarFiltros(q: any, orgId: string, f: Filtros) {
  q = q.eq('org_id', orgId).like('tabla', 'tend\\_%');
  if (f.desde) q = q.gte('created_at', new Date(f.desde + 'T00:00:00').toISOString());
  if (f.hasta) q = q.lte('created_at', new Date(f.hasta + 'T23:59:59.999').toISOString());
  if (f.tabla) q = q.eq('tabla', f.tabla);
  if (f.accion) q = q.eq('accion', f.accion);
  if (f.persona) q = q.eq('user_id', f.persona);
  return q.order('created_at', { ascending: false }).order('id', { ascending: false });
}

/** Origen legible sin atribuir al sistema algo que hizo una persona ni viceversa. */
function responsable(f: Fila, perfiles: Record<string, string>): { texto: string; sistema: boolean } {
  if (f.origen === 'sistema' || !f.user_id) {
    const solicitante = f.solicitado_por ?? f.autorizado_por;
    return { texto: solicitante ? `Sistema / migración, a solicitud de ${perfiles[solicitante] ?? solicitante}` : 'Sistema / migración', sistema: true };
  }
  return { texto: perfiles[f.user_id] ?? f.user_id, sistema: false };
}

function idsDePersonas(filas: Fila[]): string[] {
  const s = new Set<string>();
  for (const f of filas) [f.user_id, f.solicitado_por, f.autorizado_por].forEach((x) => x && s.add(x));
  return [...s];
}

export default function Auditoria() {
  const { orgId, org, roles, isSuperAdmin, profile, user } = useAuth();
  const permitido = isSuperAdmin() || roles.includes('admin' as never) || roles.includes('responsable_sanitario' as never);
  const { data: miembrosActuales = [] } = useProfiles();
  const { data: miembros = [] } = useQuery({
    queryKey: ['tend-auditoria-personas', orgId, (miembrosActuales as { id: string }[]).length],
    enabled: permitido && !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from('audit_trail').select('user_id')
        .eq('org_id', orgId!).like('tabla', 'tend\\_%').not('user_id', 'is', null).limit(10000);
      const ids = new Set<string>((miembrosActuales as { id: string; nombre: string }[]).map((m) => m.id));
      (data ?? []).forEach((r) => r.user_id && ids.add(r.user_id));
      const nombres = await nombresPersonas([...ids]);
      (miembrosActuales as { id: string; nombre: string }[]).forEach((m) => { if (!nombres[m.id]) nombres[m.id] = m.nombre; });
      return [...ids].map((id) => ({ id, nombre: nombres[id] ?? id })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
  });

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tabla, setTabla] = useState('');
  const [accion, setAccion] = useState('');
  const [persona, setPersona] = useState('');
  const [codigo, setCodigo] = useState('');
  const [exportando, setExportando] = useState(false);
  const filtros: Filtros = { desde, hasta, tabla, accion, persona };

  const q = useInfiniteQuery({
    queryKey: ['tend-auditoria', orgId, filtros],
    enabled: permitido && !!orgId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error, count } = await aplicarFiltros(
        supabase.from('audit_trail').select(COLS, { count: 'exact' }), orgId!, filtros,
      ).range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return { filas: (data ?? []) as unknown as Fila[], count: count ?? 0, next: pageParam + PAGE };
    },
    getNextPageParam: (last) => (last.next < last.count ? last.next : undefined),
  });
  const filas = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.filas), [q.data]);
  const total = q.data?.pages[0]?.count ?? 0;

  const userIds = useMemo(() => idsDePersonas(filas), [filas]);
  const { data: perfiles = {} } = useQuery({
    queryKey: ['tend-auditoria-perfiles', userIds],
    enabled: userIds.length > 0,
    queryFn: () => nombresPersonas(userIds),
  });

  const vista = (f: Fila, p: Record<string, string>) => {
    const resp = responsable(f, p);
    return {
      f, fecha: new Date(f.created_at), persona: resp.texto, sistema: resp.sistema,
      accion: ACCIONES[f.accion] ?? f.accion, que: TABLAS[f.tabla] ?? f.tabla,
      registro: etiquetaRegistro(f), cambios: cambios(f), motivo: f.motivo ?? '',
    };
  };
  const filasVista = useMemo(() => {
    const c = codigo.trim().toLocaleLowerCase('es');
    return filas.map((f) => vista(f, perfiles as Record<string, string>))
      .filter((v) => !c || v.registro.toLocaleLowerCase('es').includes(c));
  }, [filas, perfiles, codigo]);

  const exportarExcel = async () => {
    if (!orgId) return;
    if (total > MAX_EXPORT) {
      toast.error(`El filtro devuelve ${total.toLocaleString('es-MX')} eventos. El máximo para exportar es ${MAX_EXPORT.toLocaleString('es-MX')}; acota el filtro.`);
      return;
    }
    setExportando(true);
    try {
      const todas: Fila[] = [];
      for (let from = 0; from < MAX_EXPORT; from += 1000) {
        const { data, error } = await aplicarFiltros(supabase.from('audit_trail').select(COLS), orgId, filtros).range(from, from + 999);
        if (error) throw error;
        todas.push(...((data ?? []) as unknown as Fila[]));
        if (!data || data.length < 1000) break;
      }
      const p = await nombresPersonas(idsDePersonas(todas));
      const nombrePersona = persona ? (miembros as { id: string; nombre: string }[]).find((m) => m.id === persona)?.nombre ?? persona : 'Todas';
      const c = codigo.trim().toLocaleLowerCase('es');
      const filasX = todas.map((f) => vista(f, p)).filter((v) => !c || v.registro.toLocaleLowerCase('es').includes(c));
      const ws = XLSX.utils.aoa_to_sheet([
        ['Auditoría de Análisis de Tendencias'],
        [`Organización: ${org?.nombre ?? orgId}`],
        [`Filtros — Desde: ${desde || '—'}; Hasta: ${hasta || '—'}; Tabla: ${tabla ? TABLAS[tabla] ?? tabla : 'Todas'}; Acción: ${accion ? ACCIONES[accion] ?? accion : 'Todas'}; Persona: ${nombrePersona}; Código: ${codigo || '—'}`],
        [`Exportado: ${new Date().toLocaleString('es-MX')} por ${profile?.nombre ?? user?.email ?? ''} · Total: ${filasX.length}`],
        [],
        ['Fecha/hora', 'Usuario', 'Origen', 'Acción', 'Tabla', 'Registro', 'Antes → después', 'Motivo'],
        ...filasX.map((v) => [
          v.fecha.toLocaleString('es-MX'), v.sistema ? '' : v.persona, v.sistema ? v.persona : 'Usuario',
          v.accion, v.que, v.registro, v.cambios, v.motivo,
        ]),
      ]);
      ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 60 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
      const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Auditoria-Tendencias-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportando(false);
    }
  };

  const selectCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <Marco titulo="Auditoría de Tendencias" descripcion="Bitácora de solo lectura: catálogos, importaciones de Excel, correcciones de lecturas, retiros y emisiones o anulaciones de reportes AT.">
      {!permitido ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">La auditoría está disponible solo para administradores y el responsable sanitario.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <label className="space-y-1 text-xs">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
              <label className="space-y-1 text-xs">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
              <label className="flex flex-col space-y-1 text-xs">Tabla
                <select className={selectCls} value={tabla} onChange={(e) => setTabla(e.target.value)}>
                  <option value="">Todas</option>
                  {Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col space-y-1 text-xs">Acción
                <select className={selectCls} value={accion} onChange={(e) => setAccion(e.target.value)}>
                  <option value="">Todas</option>
                  {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col space-y-1 text-xs">Usuario
                <select className={selectCls} value={persona} onChange={(e) => setPersona(e.target.value)}>
                  <option value="">Todos</option>
                  {(miembros as { id: string; nombre: string }[]).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs">Código<Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej.: INS-PRO-31" /></label>
              <Button variant="outline" size="sm" onClick={exportarExcel} disabled={total === 0 || exportando}>
                <Download className="mr-1 h-4 w-4" /> {exportando ? 'Exportando…' : 'Exportar Excel'}
              </Button>
            </CardContent>
          </Card>

          {q.isLoading ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Cargando…</CardContent></Card>
          ) : filasVista.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No hay registros con estos filtros.</CardContent></Card>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Mostrando {filasVista.length.toLocaleString('es-MX')} de {total.toLocaleString('es-MX')} eventos</p>
              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        {['Fecha/hora', 'Usuario', 'Acción', 'Tabla', 'Registro', 'Antes → después', 'Motivo'].map((h) => (
                          <th key={h} className="p-2 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasVista.map((v) => (
                        <tr key={v.f.id} className="border-t align-top">
                          <td className="whitespace-nowrap p-2">{v.fecha.toLocaleString('es-MX')}</td>
                          <td className="p-2">{v.sistema ? (
                            <span className="inline-flex items-center gap-1"><Badge variant="secondary" className="gap-1 text-[10px]"><Bot className="h-3 w-3" />Sistema / migración</Badge>{v.f.solicitado_por || v.f.autorizado_por ? <span className="text-xs text-muted-foreground">{v.persona.replace('Sistema / migración, ', '')}</span> : null}</span>
                          ) : v.persona}</td>
                          <td className="p-2">{v.accion}</td>
                          <td className="p-2">{v.que}</td>
                          <td className="max-w-[220px] truncate p-2" title={v.registro}>{v.registro}</td>
                          <td className="max-w-[420px] break-words p-2 text-xs text-muted-foreground">{v.cambios}</td>
                          <td className="max-w-[220px] break-words p-2 text-xs text-muted-foreground">{v.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              {q.hasNextPage && (
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                    {q.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Marco>
  );
}
