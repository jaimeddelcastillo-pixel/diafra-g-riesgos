import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { fechaRealISO } from './fechas-lectura';
import type { Semana, Registro } from './semanas';
type EstadoSemana = Pick<Semana,'semana_inicio'|'lecturas'|'lecturas_hr'|'source'>;
type Correccion = {semana_id:string;fecha:string;accion:string;motivo:string|null;anterior:EstadoSemana;nuevo:EstadoSemana};
type Datos = {semanas:(EstadoSemana & {id:string;activo:boolean})[];correcciones:Correccion[]};
function filas(s:EstadoSemana,registro:Registro,desde:string,hasta:string) {
  return (['lecturas','lecturas_hr'] as const).flatMap(campo=>(s[campo] ?? []).flatMap(p=>{
    const fecha=fechaRealISO(s.semana_inicio,p.dia);
    if(fecha<desde || fecha>hasta)return [];
    return [{Registro:registro.nombre,Fecha:fecha,Día:p.dia,Turno:p.turno,Variable:campo==='lecturas_hr'?'HR':registro.modulo==='temphr'?'Temperatura':registro.modulo,Valor:p.valor,Hora:p.hora ?? '',Antefirma:p.quien ?? '',Origen:s.source==='ia'?'IA':s.source==='manual'?'manual':s.source,'N/A':p._na?'Sí':'No','Motivo de celda':p._motivo ?? ''}];
  }));
}
export async function exportarCrudo(registro:Registro,desde:string,hasta:string) {
  const {data,error}=await supabase.rpc('tend_exportar_crudo',{_registro:registro.id,_desde:desde,_hasta:hasta});
  if(error)throw error;
  const datos=data as unknown as Datos;
  const lecturas=datos.semanas.flatMap(s=>filas(s,registro,desde,hasta).map(p=>({...p,Estado:s.activo?'Activo':'Retirado'})));
  const correcciones=datos.correcciones.flatMap(c=>(['anterior','nuevo'] as const).flatMap(estado=>{
    const s=c[estado];if(!s?.semana_inicio || !Array.isArray(s.lecturas))return [];
    return filas(s,registro,desde,hasta).map(p=>({...p,'Semana ID':c.semana_id,'Fecha de cambio':c.fecha,Acción:c.accion,Motivo:c.motivo ?? '',Versión:estado}));
  }));
  const libro=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro,XLSX.utils.json_to_sheet(lecturas.length?lecturas:[{Registro:registro.nombre,Desde:desde,Hasta:hasta}]),'Datos crudos');
  XLSX.utils.book_append_sheet(libro,XLSX.utils.json_to_sheet(correcciones.length?correcciones:[{Registro:registro.nombre,Motivo:'Sin correcciones en el periodo'}]),'Correcciones');
  XLSX.writeFile(libro,`Bitacora_${registro.nombre.replace(/[^\p{L}\p{N}_-]/gu,'_')}_${desde}_${hasta}.xlsx`);
}