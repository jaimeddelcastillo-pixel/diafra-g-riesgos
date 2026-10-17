import { esSemanaCompleta, lunesDe, type Registro } from './semanas';
/** Same original completion rule; current scheduled week per active register. */
export function semanasSinCapturar(registros:Registro[],hoy=new Date()) {
  const lunes=lunesDe(hoy);
  return registros.filter(r=>r.activo).filter(r=>{const s=r.semanas.find(s=>s.semana_inicio===lunes);return !s || !esSemanaCompleta(s,r.modulo==='temphr');}).length;
}
export function puedeCapturar(rol:string|null,soporte:boolean,superAdmin:boolean) { return !soporte && !superAdmin && ['admin','responsable_sanitario','comite_tecnico','operador'].includes(rol ?? ''); }
export function puedeConfigurar(rol:string|null,soporte:boolean,superAdmin:boolean) { return !soporte && !superAdmin && rol==='admin'; }
