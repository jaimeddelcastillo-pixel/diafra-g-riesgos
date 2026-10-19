import { describe,it,expect } from 'vitest';import { semanasSinCapturar,puedeCapturar,puedeConfigurar } from '../pendientes';import { semanaVacia,type Registro } from '../semanas';import { ISO_CLASES } from '../catalogos';
const registro=(activo=true):Registro=>({id:'qa',nombre:'QA',modulo:'presiones',activo,created_at:'2026-10-17',semanas:[]});
describe('Reglas T3a',()=>{
 it('admin captura y configura; operador solo captura',()=>{expect(puedeCapturar('admin',false,false)).toBe(true);expect(puedeConfigurar('admin',false,false)).toBe(true);expect(puedeCapturar('operador',false,false)).toBe(true);expect(puedeConfigurar('operador',false,false)).toBe(false);});
 it('responsable sanitario configura catálogos; comité y operador no',()=>{expect(puedeConfigurar('responsable_sanitario',false,false)).toBe(true);expect(puedeConfigurar('comite_tecnico',false,false)).toBe(false);expect(puedeConfigurar('responsable_sanitario',true,false)).toBe(false);});
 it('super-admin y soporte nunca escriben',()=>{expect(puedeCapturar('admin',true,true)).toBe(false);expect(puedeConfigurar('admin',true,true)).toBe(false);expect(puedeCapturar('admin',false,true)).toBe(false);});
 it('lectura no captura ni configura',()=>{expect(puedeCapturar('lectura',false,false)).toBe(false);expect(puedeConfigurar('lectura',false,false)).toBe(false);});
 it('cuenta semana actual ausente o incompleta, no inactivos ni semanas completas',()=>{const r=registro();const s=semanaVacia({semana_inicio:'2026-10-12',mes:'octubre',anio:'2026',unidad:'Pa'});const full={...s,lecturas:s.lecturas.map(p=>({...p,valor:p._na?null:15}))};expect(semanasSinCapturar([r,registro(false)],new Date('2026-10-17T12:00:00'))).toBe(1);expect(semanasSinCapturar([{...r,semanas:[s]}],new Date('2026-10-17T12:00:00'))).toBe(1);expect(semanasSinCapturar([{...r,semanas:[full]}],new Date('2026-10-17T12:00:00'))).toBe(0);});
 it('replica valor original No clasificada',()=>{expect(ISO_CLASES).toContain('No clasificada');});
});
