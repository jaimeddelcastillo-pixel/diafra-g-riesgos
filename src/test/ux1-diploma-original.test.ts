import { describe, expect, it } from 'vitest';
import { conservarDiplomaOriginal } from '../../supabase/functions/emitir-diploma/original';

describe('UX-1 diplomas emitidos', () => {
  it('conserva el documento emitido incluso ante una petición antigua de regeneración', () => {
    expect(conservarDiplomaOriginal({ id: 'emitido', pdf_path: 'original.pdf' }, true)).toBe(true);
    expect(conservarDiplomaOriginal({ id: 'emitido' }, false)).toBe(true);
  });
  it('permite generar únicamente cuando no existe una emisión previa', () => {
    expect(conservarDiplomaOriginal(null, true)).toBe(false);
    expect(conservarDiplomaOriginal(undefined, false)).toBe(false);
  });
});