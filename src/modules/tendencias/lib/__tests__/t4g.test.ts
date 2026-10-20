import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { crearPlantilla, insertarValidaciones } from '../catalogo-excel';
import { ISO_CLASES, etiquetaIso, isoDesdeEtiqueta } from '../catalogos';

const ORDEN = ['sheetPr','dimension','sheetViews','sheetFormatPr','cols','sheetData','sheetProtection','autoFilter','mergeCells','conditionalFormatting','dataValidations','hyperlinks','printOptions','pageMargins','pageSetup','headerFooter','ignoredErrors','drawing','tableParts','extLst'];
const hijos = (xml: string) => [...xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData/>').matchAll(/<([A-Za-z]+)[\s>/]/g)].map(m => m[1]).filter(t => ORDEN.includes(t));

describe('T4g OOXML', () => {
  it('dataValidations queda antes de ignoredErrors', () => {
    const xml = insertarValidaciones('<worksheet><sheetData/><pageMargins/><ignoredErrors/></worksheet>', '<dataValidations count="0"></dataValidations>');
    expect(xml.indexOf('<dataValidations')).toBeLessThan(xml.indexOf('<pageMargins'));
  });
  it('cada hoja de la plantilla respeta el orden del esquema', async () => {
    const zip = await JSZip.loadAsync(await crearPlantilla());
    for (const n of [2, 3, 4, 5]) {
      const f = zip.file(`xl/worksheets/sheet${n}.xml`); if (!f) continue;
      const t = hijos(await f.async('string')).map(x => ORDEN.indexOf(x));
      expect(t).toEqual([...t].sort((a, b) => a - b));
    }
  });
});
describe('T4g clases', () => {
  it('lista sin duplicados y en orden', () => {
    expect(ISO_CLASES.map(etiquetaIso)).toEqual(['Clase A (ISO-5)','Clase B','Clase C (ISO-7)','Clase D (ISO-8)','ISO-9','Área limpia','Área gris','No clasificada']);
  });
  it('etiqueta vuelve al valor guardado', () => expect(isoDesdeEtiqueta('Clase A (ISO-5)')).toBe('ISO-5'));
});
