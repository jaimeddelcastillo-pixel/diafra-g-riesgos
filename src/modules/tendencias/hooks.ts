import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { listarRegistros,listarCatalogo } from './lib/persistencia';
import { puedeCapturar,puedeConfigurar } from './lib/pendientes';
import type { AreaClasificada,Instrumento,SistemaHVAC,CambioFiltro } from './lib/catalogos';
import type { ObjetivoPresion } from './lib/objetivos-presion';
export function useTendencias(cargar=true){
 const auth=useAuth();const qc=useQueryClient();
 const query=useQuery({queryKey:['tendencias',auth.orgId,auth.user?.id],enabled:!!auth.orgId && cargar,queryFn:async()=>{
  const [registros,hvac,areas,instrumentos,objetivos,cambios]=await Promise.all([listarRegistros(),listarCatalogo('tend_sistemas_hvac'),listarCatalogo('tend_areas'),listarCatalogo('tend_instrumentos'),listarCatalogo('tend_objetivos_presion'),listarCatalogo('tend_cambios_filtro')]);
  return {registros,hvac:hvac as unknown as SistemaHVAC[],areas:areas as unknown as AreaClasificada[],instrumentos:instrumentos as unknown as Instrumento[],objetivos:objetivos as unknown as ObjetivoPresion[],cambios:cambios as unknown as CambioFiltro[]};
 }});
 return {...query,auth,captura:puedeCapturar(auth.orgRole,auth.isImpersonating,auth.isSuperAdmin()),admin:puedeConfigurar(auth.orgRole,auth.isImpersonating,auth.isSuperAdmin()),refresh:()=>{qc.invalidateQueries({queryKey:['tendencias']});qc.invalidateQueries({queryKey:['pendientes-modulo','tendencias']});}};
}
