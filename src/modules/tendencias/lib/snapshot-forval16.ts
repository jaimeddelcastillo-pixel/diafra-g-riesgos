import type { Tables } from '@/integrations/supabase/types';
import { FORMATO_DEFAULT, type FormatoForVal16 } from './formato-forval16';
import type { Instrumento,AreaClasificada,SistemaHVAC,CambioFiltro } from './catalogos';
import type { Registro } from './semanas';
import type { ObjetivoPresion } from './objetivos-presion';
import type { TextoForVal16 } from './texto-forval16';
import { construirBloques } from './export-forval16';
import { unirPorInstrumento } from './seleccion-forval16';
export type RegistroAT=Tables<'tend_registros_at'>;
export interface DatosSnapshot {schema_version:number;fecha_calculo:string;registro_at:RegistroAT;registros:Registro[];instrumentos:Instrumento[];objetivos:ObjetivoPresion[];areas:AreaClasificada[];hvac:SistemaHVAC[];cambios:CambioFiltro[];historial:Tables<'tend_registros_at_historial'>[];sustituye:string}
export function desdeSnapshot(row:RegistroAT){
 if(!row.formato_snapshot || !row.datos_snapshot)throw new Error('Registro sin snapshot de emisión; no se consultarán catálogos actuales');
 const datos=row.datos_snapshot as unknown as DatosSnapshot;
 if(datos.schema_version!==2 || !datos.registro_at || !datos.registros.length || !datos.instrumentos.length)throw new Error('Snapshot histórico incompleto');
 const raw=row.formato_snapshot as unknown as FormatoForVal16 & {tabla_iso?:string[][]};
 const formato:FormatoForVal16={...FORMATO_DEFAULT,...raw,textos:{...FORMATO_DEFAULT.textos,...raw.textos}};
 if(raw.tabla_iso?.length)formato.textos.tablaClases=raw.tabla_iso.map(r=>r.join(' | ')).join('\n');
 const at=datos.registro_at;
 const seleccion=at.seleccion as {modo?:string;hvacId?:string}|null;
 const hvac=datos.hvac.find(h=>h.id===seleccion?.hvacId);
 const args={empresa:formato.identidad?.nombre,registros:unirPorInstrumento(datos.registros),instrMap:new Map(datos.instrumentos.map(i=>[i.id,i])),areasMap:new Map(datos.areas.map(a=>[a.id,a])),desde:at.periodo_desde,hasta:at.periodo_hasta,hvac,cambiosFiltro:datos.cambios};
 return {datos,at,formato,args,...construirBloques(args),texto:at.texto as unknown as TextoForVal16,justificaciones:at.justificaciones as Record<string,string>};
}