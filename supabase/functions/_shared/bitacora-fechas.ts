// Calendar proposals shared by the server and human-review screen, never confirmation.
export type FechaColumna = { dia?: string; fecha?: string };
export type PropuestaFechas = { anio?: string | number | null; anio_dudoso?: boolean | null; fechas_columnas?: FechaColumna[] };
const dias: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };
const diaColumna = (dia?: string) => dias[(dia ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()];
export function resolverFechasBitacora(p: PropuestaFechas, primeraFecha?: string, anioActual = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Mexico_City', year: 'numeric' }).format(new Date()))) {
  const min = primeraFecha ? Number(primeraFecha.slice(0, 4)) : anioActual - 1;
  const max = anioActual + 1;
  const originales = p.fechas_columnas ?? [];
  const escritos = (String(p.anio ?? '').match(/\d{2,4}/g) ?? []).map(y => Number(y) < 100 ? 2000 + Number(y) : Number(y));
  const conocidos = escritos.length ? escritos : [...new Set(originales.map(f => Number(f.fecha?.slice(0, 4))).filter(Number.isFinite))];
  const validos = conocidos.length > 0 && conocidos.every(y => y >= min && y <= max);
  const fechasPara = (anios: number[], conservarCruce: boolean) => originales.map(f => {
    if (!f.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return { ...f };
    const [y, m] = f.fecha.split('-').map(Number);
    let elegido = anios.length > 1 ? (m >= 7 ? Math.min(...anios) : Math.max(...anios)) : anios[0];
    if (conservarCruce && anios.length === 1 && (m === 1 || m === 12) && Math.abs(y - elegido) === 1 && y >= min && y <= max) elegido = y;
    // Candidate December weeks may cross into January of the following year.
    if (!conservarCruce && originales.some(c => c.fecha?.slice(5, 7) === '12') && m === 1) elegido += 1;
    return { ...f, fecha: `${elegido}-${f.fecha.slice(5)}` };
  });
  const cuadra = (fechas: FechaColumna[]) => {
    if (!fechas.length) return false;
    const lunes = new Set<string>();
    for (const f of fechas) {
      if (!f.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) return false;
      const d = new Date(f.fecha + 'T12:00:00Z');
      const dia = diaColumna(f.dia);
      const y = Number(f.fecha.slice(0, 4));
      if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== f.fecha || y < min || y > max || dia === undefined || d.getUTCDay() !== dia) return false;
      d.setUTCDate(d.getUTCDate() - (dia + 6) % 7);
      lunes.add(d.toISOString().slice(0, 10));
    }
    return lunes.size === 1;
  };
  if (validos && !p.anio_dudoso) {
    const fechas = fechasPara(conocidos, true);
    return { fechas_columnas: fechas, requiere_revision: !cuadra(fechas) };
  }
  const referencia = conocidos[0] ?? anioActual;
  const candidatos: number[] = [];
  for (let y = min; y <= max; y++) candidatos.push(y);
  candidatos.sort((a, b) => Math.abs(a - referencia) - Math.abs(b - referencia) || b - a);
  for (const y of candidatos) {
    const fechas = fechasPara([y], false);
    if (cuadra(fechas)) return { fechas_columnas: fechas, requiere_revision: false };
  }
  return { fechas_columnas: originales, requiere_revision: true };
}