import {describe,it,expect} from 'vitest';
import {instrumentoExistente} from '../instrumentos-activos';
describe('Instrumentos activos por empresa',()=>{
  const activos=[{id:'1',codigo:'INS-01',activo:true},{id:'2',codigo:'INS-02',activo:false}];
  it('ofrece el activo existente al repetir el código incluso con espacios o minúsculas',()=>{expect(instrumentoExistente(activos,' ins-01 ')?.id).toBe('1');});
  it('no considera duplicado un instrumento inactivo',()=>{expect(instrumentoExistente(activos,'INS-02')).toBeUndefined();});
  it('permite conservar el código del propio instrumento al editar',()=>{expect(instrumentoExistente(activos,'INS-01','1')).toBeUndefined();});
  it('no mezcla catálogos de otras empresas',()=>{expect(instrumentoExistente([{id:'3',codigo:'INS-03',activo:true}],'INS-01')).toBeUndefined();});
});