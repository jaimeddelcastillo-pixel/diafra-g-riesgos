import { AlignmentType, Document, Header, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel } from 'docx';
import { supabase } from '@/integrations/supabase/client';
import { construirContexto, type ContextoDocumento, type Logo, type RegistroDocumento } from '@/lib/documentos';
import { encabezadoWord, pieWord } from '@/lib/documentos/word';
import { etiquetaPeriodo, etiquetaSub, flecha, fueraDeMeta, num, pct, type KpiResumen, type Resumen, type TipoPeriodo } from './tablero';

/** K3-b: periodic report. All writes go through server RPCs; snapshots are frozen by the server at issuance. */
export interface Analisis { causa: string; accion: string; capa: string }
export interface FirmanteSnap { user_id: string; nombre: string; cargo: string; fecha: string; leyenda?: string }
export interface Firmantes { elaboro: FirmanteSnap | null; revisaron: FirmanteSnap[]; autorizo: FirmanteSnap | null }
export interface Reporte {
  id: string; codigo: string; version: number; estado: 'borrador' | 'emitido' | 'anulado'; etapa: 'edicion' | 'revision' | 'autorizacion' | 'cerrado';
  tipo_periodo: TipoPeriodo; periodo_inicio: string; periodo_fin: string; alcance_procesos: string[]; alcance_puestos: string[];
  objetivo: string; alcance: string; metodologia: string; analisis: Record<string, Analisis>; conclusiones: string;
  elaboro_por: string | null; revisores: string[]; revisiones: { user_id: string; fecha: string; comentario: string }[];
  firmantes: Firmantes | null; formato_snapshot: (RegistroDocumento & { tipo: string }) | null; datos_snapshot: Resumen | null;
  emitido_en: string | null; anulado_en: string | null; motivo_anulacion: string | null; updated_at: string;
}
export interface ConfigReporte { version: number; objetivo: string; alcance: string; metodologia: string; autorizadores: string[] }

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as unknown;
};
export async function listarReportes(): Promise<Reporte[]> {
  const { data, error } = await supabase.from('kpi_reportes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Reporte[];
}
export async function configActual(): Promise<ConfigReporte | null> {
  const { data, error } = await supabase.from('kpi_reporte_config').select('version,objetivo,alcance,metodologia,autorizadores').order('version', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as ConfigReporte | null;
}
export const guardarConfig = (c: Omit<ConfigReporte, 'version'>, motivo: string) => rpc('guardar_kpi_reporte_config', { _objetivo: c.objetivo, _alcance: c.alcance, _metodologia: c.metodologia, _autorizadores: c.autorizadores, _motivo: motivo });
export const crearReporte = (tipo: TipoPeriodo, inicio: string) => rpc('crear_kpi_reporte', { _tipo: tipo, _inicio: inicio }) as Promise<string>;
export const guardarReporte = (id: string, datos: Partial<Pick<Reporte, 'objetivo' | 'alcance' | 'metodologia' | 'analisis' | 'conclusiones' | 'revisores'>>) => rpc('guardar_kpi_reporte', { _id: id, _datos: datos });
export const enviarReporte = (id: string) => rpc('enviar_kpi_reporte', { _id: id });
export const revisarReporte = (id: string, aprobar: boolean, comentario: string) => rpc('revisar_kpi_reporte', { _id: id, _aprobar: aprobar, _comentario: comentario });
export const emitirReporte = (id: string) => rpc('emitir_kpi_reporte', { _id: id });
export const nuevaVersion = (id: string, motivo: string) => rpc('nueva_version_kpi_reporte', { _id: id, _motivo: motivo });
export const anularReporte = (id: string, motivo: string) => rpc('anular_kpi_reporte', { _id: id, _motivo: motivo });
export const puedeAutorizar = async (orgId: string, userId: string) => (await rpc('kpi_reporte_autoriza', { _org: orgId, _u: userId })) as string | null;

/** KPIs inside the report scope (empty scope = everything). */
export function kpisDelAlcance(r: Pick<Reporte, 'alcance_procesos' | 'alcance_puestos'>, res: Resumen): KpiResumen[] {
  return res.kpis.filter(k => k.tipo === 'SGC' ? (!r.alcance_procesos.length || r.alcance_procesos.includes(k.proceso ?? '')) : (!r.alcance_puestos.length || r.alcance_puestos.includes(k.puesto_id ?? '')));
}
/** Red SGC KPIs without analysis (block issuance). */
export const faltanAnalisis = (r: Reporte, res: Resumen) => kpisDelAlcance(r, res).filter(k => k.tipo === 'SGC' && k.nivel === 'SGC' && k.semaforo === 'rojo' && !r.analisis[k.id]?.causa?.trim());
export const quienTienePendiente = (r: Reporte) => r.estado !== 'borrador' ? '—' : r.etapa === 'edicion' ? 'Elaboró' : r.etapa === 'revision' ? 'Revisores' : 'Aseguramiento de Calidad';

/** Identity of an issued report comes only from its frozen snapshot (same folio and date on every regeneration). */
export function contextoEmitido(r: Reporte, opts: { empresa: string; logo: Logo | null }): ContextoDocumento {
  if (!r.formato_snapshot || !r.firmantes) throw new Error('El reporte no tiene snapshot de emisión');
  return construirContexto('indicadores.reporte_word', r.formato_snapshot, { empresa: opts.empresa, generadoPor: r.firmantes.autorizo?.nombre ?? '', logo: opts.logo });
}

const fecha = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium' }) : '';
const p = (text: string, o: { b?: boolean; sz?: number; al?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) => new Paragraph({ alignment: o.al, spacing: { after: 80 }, children: [new TextRun({ text, bold: o.b, size: o.sz ?? 20, font: 'Calibri' })] });
const h = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri' })] });
const tabla = (enc: string[], filas: string[][]) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
  new TableRow({ tableHeader: true, children: enc.map(t => new TableCell({ shading: { fill: 'DCE6F1' }, children: [p(t, { b: true, sz: 16 })] })) }),
  ...filas.map(f => new TableRow({ children: f.map(t => new TableCell({ children: [p(t, { sz: 16 })] })) })),
] });
const filaKpi = (k: KpiResumen) => [k.codigo, k.nombre, `${k.meta} ${k.unidad}${k.meta_cambio ? ` (cambió: ${k.metas.join(' → ')})` : ''}`, k.subperiodos.map(s => `${etiquetaSub(k.frecuencia, s.inicio)}: ${num(s.valor)}`).join(' · ') || '—', num(k.valor), pct(k.cumplimiento), k.semaforo, `${flecha(k.tendencia_periodo)} ${num(k.valor_anterior)}`];
const ENC_KPI = ['Código', 'KPI', 'Meta', 'Subperiodos', 'Acumulado', 'Cumplimiento', 'Semáforo', 'Tendencia'];

