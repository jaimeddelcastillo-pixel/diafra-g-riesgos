import { describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { conservarOriginal, descargarPorFolio } from './originales';
import { construirContexto } from './index';
const mocks = vi.hoisted(() => ({ upload: vi.fn(), download: vi.fn(), rpc: vi.fn(), single: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => mocks }, rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) } }));
describe('D1-a original por folio', () => {
  it('conserva bytes completos y descarga el mismo original por folio', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const blob = new NodeBlob(['Original QA íntegro'], { type: 'application/pdf' }) as unknown as Blob;
    const ctx = construirContexto('auditoria.bitacora_pdf', { folio: 'DOC-2026-000042', generado_en: '2026-10-23T18:00:00Z', formato: null, identidad: null, archivo_path: 'qa/2026/DOC-2026-000042.pdf' }, { empresa: 'QA', generadoPor: 'QA', logo: null });
    mocks.upload.mockResolvedValue({ error: null }); mocks.rpc.mockResolvedValue({ error: null }); mocks.download.mockResolvedValue({ data: blob, error: null });
    try {
      await conservarOriginal(ctx, blob);
      const sha = mocks.rpc.mock.calls[0][1]._sha256;
      mocks.single.mockResolvedValue({ data: { archivo_path: ctx.archivoPath, archivo_sha256: sha }, error: null });
      const read = await descargarPorFolio(ctx.folio);
      expect(await read.arrayBuffer()).toEqual(await blob.arrayBuffer());
      expect(mocks.upload).toHaveBeenCalledWith(ctx.archivoPath, blob, { upsert: false, contentType: 'application/pdf' });
      expect(mocks.rpc).toHaveBeenCalledWith('confirmar_documento_archivo', { _folio: 'DOC-2026-000042', _sha256: sha });
    } finally { vi.unstubAllGlobals(); }
  });
});
