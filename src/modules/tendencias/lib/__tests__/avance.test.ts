import {describe,it,expect} from 'vitest';
import {consolidarPorInstrumento,estadoSemana,lunesDelPeriodo,resumenAvance} from '../avance';
import {semanaVacia,type Registro} from '../semanas';
const semana=()=>semanaVacia({semana_inicio:'2026-01-05',mes:'enero',anio:'2026',unidad:'Pa'});
const registro=(id='r'):Registro=>({id,modulo:'presiones',nombre:id,instrumento_id:'i',created_at:id,activo:true,lie:0,lse:10,semanas:[]});
describe('Consolidación exclusivamente en memoria',()=>{
 it('deduplica por fecha conservando saved_at reciente sin mutar originales',()=>{
 const a=registro('a'),b=registro('b');const vieja={...semana(),saved_at:'2026-01-06'},nueva={...semana(),saved_at:'2026-01-07'};
 a.semanas=[vieja];b.semanas=[nueva,{...semana(),semana_inicio:'2026-01-12'}];
 const [r]=consolidarPorInstrumento([b,a]);expect(r.id).toBe('a');expect(r.semanas).toHaveLength(2);expect(r.semanas[0]).toBe(nueva);expect(a.semanas).toEqual([vieja]);expect(b.semanas).toHaveLength(2);
 });
 it('mantiene instrumentos distintos',()=>{const b={...registro('b'),instrumento_id:'otro'};expect(consolidarPorInstrumento([registro(),b])).toHaveLength(2);});
});
describe('Matriz semanal',()=>{
 it('distingue vacía, parcial, completa y OOS excluyendo N/A',()=>{
 const r=registro();const s=semana();const f={registro:r,modulo:r.modulo,sinDatos:false,semanas:new Map([[s.semana_inicio,s]])};const m=new Map();const estado=()=>estadoSemana(f,s.semana_inicio,m);
 expect(estado().estado).toBe('vacia');s.lecturas[0].valor=5;expect(estado().estado).toBe('parcial');
 s.lecturas.forEach(p=>{if(!p._na)p.valor=5;});expect(estado()).toMatchObject({estado:'completa',cap:15,esp:15});
 expect(resumenAvance([f],[s.semana_inicio],m)).toEqual({alDia:1,pendientes:0,fuera:0});s.lecturas[0].valor=11;expect(estado().estado).toBe('fuera');expect(resumenAvance([f],[s.semana_inicio,'2026-01-12'],m)).toEqual({alDia:0,pendientes:1,fuera:1});
 });
 it('limita la matriz a 60 lunes y acepta periodos vacíos',()=>{expect(lunesDelPeriodo(new Date(2020,0,1),new Date(2026,0,1))).toHaveLength(60);expect(lunesDelPeriodo(new Date(2026,0,12),new Date(2026,0,1))).toEqual([]);});
});
