import {describe,it,expect,vi,beforeEach} from 'vitest';
import {analizarRegistro} from '../normativo';
import type {Registro} from '../semanas';
const state=vi.hoisted(()=>({images:[] as unknown[][]}));
vi.mock('jspdf',()=>({default:class {
 internal={pageSize:{getWidth:()=>842,getHeight:()=>595}};
 lastAutoTable={finalY:110};
 setFontSize(){return this;} setFont(){return this;} setTextColor(){return this;}
 setDrawColor(){return this;} setLineWidth(){return this;} setFillColor(){return this;}
 text(){} rect(){} line(){} addPage(){} setPage(){} save(){}
 getNumberOfPages(){return 1;} getTextWidth(s:string){return s.length*4;}
 addImage(...args:unknown[]){state.images.push(args);}
}}));
vi.mock('jspdf-autotable',()=>({default:vi.fn()}));
vi.mock('../chart-renderer',()=>({generarBloqueEstadisticoRegistro:()=>[{serie:'Presión',chartSpecUrl:'spec-png',chartAlertUrl:'alert-png',decimales:2,estadistica:null}]}));
import {exportarNormativoPDF} from '../export-normativo';
const r={id:'qa',nombre:'QA',modulo:'presiones',lie:5,lse:20,semanas:[{semana_inicio:'2026-01-05',lecturas:[{dia:'Lunes',turno:'Mañana',valor:10}]}]} as Registro;
describe('gráficas del PDF consolidado',()=>{
 beforeEach(()=>{state.images=[];});
 it('incluye especificación y alerta/acción por defecto',()=>{
  exportarNormativoPDF([analizarRegistro(r,{tipo:'anual',anio:2026})],'registro',{areas:new Map(),hvac:new Map(),empresa:'QA'});
  expect(state.images.map(x=>x[0])).toEqual(['spec-png','alert-png']);
 });
 it('la exportación tabular explícita no incorpora gráficas',()=>{
  exportarNormativoPDF([analizarRegistro(r,{tipo:'anual',anio:2026})],'registro',{areas:new Map(),hvac:new Map()},{incluirGraficas:false});
  expect(state.images).toHaveLength(0);
 });
});