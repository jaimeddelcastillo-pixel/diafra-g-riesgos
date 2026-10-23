import { AlignmentType, Document, Footer, Header, ImageRun, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, PageNumber } from 'docx';
export interface Firma { rol: 'Elaboró' | 'Revisó' | 'Autorizó'; nombre?: string; cargo: string; aplica?: boolean }
export interface Identidad { id?: string; version?: number; razon_social: string; domicilio: string; leyenda_confidencialidad: string; leyenda_copia: string; pie: string }
export interface Formato { id?: string; version?: number; tipo: string; codigo: string; version_formato: string; titulo: string; firmas: Firma[]; vigente_desde: string | null }
export interface Logo { dataUrl: string; format: 'PNG' | 'JPEG' }
export interface RegistroDocumento { folio: string; generado_en: string; formato: Formato | null; identidad: Identidad | null }

export interface ContextoDocumento {
  tipo: string; titulo: string; codigo: string; version: string; vigencia: string;
  razonSocial: string; domicilio: string; logo: Logo | null;
  leyendas: string[]; generadoPor: string; generadoEn: string; folio: string; firmas: Firma[];
}

export const fechaHoraMexico = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
const fechaMexico = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { dateStyle: 'medium' }) : '';

/** Pure: builds the context from the server registration. Logo only comes from the company itself. */
export function construirContexto(tipo: string, reg: RegistroDocumento, opts: { empresa: string; generadoPor: string; logo: Logo | null }): ContextoDocumento {
  const f = reg.formato; const i = reg.identidad;
  return {
    tipo,
    titulo: f?.titulo || 'Reporte periódico de indicadores' || tipo,
    codigo: f?.codigo || '', version: f?.version_formato || '', vigencia: fechaMexico(f?.vigente_desde ?? null),
    razonSocial: i?.razon_social || opts.empresa, domicilio: i?.domicilio || '',
    logo: opts.logo,
    leyendas: [i?.leyenda_copia, i?.leyenda_confidencialidad, i?.pie].filter((x): x is string => !!x && !!x.trim()),
    generadoPor: opts.generadoPor, generadoEn: reg.generado_en, folio: reg.folio,
    firmas: (f?.firmas ?? []).filter(x => x?.rol),
  };
}

export const lineaGenerado = (c: ContextoDocumento) => `Generado por ${c.generadoPor} el ${fechaHoraMexico(c.generadoEn)} · ${c.folio}`;
export const datosFormato = (c: ContextoDocumento) =>
  [c.codigo && `Código: ${c.codigo}`, c.version && `Versión: ${c.version}`, c.vigencia && `Vigente desde: ${c.vigencia}`].filter(Boolean) as string[];

export type TipoPeriodo = 'trimestre' | 'semestre' | 'año';
export interface Subperiodo { inicio: string; fin: string | null; numerador: number; denominador: number | null; valor: number | null; cumplimiento: number | null; semaforo: string; meta: number }
export interface KpiResumen {
  id: string; tabla: 'kpi_definiciones' | 'kpi_puesto'; tipo: 'SGC' | 'Puesto'; codigo: string; nombre: string; proceso: string | null; nivel: string | null; puesto_id: string | null;
  frecuencia: string; unidad: string; tendencia: string; peso: number; meta: number; meta_cambio: boolean; metas: number[]; subperiodos: Subperiodo[]; resultados: number;
  valor: number | null; cumplimiento: number | null; semaforo: string; valor_anterior: number | null; tendencia_periodo: 'sube' | 'baja' | 'igual' | null;
}
export interface PuestoResumen { puesto_id: string; codigo: string; nombre: string; calificacion: number | null; semaforo: string; con_dato: number; total: number; calificacion_anterior: number | null }
export interface IndiceSGC { indice: number | null; semaforo: string; indice_anterior: number | null; semaforo_anterior: string | null; con_dato: number; total: number; verde: number; amarillo: number; rojo: number; sin_base: number; sin_captura: number }
export interface ProcesoResumen { proceso: string; indice: number | null; semaforo: string; con_dato: number; total: number }
export interface Resumen { tipo: TipoPeriodo; inicio: string; fin: string; anterior: { inicio: string; fin: string }; kpis: KpiResumen[]; puestos: PuestoResumen[]; indice_sgc: IndiceSGC; procesos: ProcesoResumen[] }

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

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function etiquetaPeriodo(tipo: TipoPeriodo, inicio: string) {
  const [y, m] = inicio.split('-').map(Number);
  if (tipo === 'trimestre') return `T${Math.floor((m - 1) / 3) + 1} ${y}`;
  if (tipo === 'semestre') return `S${m <= 6 ? 1 : 2} ${y}`;
  return String(y);
}
export function etiquetaSub(frecuencia: string, inicio: string) {
  const [y, m] = inicio.split('-').map(Number);
  if (frecuencia === 'trimestral') return `T${Math.floor((m - 1) / 3) + 1}`;
  if (frecuencia === 'semestral') return `S${m <= 6 ? 1 : 2}`;
  if (frecuencia === 'anual') return String(y);
  return MESES[m - 1];
}
export const pct = (c: number | null | undefined) => c == null ? '—' : `${(c * 100).toFixed(1)} %`;
export const num = (v: number | null | undefined) => v == null ? '—' : Number(v.toFixed(2)).toString();
export const flecha = (t: KpiResumen['tendencia_periodo']) => t === 'sube' ? '↑' : t === 'baja' ? '↓' : t === 'igual' ? '→' : '—';
/** Out of target: yellow or red, SGC level first. */
export const fueraDeMeta = (r: Resumen) => r.kpis.filter(k => k.semaforo === 'amarillo' || k.semaforo === 'rojo')
  .sort((a, b) => Number(b.nivel === 'SGC') - Number(a.nivel === 'SGC') || Number(b.semaforo === 'rojo') - Number(a.semaforo === 'rojo') || a.codigo.localeCompare(b.codigo));

