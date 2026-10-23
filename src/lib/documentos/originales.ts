import { supabase } from '@/integrations/supabase/client';
import type { ContextoDocumento } from './index';

export interface DocumentoOriginal { folio: string; tipo: string; nombre_archivo: string; generado_en: string; usuario: string; archivo_path: string | null; archivo_sha256: string | null }
export const hashArchivo = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('');

/** Upload only complete bytes, without upsert; publish the insert-only registration afterwards. */
export async function conservarOriginal(ctx: ContextoDocumento, blob: Blob) {
  if (!ctx.archivoPath) throw new Error('No hay reserva para este documento');
  const sha = await hashArchivo(blob);
  const bucket = supabase.storage.from('documentos-generados');
  const { error } = await bucket.upload(ctx.archivoPath, blob, { upsert: false, contentType: blob.type || 'application/octet-stream' });
  if (error) {
    // A completed upload whose confirmation failed can be retried, never overwritten.
    const { data, error: lectura } = await bucket.download(ctx.archivoPath);
    if (lectura || !data || await hashArchivo(data) !== sha) throw error;
  }
  const { error: confirmacion } = await supabase.rpc('confirmar_documento_archivo', { _folio: ctx.folio, _sha256: sha });
  if (confirmacion) throw confirmacion;
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function conservarYDescargar(ctx: ContextoDocumento, blob: Blob, nombre: string) {
  await conservarOriginal(ctx, blob); descargarBlob(blob, nombre);
}
export async function descargarPorFolio(folio: string): Promise<Blob> {
  const { data: d, error } = await supabase.from('documentos_generados').select('archivo_path,archivo_sha256').eq('folio', folio).single();
  if (error) throw error;
  if (!d?.archivo_path) throw new Error('Este registro histórico no conserva archivo original');
  const { data, error: lectura } = await supabase.storage.from('documentos-generados').download(d.archivo_path);
  if (lectura || !data) throw lectura ?? new Error('Original no disponible');
  if (d.archivo_sha256 && await hashArchivo(data) !== d.archivo_sha256) throw new Error('El archivo no coincide con su huella registrada');
  return data;
}