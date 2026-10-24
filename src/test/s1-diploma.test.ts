import { describe, expect, it, vi } from 'vitest';
import { estamparFirmaDiploma } from '../../supabase/functions/emitir-diploma/signature';
import { FIRMA_JDC_PNG_BASE64 } from '../../supabase/functions/emitir-diploma/firma';
describe('S-1 firma del diploma', () => {
  it('el generador imprime la imagen autorizada configurada del instructor', () => {
    const doc = { addImage: vi.fn() };
    estamparFirmaDiploma(doc, { firma_png: FIRMA_JDC_PNG_BASE64, instructor_nombre: 'QA instructor', instructor_cargo: 'QA cargo' }, 72.5, 176);
    expect(doc.addImage).toHaveBeenCalledWith(FIRMA_JDC_PNG_BASE64, 'PNG', 46.5, 151.99, 52, 26.01);
  });
  it('una firma que no es PNG impide emitir en vez de producir un diploma sin firma', () => {
    const doc = { addImage: vi.fn() };
    expect(() => estamparFirmaDiploma(doc, { firma_png: 'invalid', instructor_nombre: 'QA', instructor_cargo: 'QA' }, 72.5, 176)).toThrow();
    expect(doc.addImage).not.toHaveBeenCalled();
  });
});