/** Signature lines: «[Nombre] — [cargo]» plus the AC absence/substitution legend. */
export function lineaFirma(f: FirmanteSnap | null) {
  if (!f) return '';
  const ley = f.leyenda ?? '';
  return `${f.nombre} — ${f.cargo || 'Sin cargo en el perfil'}${ley.startsWith(',') ? ley : ley ? ` ${ley}` : ''}`;
}

export interface EntradaWord { ctx: ContextoDocumento; reporte: Reporte; resumen: Resumen; firmantes: Firmantes; graficas: Record<string, Uint8Array>; borrador: boolean; nombresPuesto?: Record<string, string> }

/** Pure Word builder: same input → same document.xml (issued reports pass only their snapshot). */
export function construirWordReporte(e: EntradaWord): Document {
  const { reporte: r, resumen: res, ctx } = e;
  const kpis = kpisDelAlcance(r, res); const i = res.indice_sgc;
  const sgc = kpis.filter(k => k.tipo === 'SGC'); const puesto = kpis.filter(k => k.tipo === 'Puesto');
  const procesos = [...new Set(sgc.map(k => k.proceso ?? 'Sin proceso'))];
  const fuera = fueraDeMeta({ ...res, kpis });
  const cuerpo: (Paragraph | Table)[] = [
    p(`${r.codigo} · Versión ${r.version} · Periodo ${etiquetaPeriodo(r.tipo_periodo, r.periodo_inicio)} (${r.periodo_inicio} a ${r.periodo_fin})`, { b: true }),
    h('1. Objetivo'), p(r.objetivo || '—'), h('2. Alcance'), p(r.alcance || '—'), h('3. Metodología'), p(r.metodologia || '—'),
    h('4. Resumen ejecutivo'),
    tabla(['Concepto', 'Valor'], [
      ['Índice SGC', `${pct(i.indice)} · ${i.semaforo}`],
      ['Periodo anterior', `${pct(i.indice_anterior)}${i.semaforo_anterior ? ` · ${i.semaforo_anterior}` : ''}`],
      ['KPI con dato', `${i.con_dato} de ${i.total}`],
      ['Semáforos', `Verde ${i.verde} · Amarillo ${i.amarillo} · Rojo ${i.rojo} · Sin base ${i.sin_base} · Sin captura ${i.sin_captura}`],
    ]),
    h('5. Resultados por proceso'),
  ];
  for (const pr of procesos) {
    const ks = sgc.filter(k => (k.proceso ?? 'Sin proceso') === pr); const ip = res.procesos.find(x => x.proceso === pr);
    cuerpo.push(p(`${pr}${ip ? ` — índice ${pct(ip.indice)} · ${ip.semaforo}` : ''}`, { b: true }), tabla(ENC_KPI, ks.map(filaKpi)));
    for (const k of ks.filter(k => k.nivel === 'SGC' && e.graficas[k.id])) cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: e.graficas[k.id], transformation: { width: 605, height: 340 } })] }));
  }
  cuerpo.push(h('6. KPI fuera de meta'), fuera.length ? tabla(['Código', 'KPI', 'Semáforo', 'Causa', 'Acción', 'CAPA'], fuera.map(k => { const a = r.analisis[k.id]; return [k.codigo, k.nombre, k.semaforo, a?.causa || '—', a?.accion || '—', a?.capa || '—']; })) : p('Sin KPI fuera de meta.'));
  cuerpo.push(h('7. Resultados por puesto'), tabla(['Puesto', 'Calificación', 'Semáforo', 'KPI con dato'], res.puestos.filter(x => !r.alcance_puestos.length || r.alcance_puestos.includes(x.puesto_id)).map(x => [`${x.codigo} · ${x.nombre}`, pct(x.calificacion), x.semaforo, `${x.con_dato} de ${x.total}`])));
  if (puesto.length) cuerpo.push(tabla(['Puesto', ...ENC_KPI], puesto.map(k => [e.nombresPuesto?.[k.puesto_id ?? ''] ?? res.puestos.find(x => x.puesto_id === k.puesto_id)?.codigo ?? '', ...filaKpi(k)])));
  cuerpo.push(h('8. Conclusiones'), p(r.conclusiones || '—'), h('9. Firmas'));
  const f = e.firmantes;
  const celdaFirma = (rol: string, x: FirmanteSnap | null) => new TableCell({ children: [p(rol.toUpperCase(), { b: true, al: AlignmentType.CENTER }), p(''), p(lineaFirma(x) || '—', { al: AlignmentType.CENTER, sz: 18 }), p(fecha(x?.fecha), { al: AlignmentType.CENTER, sz: 16 })] });
  cuerpo.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [
    celdaFirma('Elaboró', f.elaboro),
    new TableCell({ children: [p('REVISÓ', { b: true, al: AlignmentType.CENTER }), p(''), ...(f.revisaron.length ? f.revisaron.flatMap(x => [p(lineaFirma(x), { al: AlignmentType.CENTER, sz: 18 }), p(fecha(x.fecha), { al: AlignmentType.CENTER, sz: 16 })]) : [p('—', { al: AlignmentType.CENTER })])] }),
    celdaFirma('Autorizó', f.autorizo),
  ] })] }));
  const encabezado = encabezadoWord(ctx);
  const header = e.borrador ? new Header({ children: [...(encabezado.options.children as (Paragraph | Table)[]), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BORRADOR — NO VÁLIDO PARA EMISIÓN', bold: true, size: 40, color: 'C00000', font: 'Calibri' })] })] }) : encabezado;
  return new Document({ creator: 'TRACEA', title: `${r.codigo} v${r.version}`, styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ headers: { default: header }, footers: { default: pieWord(ctx) }, children: cuerpo }] });
}
export const wordABlob = (d: Document) => Packer.toBlob(d);
