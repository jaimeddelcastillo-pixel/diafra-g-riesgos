import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { celdasAnio, etiquetaPeriodo, periodoCerrado, type Resultado } from './resultados';

export interface KpiExcel { tabla: 'kpi_definiciones' | 'kpi_puesto'; id: string; codigo: string; nombre: string; grupo: string; nivel: string; frecuencia: string; meta: number; unidad: string; fuente: string; estado: string }
export interface CeldaExcel { tipo: string; codigo: string; inicio: string; numerador: string | number; denominador: string | number; referencia: string; hoja: string; posicion: string }
export interface VistaExcel { celda: CeldaExcel; estado: 'nuevo' | 'cambia' | 'sin cambio' | 'error'; error: string; antes: { numerador: number; denominador: number | null; referencia: string } | null; despues: { numerador: number; denominador: number | null; referencia: string }; valor: number | null; semaforo: string }
export const referenciaPeriodo = (k: KpiExcel, inicio: string) => [k.fuente, etiquetaPeriodo(k.frecuencia, inicio)].filter(Boolean).join(' · ');
const clave = (k: KpiExcel, inicio: string) => `${k.tabla}|${k.id}|${inicio}`;
export function hojasAnio(kpis: KpiExcel[], resultados: Resultado[], anio: number, hoy: string) {
  const grupos = new Map<string, KpiExcel[]>();
  const capturados = new Map(resultados.map(r => [`${r.kpi_definicion_id ? 'kpi_definiciones' : 'kpi_puesto'}|${r.kpi_definicion_id ?? r.kpi_puesto_id}|${r.periodo_inicio}`, r]));
  for (const k of kpis.filter(k => k.estado === 'validado' && celdasAnio(k.frecuencia, anio).length)) {
    const nombre = k.tabla === 'kpi_definiciones' ? 'SGC' : k.grupo;
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), k]);
  }
  const usadas = new Set<string>();
  return [...grupos].map(([grupo, ks]) => {
    const base = (grupo || 'Puesto').replace(/[\\/?*\[\]:]/g, '_').slice(0, 25); let nombre = base; let i = 1;
    while (usadas.has(nombre.toLowerCase())) nombre = `${base}_${i++}`;
    usadas.add(nombre.toLowerCase());
    // Each frequency has its own labeled columns within the same sheet; unrelated periods stay locked.
    const columnas = [...new Map(ks.flatMap(k => celdasAnio(k.frecuencia, anio).map(p => [`${k.frecuencia}|${p.inicio}`, { ...p, frecuencia: k.frecuencia }] as const))).values()];
    const cabecera = ['tipo', 'código', 'nombre', 'frecuencia', 'meta', 'unidad'];
    for (const p of columnas) { const e = etiquetaPeriodo(p.frecuencia, p.inicio); cabecera.push(`${e} | numerador`, `${e} | denominador`); if (ks.some(k => k.nivel === 'SGC')) cabecera.push(`${e} | referencia de la fuente`); }
    const desbloqueadas: string[] = [];
    const filas: (string | number)[][] = [cabecera];
    ks.forEach((k, idx) => {
      const fila: (string | number)[] = [k.tabla === 'kpi_definiciones' ? 'SGC' : 'puesto', k.codigo, k.nombre, k.frecuencia, k.meta, k.unidad];
      for (const p of columnas) {
        const aplica = p.frecuencia === k.frecuencia; const r = aplica ? capturados.get(clave(k, p.inicio)) : undefined;
        const editable = aplica && periodoCerrado(p.fin, hoy); const col = fila.length;
        fila.push(r?.numerador ?? '', r?.denominador ?? '');
        if (editable) { desbloqueadas.push(XLSX.utils.encode_cell({ r: idx + 1, c: col })); if (k.unidad !== 'número') desbloqueadas.push(XLSX.utils.encode_cell({ r: idx + 1, c: col + 1 })); }
        if (ks.some(x => x.nivel === 'SGC')) { fila.push(aplica && k.nivel === 'SGC' ? r?.referencia_fuente || referenciaPeriodo(k, p.inicio) : ''); if (editable && k.nivel === 'SGC') desbloqueadas.push(XLSX.utils.encode_cell({ r: idx + 1, c: col + 2 })); }
      }
      filas.push(fila);
    });
    return { nombre, filas, desbloqueadas };
  });
}

