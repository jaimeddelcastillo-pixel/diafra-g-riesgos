const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const turnos = ['Mañana','Media tarde','Tarde'];
const clave = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export function normalizarLecturas<T extends {dia:string;turno:string}>(rows:T[]):T[] {
  return rows.map(p => ({...p,dia:dias.find(d=>clave(d)===clave(p.dia)) ?? p.dia,turno:turnos.find(t=>clave(t)===clave(p.turno)) ?? p.turno}));
}
export type Limites = { lie: number | null; lse: number | null; lieEstricto?: boolean; lseEstricto?: boolean };
/** Server post-processing (no AI): out-of-spec readings or readings >40 % away from the week median become doubtful (confianza 0) and must be reviewed. */
export function marcarAtipicas<T extends {valor:number|null;confianza:number|null}>(rows:T[], lim:Limites, tolerancia=0.4):(T & {atipica?:string})[] {
  const vals = rows.map(p => p.valor).filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  const m = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
  return rows.map(p => {
    const v = p.valor;
    if (v === null || !Number.isFinite(v)) return p;
    const fuera = (lim.lie != null && (lim.lieEstricto ? v <= lim.lie : v < lim.lie)) || (lim.lse != null && (lim.lseEstricto ? v >= lim.lse : v > lim.lse));
    const lejos = m !== null && m !== 0 && Math.abs(v - m) / Math.abs(m) > tolerancia;
    return fuera || lejos ? { ...p, confianza: 0, atipica: fuera ? 'Fuera de especificación' : 'Se aleja más de 40 % de la mediana de la semana' } : p;
  });
}
