import * as XLSX from 'xlsx';
import type { ContextoDocumento } from '@/lib/documentos';
import { XLSX as XLSXS, escribirLibro, hojaConIdentidad } from '@/lib/documentos/excel';

export const HOJAS = ['Puestos', 'KPI_SGC', 'KPI_Puesto'] as const;
export type Hoja = typeof HOJAS[number];
export type Fila = Record<string, string | number | boolean>;
export type Catalogo = Record<Hoja, Fila[]>;
export const vacio = (): Catalogo => ({ Puestos: [], KPI_SGC: [], KPI_Puesto: [] });
export const OPCIONES: Record<string, string[]> = {
  nivel: ['SGC', 'Operativo', 'Gestión'], frecuencia: ['mensual', 'trimestral', 'semestral', 'anual', 'por evento'],
  tendencia: ['positiva', 'negativa'], unidad: ['%', 'días', 'horas', 'número'], activo: ['Sí', 'No'],
};
export const COLUMNAS: Record<Hoja, string[]> = {
  Puestos: ['codigo', 'nombre', 'area', 'activo'],
  KPI_SGC: ['codigo', 'nombre', 'proceso', 'nivel', 'definicion', 'formula', 'fuente', 'puesto', 'frecuencia', 'tendencia', 'meta', 'unidad', 'peso', 'regla_actuacion', 'activo'],
  KPI_Puesto: ['codigo', 'puesto', 'objetivo', 'nombre', 'formula', 'fuente', 'tendencia', 'meta', 'unidad', 'frecuencia', 'peso', 'aporta_a', 'activo'],
};
export const LABELS: Record<string, string> = {
  codigo: 'Código', nombre: 'Nombre', area: 'Área', proceso: 'Proceso', nivel: 'Nivel', definicion: 'Definición', formula: 'Fórmula', fuente: 'Fuente de datos', puesto: 'Puesto responsable', frecuencia: 'Frecuencia', tendencia: 'Tendencia', meta: 'Meta', unidad: 'Unidad', peso: 'Peso (%)', regla_actuacion: 'Regla de actuación', objetivo: 'Objetivo', aporta_a: 'Aporta a (códigos SGC)', activo: 'Activo',
};
export const AYUDA: Record<string, string> = {
  codigo: 'Identificador de texto único; se conserva al editar. Ejemplos: 1, F1, S1.', nombre: 'Nombre del puesto o indicador.', area: 'Área a la que pertenece el puesto.', proceso: 'Proceso del SGC relacionado.', nivel: 'Clasificación SGC, Operativo o Gestión.', definicion: 'Qué mide el indicador y cuál es su alcance.', formula: 'Expresión que se emplea para calcular el resultado.', fuente: 'Registro o documento que proporciona los datos.', puesto: 'Código del puesto responsable en este catálogo.', frecuencia: 'Periodicidad de medición.', tendencia: 'Positiva: aumentar es favorable. Negativa: disminuir es favorable.', meta: 'Valor numérico esperado.', unidad: 'Unidad del resultado y de la meta.', peso: 'Participación porcentual; el total del SGC o del puesto debe ser 100%.', regla_actuacion: 'Acción requerida cuando no se cumple la meta.', objetivo: 'Objetivo del puesto que mide este indicador.', aporta_a: 'Códigos del Diccionario SGC separados por coma.', activo: 'No retira el registro sin borrarlo.',
};
export function normalizar(f: Fila): Fila {
  const r: Fila = { ...f };
  for (const k of Object.keys(r)) if (typeof r[k] === 'string') r[k] = String(r[k]).trim();
  r.activo = ![false, 'No', 'no', 'false', '0', 0].includes(r.activo);
  for (const k of ['meta', 'peso']) if (k in r && String(r[k]).trim() !== '') r[k] = Number(r[k]);
  if ('aporta_a' in r) r.aporta_a = codigos(r.aporta_a).sort().join(', ');
  return r;
}
/** K1-a: el peso solo aplica a KPI del Diccionario con nivel SGC. */
export const pesoAplica = (h: Hoja, f: Fila) => h !== 'KPI_SGC' || f.nivel === 'SGC';
export const MENSAJE_PESO = 'El peso solo aplica a KPI de nivel SGC; en Operativo y Gestión debe ser 0.';
export const codigos = (s: unknown): string[] => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);
export function avisosPesos(c: Catalogo): string[] {
  const avisos: string[] = [];
  const sgc = c.KPI_SGC.filter(f => f.activo !== false && f.nivel === 'SGC');
  const total = sgc.reduce((s, f) => s + Number(f.peso || 0), 0);
  if (sgc.length && Math.abs(total - 100) > 0.00001) avisos.push(`Pesos SGC: ${total}% (esperado 100%).`);
  for (const p of new Set(c.KPI_Puesto.filter(f => f.activo !== false).map(f => String(f.puesto)))) {
    const suma = c.KPI_Puesto.filter(f => f.activo !== false && f.puesto === p).reduce((s, f) => s + Number(f.peso || 0), 0);
    if (Math.abs(suma - 100) > 0.00001) avisos.push(`Puesto ${p}: ${suma}% (esperado 100%).`);
  }
  return avisos;
}
export interface PreviewFila { hoja: Hoja; renglon: number; codigo: string; estado: 'nuevo' | 'cambia' | 'sin cambio' | 'error'; cambios: { campo: string; antes: unknown; despues: unknown }[]; errores: string[] }
export interface Preview { paquete: Catalogo; filas: PreviewFila[]; errores: string[]; avisos: string[] }
export function previsualizar(entrada: Catalogo, actual: Catalogo): Preview {
  const paquete = vacio();
  for (const h of HOJAS) paquete[h] = entrada[h].map(normalizar);
  const combinado = vacio();
  for (const h of HOJAS) combinado[h] = [...actual[h].filter(a => !paquete[h].some(f => f.codigo === a.codigo)), ...paquete[h]];
  const puestos = new Set(combinado.Puestos.map(f => String(f.codigo)));
  const sgc = new Set(combinado.KPI_SGC.map(f => String(f.codigo)));
  const filas: PreviewFila[] = [];
  for (const h of HOJAS) {
    const cuenta = new Map<string, number>();
    paquete[h].forEach(f => cuenta.set(String(f.codigo), (cuenta.get(String(f.codigo)) ?? 0) + 1));
    paquete[h].forEach((f, i) => {
      const errores: string[] = [];
      if (!f.codigo || !f.nombre) errores.push('Código y nombre obligatorios');
      if ((cuenta.get(String(f.codigo)) ?? 0) > 1) errores.push('Código duplicado');
      if (h !== 'Puestos') {
        if (!puestos.has(String(f.puesto))) errores.push('Puesto inexistente');
        for (const k of ['tendencia', 'unidad', 'frecuencia', ...(h === 'KPI_SGC' ? ['nivel'] : [])]) if (!OPCIONES[k]?.includes(String(f[k]))) errores.push(`${LABELS[k]} inválida`);
        if (String(f.meta ?? '').trim() === '' || !Number.isFinite(Number(f.meta))) errores.push('Meta no numérica');
        if (!Number.isFinite(Number(f.peso ?? 0)) || Number(f.peso ?? 0) < 0) errores.push('Peso inválido');
        else if (!pesoAplica(h, f) && Number(f.peso || 0) !== 0) errores.push(MENSAJE_PESO);
        if (h === 'KPI_Puesto') {
          const aporta = codigos(f.aporta_a);
          if (new Set(aporta).size !== aporta.length) errores.push('Código aporta_a duplicado');
          for (const c of aporta) if (!sgc.has(c)) errores.push(`Código aporta_a inexistente: ${c}`);
        }
      }
      const a = actual[h].find(x => x.codigo === f.codigo);
      const cambios = a ? COLUMNAS[h].filter(k => String(normalizar(a)[k] ?? '') !== String(f[k] ?? '')).map(campo => ({ campo, antes: a[campo], despues: f[campo] })) : [];
      filas.push({ hoja: h, renglon: i + 2, codigo: String(f.codigo ?? ''), estado: errores.length ? 'error' : !a ? 'nuevo' : cambios.length ? 'cambia' : 'sin cambio', cambios, errores });
    });
  }
  return { paquete, filas, errores: filas.flatMap(f => f.errores.map(e => `${f.hoja} · ${f.renglon}: ${e}`)), avisos: avisosPesos(combinado) };
}
/** With a document context, a leading «Documento» sheet carries the identity; data sheets keep row 1 headers so the file re-imports. */
export function escribirExcel(c = vacio(), ctx?: ContextoDocumento): Uint8Array {
  const wb = XLSXS.utils.book_new();
  if (ctx) {
    const resumen = HOJAS.map(h => [h, c[h].length]);
    const ws = hojaConIdentidad(ctx, ['Hoja', 'Registros'], resumen, 1, HOJAS.length + 1); ws['!cols'] = [{ wch: 50 }, { wch: 14 }];
    XLSXS.utils.book_append_sheet(wb, ws, 'Documento');
  }
  for (const h of HOJAS) {
    const rows = c[h].map(f => Object.fromEntries(COLUMNAS[h].map(k => [k, k === 'activo' ? f[k] === false ? 'No' : 'Sí' : f[k] ?? ''])));
    const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNAS[h] });
    ws['!cols'] = COLUMNAS[h].map(k => ({ wch: ['definicion', 'formula', 'fuente', 'regla_actuacion', 'nombre'].includes(k) ? 35 : 20 }));
    XLSXS.utils.book_append_sheet(wb, ws, h);
  }
  return escribirLibro(wb);
}
export function leerExcel(bytes: ArrayBuffer): Catalogo {
  const wb = XLSX.read(bytes, { type: 'array' }); const c = vacio();
  for (const h of HOJAS) {
    const ws = wb.Sheets[h]; if (!ws) throw new Error(`Falta la hoja ${h}`);
    const headers = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] ?? [];
    if (COLUMNAS[h].some(k => !headers.includes(k))) throw new Error(`Columnas incompletas en ${h}`);
    c[h] = XLSX.utils.sheet_to_json<Fila>(ws, { defval: '' }).filter(f => Object.values(f).some(v => String(v).trim()) && String(f.codigo).trim().toUpperCase() !== 'EJEMPLO');
  }
  return c;
}