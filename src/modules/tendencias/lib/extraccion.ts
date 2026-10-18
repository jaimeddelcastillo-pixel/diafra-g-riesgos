import { DIAS, TURNOS, semanaVacia, type Semana, type Registro, type PuntoLectura } from './semanas';

export function propuestaSemana(propuesta: Record<string, unknown>, registro: Registro, inicio: string): Semana {
  const base = semanaVacia({semana_inicio:inicio,mes:'',anio:inicio.slice(0,4),unidad:registro.modulo==='temphr'?'°C':String(propuesta.unidad ?? ''),esTHR:registro.modulo==='temphr'});
  const convertir = (campo: string): PuntoLectura[] => {
    const rows = propuesta[campo];
    if (!Array.isArray(rows) || rows.length !== 21) throw new Error('La propuesta debe tener 21 lecturas por variable');
    const keys = new Set<string>();
    for (const p of rows) {
      if (!p || !DIAS.includes(p.dia) || !TURNOS.includes(p.turno)) throw new Error('Día o turno inválido en propuesta');
      const key = `${p.dia}/${p.turno}`;
      if (keys.has(key)) throw new Error('Lecturas duplicadas en propuesta');
      keys.add(key);
    }
    return base.lecturas.map(cell => {
      const p = rows.find(p => p.dia===cell.dia && p.turno===cell.turno);
      return {...cell,valor:typeof p.valor==='number' && Number.isFinite(p.valor)?p.valor:null,hora:p.hora ?? null,quien:p.quien ?? null,_na:false,_dudoso:p.valor==null || (typeof p.confianza==='number' && p.confianza<0.7)};
    });
  };
  return {...base,lecturas:convertir(registro.modulo==='temphr'?'lecturas_t':'lecturas'),lecturas_hr:registro.modulo==='temphr'?convertir('lecturas_hr'):undefined,observaciones:String(propuesta.observaciones ?? ''),source:'ia'};
}

export function revisionPendiente(s: Semana) {
  return [...s.lecturas,...s.lecturas_hr ?? []].some(p=>p._dudoso && !p._edited && !p._na);
}