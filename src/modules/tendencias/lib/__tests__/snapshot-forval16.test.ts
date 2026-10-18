import {describe,it,expect} from 'vitest';
import {desdeSnapshot,type RegistroAT} from '../snapshot-forval16';
import {FORMATO_DEFAULT} from '../formato-forval16';
describe('Word histórico',()=>{
 it('usa formato y textos congelados, no los metadatos actuales',()=>{
 const emitido={codigo:'AT-2026-001',periodo_desde:'2026-01-01',periodo_hasta:'2026-03-31',seleccion:{modo:'instrumentos'},texto:{alcance:'Alcance congelado',s81:'',s9:'',s10:'',s11:''},justificaciones:{}};
 const row={...emitido,texto:{alcance:'No usar'},formato_snapshot:{...FORMATO_DEFAULT,identidad:{nombre:'Empresa al emitir',logoDescripcion:'Logo',confidencialidad:'Confidencial'}},datos_snapshot:{schema_version:2,fecha_calculo:'2026-04-01',registro_at:emitido,registros:[{id:'r',modulo:'presiones',nombre:'Registro',instrumento_id:'i',activo:true,semanas:[]}],instrumentos:[{id:'i',codigo:'I-1',parametro:'Presión',tipo:'otro'}],objetivos:[{id:'o',instrumento_id:'i',limite_normativo_pa:5}],areas:[],hvac:[],cambios:[],historial:[],sustituye:'N/A'}} as unknown as RegistroAT;
 const snapshot=desdeSnapshot(row);
 expect(snapshot.formato.identidad?.nombre).toBe('Empresa al emitir');
 expect(snapshot.texto.alcance).toBe('Alcance congelado');
 expect(snapshot.datos.objetivos[0].limite_normativo_pa).toBe(5);
 expect(snapshot.args.registros[0].id).toBe('r');
 expect(snapshot.args.fechaCalculo).toBe('2026-04-01');
 });
 it('rechaza históricos sin snapshot completo en vez de consultar datos vivos',()=>{expect(()=>desdeSnapshot({formato_snapshot:{},datos_snapshot:{schema_version:1}} as unknown as RegistroAT)).toThrow('Snapshot histórico incompleto');});
});