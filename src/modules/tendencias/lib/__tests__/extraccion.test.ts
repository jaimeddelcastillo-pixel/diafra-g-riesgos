import { describe,it,expect } from 'vitest';
import { propuestaSemana,revisionPendiente } from '../extraccion';
import { DIAS,TURNOS,type Registro } from '../semanas';
const r:Registro={id:'qa',nombre:'QA',modulo:'temphr',activo:true,semanas:[],created_at:''};
const rows=()=>DIAS.flatMap(dia=>TURNOS.map(turno=>({dia,turno,valor:22,hora:null,quien:null,confianza:1})));
describe('extracción propuesta humana',()=>{
 it('temperatura y HR exigen 21 combinaciones por variable',()=>{expect(()=>propuestaSemana({lecturas_t:rows(),lecturas_hr:rows().slice(1)},r,'2026-10-19')).toThrow();});
 it('marca confianza menor a 0.7 para revisión sin validar por IA',()=>{const t=rows();t[0].confianza=0.6;const s=propuestaSemana({lecturas_t:t,lecturas_hr:rows()},r,'2026-10-19');expect(s.lecturas[0]._dudoso).toBe(true);expect(revisionPendiente(s)).toBe(true);s.lecturas[0]._edited=true;expect(revisionPendiente(s)).toBe(false);});
 it('no desplaza columnas vacías ni descarta sábado trabajado',()=>{const t=rows();t[0].valor=null as unknown as number;t[15].valor=24;const s=propuestaSemana({lecturas_t:t,lecturas_hr:rows()},r,'2026-10-19');expect(s.lecturas[0].valor).toBeNull();expect(s.lecturas[15].dia).toBe('Sábado');expect(s.lecturas[15].valor).toBe(24);expect(s.lecturas[15]._na).toBe(false);});
 it('rechaza combinaciones duplicadas',()=>{const t=rows();t[1]=t[0];expect(()=>propuestaSemana({lecturas_t:t,lecturas_hr:rows()},r,'2026-10-19')).toThrow('duplicadas');});
});