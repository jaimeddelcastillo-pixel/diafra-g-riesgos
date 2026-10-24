/** Existing issuance always returns its original, even when a legacy client requests regeneration. */
export function conservarDiplomaOriginal(existente: unknown, _forceRegenerate?: boolean): boolean {
  return existente != null;
}