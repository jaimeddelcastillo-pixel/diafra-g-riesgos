const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const turnos = ['Mañana','Media tarde','Tarde'];
const clave = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export function normalizarLecturas<T extends {dia:string;turno:string}>(rows:T[]):T[] {
  return rows.map(p => ({...p,dia:dias.find(d=>clave(d)===clave(p.dia)) ?? p.dia,turno:turnos.find(t=>clave(t)===clave(p.turno)) ?? p.turno}));
}