/** KPIs inside the report scope (empty scope = everything). */
export function kpisDelAlcance(r: Pick<Reporte, 'alcance_procesos' | 'alcance_puestos'>, res: Resumen): KpiResumen[] {
  return res.kpis.filter(k => k.tipo === 'SGC' ? (!r.alcance_procesos.length || r.alcance_procesos.includes(k.proceso ?? '')) : (!r.alcance_puestos.length || r.alcance_puestos.includes(k.puesto_id ?? '')));
}
/** Red SGC KPIs without analysis (block issuance). */
export const faltanAnalisis = (r: Reporte, res: Resumen) => kpisDelAlcance(r, res).filter(k => k.tipo === 'SGC' && k.nivel === 'SGC' && k.semaforo === 'rojo' && !r.analisis[k.id]?.causa?.trim());
export const quienTienePendiente = (r: Reporte) => r.estado !== 'borrador' ? '—' : r.etapa === 'edicion' ? 'Elaboró' : r.etapa === 'revision' ? 'Revisores' : 'Aseguramiento de Calidad';

const base64 = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1] ?? ''), ch => ch.charCodeAt(0));

/** Word header: logo (or company name), company + title, code/version/validity and page X of Y. */
export function encabezadoWord(c: ContextoDocumento): Header {
  return new Header({ children: encabezadoWordHijos(c) });
}

/** Header content (to add extra rows such as a draft watermark). */
export function encabezadoWordHijos(c: ContextoDocumento): Table[] {
  const logo = c.logo
    ? new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: c.logo.format === 'PNG' ? 'png' : 'jpg', data: base64(c.logo.dataUrl), transformation: { width: 110, height: 45 } })] })
    : new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.razonSocial, bold: true, size: 16 })] });
  const celda = (children: Paragraph[], pct: number) => new TableCell({ children, width: { size: pct, type: WidthType.PERCENTAGE } });
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [
    celda([logo], 25),
    celda([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.razonSocial.toUpperCase(), bold: true, size: 18 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.titulo, bold: true, size: 20 })] })], 50),
    celda([...datosFormato(c).map(t => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, size: 14 })] })), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], bold: true, size: 14 })] })], 25),
  ] })] })];
}

export function pieWord(c: ContextoDocumento): Footer {
  return new Footer({ children: [...c.leyendas, lineaGenerado(c)].map(t => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, size: 14, color: '555555' })] })) });
}

export function firmasWord(c: ContextoDocumento): Table | null {
  if (!c.firmas.length) return null;
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: c.firmas.map(f => new TableCell({ children: [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.rol.toUpperCase(), bold: true })] }),
    new Paragraph({ text: '' }), new Paragraph({ text: '' }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.nombre })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.cargo, size: 16 })] }),
  ] })) })] });
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

export interface EntradaWord { ctx: ContextoDocumento; reporte: Reporte; resumen: Resumen; firmantes: Firmantes; graficas: Record<string, Uint8Array>; borrador: boolean; graficasSvg?: boolean; nombresPuesto?: Record<string, string> }

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
    for (const k of ks.filter(k => k.nivel === 'SGC' && e.graficas[k.id])) {
      const transformation = { width: 605, height: 340 };
      const image = e.graficasSvg
        ? new ImageRun({ type: 'svg', data: e.graficas[k.id], fallback: { type: 'png', data: Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='), ch => ch.charCodeAt(0)) }, transformation })
        : new ImageRun({ type: 'png', data: e.graficas[k.id], transformation });
      cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [image] }));
    }
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
  const header = e.borrador ? new Header({ children: [...encabezadoWordHijos(ctx), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BORRADOR — NO VÁLIDO PARA EMISIÓN', bold: true, size: 40, color: 'C00000', font: 'Calibri' })] })] }) : encabezadoWord(ctx);
  return new Document({ creator: 'TRACEA', title: `${r.codigo} v${r.version}`, styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ headers: { default: header }, footers: { default: pieWord(ctx) }, children: cuerpo }] });
}

