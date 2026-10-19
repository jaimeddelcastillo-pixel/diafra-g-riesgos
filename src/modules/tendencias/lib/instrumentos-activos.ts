export function codigoInstrumentoNormalizado(codigo: string) { return codigo.trim().toLowerCase(); }
export function instrumentoExistente<T extends { id: string; codigo: string; activo: boolean }>(instrumentos: T[], codigo: string, excluirId?: string) {
  return instrumentos.find(i => i.activo && i.id !== excluirId && codigoInstrumentoNormalizado(i.codigo) === codigoInstrumentoNormalizado(codigo));
}