import { Fragment, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx-js-style';
import { Bot, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { nombresPersonas } from '@/lib/nombresPersonas';
import { MODULOS_AUDITADOS, TABLAS_AUDITADAS, type Referencias } from '@/config/auditoria';
import {
  COLUMNAS_AUDITORIA, FILTROS_VACIOS, accionLegible, aplicarFiltrosAuditoria, cambiosEvento, catalogoEvento,
  moduloEvento, registroEvento, titularesSuplencia, type EventoAuditoria, type FiltrosAuditoria,
} from '@/lib/auditoria';

/** Auditoría general de la plataforma (K1-a): solo lectura, paginación en servidor y exportación a Excel. */
const PAGINA = 50;
const MAX_EXPORT = 50000;

async function cargarReferencias(): Promise<Referencias> {
  const ref: Referencias = {};
  const consultas = await Promise.all([
    supabase.from('puestos').select('id, codigo').limit(5000),
    supabase.from('kpi_definiciones').select('id, codigo').limit(5000),
    supabase.from('kpi_puesto').select('id, codigo').limit(5000),
    supabase.from('folios').select('id, codigo').limit(5000),
  ]);
  for (const c of consultas) for (const r of (c.data ?? []) as { id: string; codigo: string | null }[]) if (r.codigo) ref[r.id] = r.codigo;
  return ref;
}

export function AuditoriaGeneral({ moduloInicial = '' }: { moduloInicial?: string }) {
  const { orgId, org, profile, user } = useAuth();
  const [f, setF] = useState<FiltrosAuditoria>({ ...FILTROS_VACIOS, modulo: moduloInicial });
  const [pagina, setPagina] = useState(0);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const cambiar = (p: Partial<FiltrosAuditoria>) => { setF((x) => ({ ...x, ...p })); setPagina(0); };

  const { data: ref = {} } = useQuery({ queryKey: ['auditoria-ref', orgId], enabled: !!orgId, queryFn: cargarReferencias, staleTime: 60_000 });
  const { data: miembrosActuales = [] } = useProfiles();
  const { data: personas = [] } = useQuery({
    queryKey: ['auditoria-personas', orgId, (miembrosActuales as unknown[]).length],
    enabled: !!orgId,
    queryFn: async () => {
      const m = miembrosActuales as { id: string; nombre: string }[];
      const nombres = await nombresPersonas(m.map((x) => x.id));
      return m.map((x) => ({ id: x.id, nombre: nombres[x.id] ?? x.nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
  });

  const q = useQuery({
    queryKey: ['auditoria-general', orgId, f, pagina, Object.keys(ref).length],
    enabled: !!orgId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, count } = await aplicarFiltrosAuditoria(
        supabase.from('audit_trail').select(COLUMNAS_AUDITORIA, { count: 'exact' }), orgId!, f, ref,
      ).range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
      if (error) throw error;
      return { filas: (data ?? []) as unknown as EventoAuditoria[], total: count ?? 0 };
    },
  });
  const filas = q.data?.filas ?? [];
  const total = q.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / PAGINA));

  const ids = useMemo(() => [...new Set(filas.flatMap((e) => [e.user_id, e.solicitado_por, e.autorizado_por]).filter((x): x is string => !!x))], [filas]);
  const { data: nombres = {} } = useQuery({ queryKey: ['auditoria-nombres', ids], enabled: ids.length > 0, queryFn: () => nombresPersonas(ids) });

  const persona = (e: EventoAuditoria, n: Record<string, string>) => {
    if (e.origen === 'sistema' || !e.user_id) {
      const s = e.solicitado_por ?? e.autorizado_por;
      return { texto: s ? `Sistema, a solicitud de ${n[s] ?? 'persona'}` : 'Sistema / migración', sistema: true };
    }
    return { texto: n[e.user_id] ?? 'Persona', sistema: false };
  };

  const exportar = async () => {
    if (!orgId) return;
    if (total > MAX_EXPORT) { toast.error(`El filtro devuelve ${total.toLocaleString('es-MX')} eventos; el máximo es ${MAX_EXPORT.toLocaleString('es-MX')}. Acota el filtro.`); return; }
    setExportando(true);
    try {
      const todas: EventoAuditoria[] = [];
      for (let desde = 0; desde < MAX_EXPORT; desde += 1000) {
        const { data, error } = await aplicarFiltrosAuditoria(supabase.from('audit_trail').select(COLUMNAS_AUDITORIA), orgId, f, ref).range(desde, desde + 999);
        if (error) throw error;
        todas.push(...((data ?? []) as unknown as EventoAuditoria[]));
        if (!data || data.length < 1000) break;
      }
      const n = await nombresPersonas([...new Set(todas.flatMap((e) => [e.user_id, e.solicitado_por, e.autorizado_por]).filter((x): x is string => !!x))]);
      const nombrePersona = f.persona ? personas.find((p) => p.id === f.persona)?.nombre ?? '—' : 'Todas';
      const ws = XLSX.utils.aoa_to_sheet([
        ['Auditoría general de la plataforma'],
        [`Organización: ${org?.nombre ?? ''}`],
        [`Filtros — Módulo: ${MODULOS_AUDITADOS[f.modulo] ?? 'Todos'}; Catálogo: ${f.catalogo ? catalogoEvento(f.catalogo) : 'Todos'}; Código: ${f.codigo || '—'}; Usuario: ${nombrePersona}; Desde: ${f.desde || '—'}; Hasta: ${f.hasta || '—'}`],
        [`Exportado: ${new Date().toLocaleString('es-MX')} por ${profile?.nombre ?? user?.email ?? ''} · Total: ${todas.length}`],
        [],
        ['Fecha/hora', 'Usuario', 'A nombre de (suplencia)', 'Módulo', 'Catálogo', 'Registro', 'Acción', 'Antes → después', 'Motivo'],
        ...todas.map((e) => [
          new Date(e.created_at).toLocaleString('es-MX'), persona(e, n).texto, titularesSuplencia(e).join(', '),
          moduloEvento(e.tabla), catalogoEvento(e.tabla), registroEvento(e, ref), accionLegible(e),
          cambiosEvento(e, ref).map((c) => `${c.campo}: ${c.antes} → ${c.despues}`).join('; '), e.motivo ?? '',
        ]),
      ]);
      ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 60 }, { wch: 34 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
      const url = URL.createObjectURL(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error((e as Error)?.message ?? 'No se pudo exportar');
    } finally {
      setExportando(false);
    }
  };

  const catalogos = Object.entries(TABLAS_AUDITADAS).filter(([, t]) => !f.modulo || t.modulo === f.modulo);
  const selectCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <label className="text-xs space-y-1 flex flex-col">Módulo
            <select aria-label="Módulo" className={selectCls} value={f.modulo} onChange={(e) => cambiar({ modulo: e.target.value, catalogo: '' })}>
              <option value="">Todos</option>
              {Object.entries(MODULOS_AUDITADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1 flex flex-col">Catálogo
            <select aria-label="Catálogo" className={selectCls} value={f.catalogo} onChange={(e) => cambiar({ catalogo: e.target.value })}>
              <option value="">Todos</option>
              {catalogos.map(([k, t]) => <option key={k} value={k}>{t.catalogo}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1">Código<Input aria-label="Código" placeholder="Ej. F1" value={f.codigo} onChange={(e) => cambiar({ codigo: e.target.value })} className="w-36" /></label>
          <label className="text-xs space-y-1 flex flex-col">Usuario
            <select aria-label="Usuario" className={selectCls} value={f.persona} onChange={(e) => cambiar({ persona: e.target.value })}>
              <option value="">Todos</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1">Desde<Input type="date" value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} /></label>
          <label className="text-xs space-y-1">Hasta<Input type="date" value={f.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} /></label>
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportar} disabled={total === 0 || exportando}>
            <Download className="h-4 w-4 mr-1" /> {exportando ? 'Exportando…' : 'Exportar Excel'}
          </Button>
        </CardContent>
      </Card>

      {q.error && <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.isLoading ? <p className="text-sm text-muted-foreground p-4">Cargando…</p> : filas.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">No hay eventos con estos filtros.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total.toLocaleString('es-MX')} eventos · página {pagina + 1} de {paginas}</p>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>{['', 'Fecha/hora', 'Usuario', 'Módulo', 'Catálogo', 'Registro', 'Acción'].map((h, i) => <th key={i} className="text-left p-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filas.map((e) => {
                    const p = persona(e, nombres as Record<string, string>);
                    const titulares = titularesSuplencia(e);
                    const cambios = cambiosEvento(e, ref);
                    const ver = abierto === e.id;
                    return (
                      <Fragment key={e.id}>
                        <tr className="border-t align-top">
                          <td className="p-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={ver ? 'Ocultar detalle' : 'Ver detalle'} aria-expanded={ver} onClick={() => setAbierto(ver ? null : e.id)}>
                              {ver ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </td>
                          <td className="p-2 whitespace-nowrap">{new Date(e.created_at).toLocaleString('es-MX')}</td>
                          <td className="p-2">
                            {p.sistema ? <span className="inline-flex items-center gap-1"><Badge variant="secondary" className="gap-1 text-[10px]"><Bot className="h-3 w-3" />Sistema</Badge><span className="text-xs text-muted-foreground">{p.texto}</span></span> : p.texto}
                            {titulares.map((t) => <div key={t} className="text-xs text-muted-foreground">a nombre de {t} (suplencia)</div>)}
                          </td>
                          <td className="p-2">{moduloEvento(e.tabla)}</td>
                          <td className="p-2">{catalogoEvento(e.tabla)}</td>
                          <td className="p-2 max-w-[240px] truncate" title={registroEvento(e, ref)}>{registroEvento(e, ref)}</td>
                          <td className="p-2"><Badge variant="outline">{accionLegible(e)}</Badge></td>
                        </tr>
                        {ver && (
                          <tr className="bg-muted/30">
                            <td />
                            <td colSpan={6} className="p-3 space-y-2 text-xs">
                              {cambios.length ? (
                                <ul className="space-y-0.5">{cambios.map((c) => <li key={c.campo} className="break-words"><span className="font-medium">{c.campo}:</span> {c.antes} → {c.despues}</li>)}</ul>
                              ) : <p className="text-muted-foreground">{e.accion === 'INSERT' ? 'Alta del registro (sin valores anteriores).' : 'Sin campos modificados.'}</p>}
                              <p><span className="font-medium">Motivo:</span> {e.motivo || '—'}</p>
                              {titulares.length > 0 && <p><span className="font-medium">Actuó como suplente a nombre de:</span> {titulares.join(', ')}</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={pagina === 0 || q.isFetching} onClick={() => setPagina((x) => x - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">{pagina + 1} / {paginas}</span>
            <Button variant="outline" size="sm" disabled={pagina + 1 >= paginas || q.isFetching} onClick={() => setPagina((x) => x + 1)}>Siguiente</Button>
          </div>
        </>
      )}
    </div>
  );
}
