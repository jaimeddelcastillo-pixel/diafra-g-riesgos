import { AlignmentType, Document, Header, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel } from 'docx';
import { supabase } from '@/integrations/supabase/client';
import { construirContexto, type ContextoDocumento, type Logo, type RegistroDocumento } from '@/lib/documentos';
import { encabezadoWord, encabezadoWordHijos, pieWord } from '@/lib/documentos/word';
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

export { construirWordReporte, lineaFirma } from '../../../../supabase/functions/emitir-kpi-word/word';
export type { EntradaWord } from '../../../../supabase/functions/emitir-kpi-word/word';
export const wordABlob = (d: Document) => Packer.toBlob(d);
