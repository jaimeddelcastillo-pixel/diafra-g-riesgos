// Guarda la foto de la bitácora (ya comprimida) para poder consultarla después junto a su semana.
import { lunesDe, type Registro } from "./semanas";

export type RangoFoto = { desde?: string; hasta?: string };
export function rangoRegistro(registro: Registro): RangoFoto {
  const fechas = registro.semanas.filter(s => s.activo !== false).map(s => s.semana_inicio).sort();
  const ultima = fechas.at(-1);
  if (!fechas[0] || !ultima) return {};
  const fin = new Date(ultima + 'T12:00:00'); fin.setDate(fin.getDate() + 6);
  return {desde: fechas[0], hasta: `${fin.getFullYear()}-${String(fin.getMonth()+1).padStart(2,'0')}-${String(fin.getDate()).padStart(2,'0')}`};
}
function limitesAnio(rango: RangoFoto): [number, number] {
  const now = Number(new Intl.DateTimeFormat('en', {timeZone:'America/Mexico_City',year:'numeric'}).format(new Date()));
  const desde = Number(rango.desde?.slice(0,4)), hasta = Number(rango.hasta?.slice(0,4));
  return desde && hasta && desde <= hasta ? [desde,hasta] : [now-1,now+1];
}

/** Corrige años mal leídos por la IA (escritura a mano: 2016→2026, 2075→2025). Devuelve "" si no hay año plausible. */
function corregirAnio(fecha: string, rango: RangoFoto): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const [MIN, MAX] = limitesAnio(rango);
  if (y >= MIN && y <= MAX) return fecha;
  // Intenta corregir un solo dígito del año (errores típicos de lectura manuscrita)
  for (const delta of [10, -10, 50, -50, 100, -100, 2, 1, -1]) {
    const cand = y + delta;
    if (cand >= MIN && cand <= MAX) {
      const test = new Date(cand, m - 1, d);
      if (test.getMonth() === m - 1) return `${cand}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return "";
}

const IDX_DIA: Record<string, number> = {
  lunes: 0, martes: 1, miercoles: 2, "miércoles": 2, jueves: 3, viernes: 4,
  sabado: 5, "sábado": 5, domingo: 6,
};
const idxDia = (s?: string) => (s ? IDX_DIA[s.toLowerCase().trim()] : undefined);
/** 0=Lunes … 6=Domingo */
const idxSemana = (d: Date) => (d.getDay() + 6) % 7;

/** Años plausibles del recuadro "Año" (2026, "26", o ambos si la hoja cruza de año: "2025/2026"). */
function aniosEncabezado(a: string | number | null | undefined, rango: RangoFoto): number[] {
  const [min,max] = limitesAnio(rango);
  const out: number[] = [];
  for (const m of String(a ?? "").match(/\d{2,4}/g) ?? []) {
    let y = Number(m);
    if (y < 100) y += 2000;
    if (y >= min && y <= max && !out.includes(y)) out.push(y);
  }
  return out.sort((x, y) => x - y);
}

/** Si el año leído no cuadra con el día de la columna, busca el año plausible MÁS CERCANO al de referencia. */
function anioQueCuadra(fecha: string, dia: number, ref: number, rango: RangoFoto): string | null {
  const [, m, d] = fecha.split("-").map(Number);
  const [min,max] = limitesAnio(rango);
  const cands: number[] = [];
  for (let y = min; y <= max; y++) cands.push(y);
  cands.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref) || b - a);
  for (const y of cands) {
    const t = new Date(y, m - 1, d);
    if (t.getMonth() === m - 1 && idxSemana(t) === dia) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5,
  jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9,
  oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

/** Meses del recuadro "Mes" ("Mayo", "05", o ambos si la semana cruza de mes: "Abril/Mayo"). */
export function mesesEncabezado(m?: string | number | null): number[] {
  const s = String(m ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out: number[] = [];
  for (const t of s.match(/[a-z]+|\d{1,2}/g) ?? []) {
    const v = /^\d+$/.test(t) ? Number(t) : (MESES[t] ?? MESES[t.slice(0, 3)]);
    if (v && v >= 1 && v <= 12 && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Lunes de la semana según las fechas escritas en el encabezado de la bitácora ("" si no se leyó).
 * El año del recuadro "Año" y el mes del recuadro "Mes" mandan: un día mal escrito nunca cambia
 * el año ni el mes (se tolera el mes adyacente cuando la semana cruza de un mes a otro).
 */
export function detectarLunesFoto(
  p: { anio?: string | number | null; mes?: string | number | null; fechas_columnas?: { dia?: string; fecha?: string }[] } | null | undefined,
  rango: RangoFoto = {},
): string {
  const aHoja = aniosEncabezado(p?.anio,rango);
  const mHoja = mesesEncabezado(p?.mes);
  const votos = new Map<string, number>();
  for (const f0 of p?.fechas_columnas ?? []) {
    let f = f0;
    if (!f.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) continue;
    // Resolve the sheet year first, before checking month/day validity.
    if (aHoja.length) {
      const [y,m,d] = f.fecha.split('-').map(Number);
      const yHoja = aHoja.length > 1 ? (m >= 7 ? aHoja[0] : aHoja[aHoja.length-1]) : aHoja[0];
      const yy = aHoja.length === 1 && Math.abs(y-yHoja)===1 && (m===12 || m===1) ? y : yHoja;
      f = {...f,fecha:`${yy}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`};
    } else {
      const corregida = corregirAnio(f.fecha,rango);
      if (!corregida) continue;
      f = {...f,fecha:corregida};
    }
    if (mHoja.length) {
      // Fuerza el mes de la hoja; con un solo mes se tolera el contiguo (semana que cruza de mes)
      const [y, m, d] = f.fecha.split("-").map(Number);
      const contiguo = mHoja.length === 1 && (
        (((m - mHoja[0] + 12) % 12) === 1 && d <= 7) || (((m - mHoja[0] + 12) % 12) === 11 && d >= 22));
      if (!mHoja.includes(m) && !contiguo) {
        // Con dos meses: días altos van al primero, días bajos al segundo
        const mm = mHoja.length > 1 ? (d >= 15 ? mHoja[0] : mHoja[mHoja.length - 1]) : mHoja[0];
        if (d <= new Date(y, mm, 0).getDate()) f = { ...f, fecha: `${y}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
      }
    }
    const di = idxDia(f.dia);
    let fecha: string;
    fecha = f.fecha ?? '';
    if (!aHoja.length) {
      if (di !== undefined) {
        const ok = fecha && idxSemana(new Date(fecha + "T00:00:00")) === di;
        const ref = fecha ? Number(fecha.slice(0, 4)) : new Date().getFullYear();
        if (!ok) fecha = anioQueCuadra(fecha || (f.fecha ?? ""), di, ref,rango) ?? fecha;
      }
    }
    if (!fecha) continue;
    const d = new Date(fecha + "T00:00:00");
    if (isNaN(d.getTime()) || d.getDate() !== Number(fecha.slice(8,10)) || d.getMonth()+1 !== Number(fecha.slice(5,7))) continue;
    const lunes = lunesDe(d);
    const peso = di !== undefined && idxSemana(d) === di ? 2 : 1;
    votos.set(lunes, (votos.get(lunes) ?? 0) + peso);
  }
  if (!votos.size) return "";
  return [...votos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

