import {describe,it,expect} from 'vitest';
import {FORMATO_DEFAULT} from '../formato-forval16';
import {identificadoresReporte,nombreArchivoReporte,siguienteCodigoAT} from '../configuracion-reporte';
describe('Configuración empresarial de reportes',()=>{
  it('resuelve códigos y versión desde la configuración de la empresa',()=>{
    const f={...FORMATO_DEFAULT,textos:{...FORMATO_DEFAULT.textos,codigoFormato:'FOR-VAL-16-02',codigoRegistro:'FOR-VAL-16-01',versionRegistro:'03',prefijoArchivos:'Reporte QA'}};
    expect(identificadoresReporte(f)).toEqual({codigoFormato:'FOR-VAL-16-02',codigoRegistro:'FOR-VAL-16-01',versionRegistro:'03',prefijoArchivos:'Reporte QA'});
  });
  it('usa el prefijo empresarial y la versión en el archivo',()=>{expect(nombreArchivoReporte('Reporte QA',['AT-2026-004','v2'],'docx')).toBe('Reporte_QA_AT-2026-004_v2.docx');});
  it('sugiere el consecutivo anual sin reservarlo',()=>{expect(siguienteCodigoAT(['AT-2025-999','AT-2026-003'],2026)).toBe('AT-2026-004');});
});