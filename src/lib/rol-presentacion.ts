/** Compatibility for existing exact-role screens; never an authorization source. */
export function rolPresentacion<T extends string>(rol: T | null, ruta: string): T | 'comite_tecnico' | null {
  return rol === 'aseguramiento_calidad' && !/^\/indicadores(?:\/|$)/.test(ruta) && !/^\/configuracion\/suplencias(?:\/|$)/.test(ruta) ? 'comite_tecnico' : rol;
}