export async function plantillaAnio(kpis: KpiExcel[], resultados: Resultado[], anio: number, hoy: string): Promise<Uint8Array> {
  const hojas = hojasAnio(kpis, resultados, anio, hoy); if (!hojas.length) throw new Error('Sin KPI validados con estos filtros');
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(h.filas); ws['!cols'] = h.filas[0].map((_, i) => ({ wch: i === 2 ? 45 : i >= 6 ? 28 : 18 }));
    ws['!protect'] = { selectLockedCells: true, selectUnlockedCells: false }; XLSX.utils.book_append_sheet(wb, ws, h.nombre);
  }
  // SheetJS CE writes sheet protection but not unlocked cell styles. Add the standard OOXML style using the existing ZIP library.
  const zip = await JSZip.loadAsync(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const stylesFile = zip.file('xl/styles.xml'); if (!stylesFile) throw new Error('No se pudo proteger la plantilla');
  let styles = await stylesFile.async('string'); const match = styles.match(/<cellXfs count="(\d+)"/); if (!match) throw new Error('Estilos de plantilla inválidos');
  const estilo = Number(match[1]); styles = styles.replace(/<cellXfs count="\d+"/, `<cellXfs count="${estilo + 1}"`).replace('</cellXfs>', '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="0"/></xf></cellXfs>'); zip.file('xl/styles.xml', styles);
  for (let i = 0; i < hojas.length; i++) {
    const path = `xl/worksheets/sheet${i + 1}.xml`; const file = zip.file(path); if (!file) throw new Error('Hoja de plantilla inválida');
    const abiertas = new Set(hojas[i].desbloqueadas);
    const xml = (await file.async('string')).replace(/<c\b([^>]*\br="([A-Z]+\d+)"[^>]*)>/g, (original, attrs: string, direccion: string) => abiertas.has(direccion) ? `<c${attrs.replace(/\s+s="\d+"/, '')} s="${estilo}">` : original);
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

export function leerResultadosExcel(bytes: ArrayBuffer): CeldaExcel[] {
  const wb = XLSX.read(bytes, { type: 'array', sheetRows: 5003 }); const celdas: CeldaExcel[] = [];
  for (const nombre of wb.SheetNames) {
    const ws = wb.Sheets[nombre]; const filas = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', raw: true });
    const headers = filas[0]?.map(String) ?? [];
    if (!['tipo', 'código', 'nombre', 'frecuencia', 'meta', 'unidad'].every((x, i) => headers[i] === x)) throw new Error(`Formato de plantilla inválido: ${nombre}`);
    filas.slice(1).forEach((fila, idx) => {
      if (fila.every(x => String(x).trim() === '')) return;
      for (let col = 6; col < headers.length; col++) {
        if (!headers[col].endsWith(' | numerador')) continue;
        const etiqueta = headers[col].split(' | ')[0]; const numerador = fila[col] ?? ''; const denominador = fila[col + 1] ?? '';
        // Pre-filled references without measurements are context, not captures.
        if (String(numerador).trim() === '' && String(denominador).trim() === '') continue;
        const inicio = inicioEtiqueta(etiqueta);
        celdas.push({ tipo: String(fila[0]), codigo: String(fila[1]), inicio, numerador, denominador, referencia: headers[col + 2] === `${etiqueta} | referencia de la fuente` ? String(fila[col + 2] ?? '') : '', hoja: nombre, posicion: XLSX.utils.encode_cell({ r: idx + 1, c: col }) });
        if (celdas.length > 5000) throw new Error('Límite de 5 000 celdas');
      }
    });
  }
  return celdas;
}
function inicioEtiqueta(e: string) {
  const [periodo, y] = e.split(' '); const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  if (/^\d{4}$/.test(e)) return `${e}-01-01`;
  const m = /^T[1-4]$/.test(periodo) ? (Number(periodo[1]) - 1) * 3 + 1 : /^S[12]$/.test(periodo) ? (Number(periodo[1]) - 1) * 6 + 1 : meses.indexOf(periodo) + 1;
  return m && /^\d{4}$/.test(y ?? '') ? `${y}-${String(m).padStart(2, '0')}-01` : '';
}
export async function previewExcel(celdas: CeldaExcel[]): Promise<VistaExcel[]> {
  const { data, error } = await supabase.rpc('previsualizar_resultados_excel', { _celdas: celdas as never }); if (error) throw error; return data as unknown as VistaExcel[];
}
export async function aplicarResultadosExcel(celdas: CeldaExcel[], motivo: string) {
  const { data, error } = await supabase.rpc('aplicar_resultados_excel', { _celdas: celdas as never, _motivo: motivo }); if (error) throw error; return data;
}