import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { ISO_CLASES, etiquetaIso, isoDesdeEtiqueta, type Instrumento } from './catalogos';
import { CLASES_INSTRUMENTO, VARIABLES_INSTRUMENTO, revisarInstrumento, textoEspecificacion, type NormaEspecificacion } from './norma';

export const VERSION_CATALOGO = 'T4e-1';
export type Fila = Record<string, unknown>;
export const TIPOS_EQUIPO = { manometro_diferencial: 'Manómetro diferencial', manometro_filtro: 'Manómetro de filtro (Magnehelic)', termohigrometro: 'Termohigrómetro', otro: 'Otro' };
const siNo = ['Sí','No'];
const instrumentos = ['codigo*','tipo_equipo*','tipo_analisis*','variable*','area','area_libre','descripcion_equipo','codigo_bitacora','unidad*','escala_min','escala_max','lie','lie_estricto','lse','lse_estricto','estado_especificacion','referencia_normativa','criterio_interno','nota_especificacion','lie_hr','lse_hr','rango_op_min','rango_op_max','dp_base','tolerancia_base_pct','dp_saturacion','activo'];
export const HOJAS = {
  Sistemas_HVAC: ['codigo*','nombre*','descripcion','activo'],
  Areas: ['codigo*','nombre*','clase*','sistema_hvac','activo'],
  Instrumentos: instrumentos,
  Objetivos_presion: ['instrumento*','uso*','area_mayor','area_menor','valor*','unidad*','codigo','nombre','activo'],
} as const;
export type Hoja = keyof typeof HOJAS;
export const MAPA_INSTRUMENTO: Record<string,string> = { codigo:'codigo',tipo_equipo:'tipo',tipo_analisis:'clase_instrumento',variable:'parametro',area:'area_id',area_libre:'area_libre',descripcion_equipo:'descripcion_equipo',codigo_bitacora:'codigo_bitacora',unidad:'escala_unidad',escala_min:'escala_min',escala_max:'escala_max',lie:'spec_lie',lie_estricto:'spec_lie_estricto',lse:'spec_lse',lse_estricto:'spec_lse_estricto',estado_especificacion:'spec_estado',referencia_normativa:'spec_referencia',criterio_interno:'spec_criterio_interno',nota_especificacion:'spec_nota',lie_hr:'spec_lie_hr',lse_hr:'spec_lse_hr',rango_op_min:'op_min_pa',rango_op_max:'op_max_pa',dp_base:'baseline_pa',tolerancia_base_pct:'baseline_tolerancia_pct',dp_saturacion:'dp_final_fabricante',activo:'activo' };
const numericos = ['escala_min','escala_max','lie','lse','lie_hr','lse_hr','rango_op_min','rango_op_max','dp_base','tolerancia_base_pct','dp_saturacion','valor'];
const booleanos = ['activo','lie_estricto','lse_estricto','criterio_interno'];
export type Catalogo = { hvac: Fila[]; areas: Fila[]; instrumentos: Fila[]; objetivos: Fila[] };
export type LibroCatalogo = { version:string; hojas: Record<Hoja,Fila[]> };
export type CambioCatalogo = { hoja:Hoja; renglon:number; codigo:string; estado:'nuevo'|'cambia'|'sin cambio'|'error'; cambios:{campo:string;antes:unknown;despues:unknown}[]; errores:string[]; avisos:string[]; valores:Fila; anterior:Fila|null };
export type PreviewCatalogo = { filas:CambioCatalogo[]; errores:string[]; paquete:{version:string;filas:CambioCatalogo[]} };
const normal = (v:unknown) => String(v ?? '').trim().toLocaleLowerCase('es');
const texto = (v:unknown) => String(v ?? '').trim();
const clave = (v:string) => v.replace(/\*$/,'');
const igual = (a:unknown,b:unknown) => (a ?? null)===(b ?? null);
const porCodigo = (rows:Fila[],code:unknown) => rows.filter(r=>normal(r.codigo)===normal(code));
const listas: Partial<Record<Hoja,Record<string,readonly string[]>>> = {
  Sistemas_HVAC:{activo:siNo}, Areas:{clase:ISO_CLASES.map(etiquetaIso),activo:siNo},
  Instrumentos:{tipo_equipo:Object.values(TIPOS_EQUIPO),tipo_analisis:CLASES_INSTRUMENTO.map(c=>c.label),variable:VARIABLES_INSTRUMENTO,lie_estricto:siNo,lse_estricto:siNo,criterio_interno:siNo,estado_especificacion:['pendiente','validada','na'],activo:siNo},
  Objetivos_presion:{uso:['par de cuartos','saturación'],activo:siNo},
};
const ejemplos:Record<Hoja,Fila> = {
  Sistemas_HVAC:{codigo:'EJEMPLO-UMA',nombre:'Ejemplo UMA',activo:'Sí'},
  Areas:{codigo:'EJEMPLO-AREA',nombre:'Ejemplo área',clase:'Clase D (ISO-8)',sistema_hvac:'EJEMPLO-UMA',activo:'Sí'},
  Instrumentos:{codigo:'EJEMPLO-INS',tipo_equipo:'Manómetro diferencial',tipo_analisis:'Diferencial de sala',variable:'Presión diferencial',area:'EJEMPLO-AREA',unidad:'Pa',lie:5,lie_estricto:'Sí',estado_especificacion:'pendiente',activo:'Sí'},
  Objetivos_presion:{instrumento:'EJEMPLO-INS',uso:'par de cuartos',area_mayor:'EJEMPLO-AREA',valor:5,unidad:'Pa',codigo:'EJEMPLO-OBJ',activo:'Sí'},
};
const ayudas = [
  ['Sistemas_HVAC','Código de la etiqueta; nombre UMA y descripción.'],
  ['Areas','Área que monitorea; de ella se toma la clase ISO y la especificación sugerida. Sistema HVAC por código.'],
  ['Instrumentos','Equipo físico. Tipo de análisis: diferencial de sala → presiones de áreas; filtro o ducto → banco de filtros; aire comprimido o proceso y equipo → fuera del análisis de áreas.'],
  ['area / area_libre','Área libre solo si no está en el catálogo o para describir el par de cuartos.'],
  ['descripcion_equipo','Marca, modelo, escala y ubicación física. Ej.: DWYER Magnehelic 2000-30Pa, 0–30 Pa, Tablero 1.'],
  ['codigo_bitacora','Código del formato en papel donde se registra; solo el código. Ej.: FOR-MAN-05-01.'],
  ['variable','Qué mide. Ej.: Presión diferencial.'],
  ['lie / lse','Deja vacío el que no aplique. ISO-8: LIE 5; comparación estricta Sí para > 5 Pa. No significa mayor o igual. No deja la comparación vacía si hay límite.'],
  ['lie_hr / lse_hr','Solo termohigrómetro; Ej.: 30 y 65.'],
  ['estado_especificacion','Validada solo cuando el RS confirmó el criterio contra la norma o un documento interno. na conserva instrumentos sin especificación.'],
  ['referencia_normativa','Norma y apartado. Ej.: NOM-241-SSA1-2025 / NOM-059-SSA1-2015, Apéndice A.'],
  ['criterio_interno / nota_especificacion','Actívalo si usas un criterio más estricto que la norma. Ej.: ISO-9 > 5 Pa; documenta el criterio en la nota.'],
  ['escala_min / escala_max / unidad','Rango físico que puede leer. No es la especificación. Ej.: 0, 30, Pa.'],
  ['rango_op_min / rango_op_max','Informativo: valores habituales de operación. No es la especificación. Ej.: 8 y 12.'],
  ['dp_base / tolerancia_base_pct / dp_saturacion','Solo filtro o ducto: ΔP del filtro limpio al instalarlo (60), variación aceptada antes de alertar (20 %), ΔP máximo del fabricante para cambiarlo (250).'],
  ['Objetivos_presion','Par de cuartos: más presión → menos presión por códigos. valor = límite normativo. Saturación: valor = ΔP máximo del fabricante en el instrumento; no crea un par de cuartos.'],
  ['codigo / nombre / activo (objetivos)','Campos existentes adicionales para conservar identidad, nombre y estado al exportar/reimportar. Sin código nuevo: se sugiere OBJ-<instrumento>. No omitas código en objetivos existentes.'],
  ['activo','Sí mantiene activo; No desactiva con el motivo de aplicación. Filas ausentes no se modifican ni borran.'],
];

export function exportarFilas(c:Catalogo):Record<Hoja,Fila[]> {
  const code=(rows:Fila[],id:unknown)=>texto(rows.find(r=>r.id===id)?.codigo);
  return {
    Sistemas_HVAC:c.hvac.map(r=>({codigo:r.codigo,nombre:r.nombre_uma,descripcion:r.descripcion,activo:r.activo===false?'No':'Sí'})),
    Areas:c.areas.map(r=>({codigo:r.codigo,nombre:r.nombre,clase:etiquetaIso(String(r.iso ?? "")),sistema_hvac:code(c.hvac,r.hvac_id),activo:r.activo===false?'No':'Sí'})),
    Instrumentos:c.instrumentos.map(r=>Object.fromEntries(Object.entries(MAPA_INSTRUMENTO).map(([k,v])=>[k,k==='area'?code(c.areas,r.area_id):k==='tipo_equipo'?TIPOS_EQUIPO[r.tipo as keyof typeof TIPOS_EQUIPO] ?? r.tipo:k==='tipo_analisis'?CLASES_INSTRUMENTO.find(x=>x.value===r.clase_instrumento)?.label ?? '':booleanos.includes(k)?(r[v]?'Sí':'No'):r[v] ?? '']))),
    Objetivos_presion:c.objetivos.map(r=>({instrumento:code(c.instrumentos,r.instrumento_id),uso:'par de cuartos',area_mayor:code(c.areas,r.cuarto_x_id),area_menor:code(c.areas,r.cuarto_y_id),valor:r.limite_normativo_pa,unidad:r.unidad,codigo:r.codigo,nombre:r.nombre,activo:r.activo===false?'No':'Sí'})),
  };
}

/** Adds OOXML dropdowns using the already installed ZIP writer; no extra dependencies. */
export async function crearPlantilla(c?:Catalogo):Promise<Uint8Array> {
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Versión de plantilla',VERSION_CATALOGO],['Catálogo de Tendencias','IM-23'],['Instrucciones','Llenar solo columnas con encabezado. * obligatorio. EJEMPLO en la columna sin encabezado marca filas ignoradas; no usar esa marca en datos.'],...ayudas]),'Instrucciones');
  const instrucciones=wb.Sheets.Instrucciones;
  instrucciones['!cols']=[{wch:38},{wch:110}];
  for(const addr of Object.keys(instrucciones).filter(a=>!a.startsWith('!')))instrucciones[addr].s={font:{name:'Arial',sz:11},alignment:{wrapText:true,vertical:'top'}};
  const datos=c?exportarFilas(c):null;
  for(const hoja of Object.keys(HOJAS) as Hoja[]) {
    const headers=HOJAS[hoja];
    const rows=[...datos?.[hoja] ?? []];
    const ws=XLSX.utils.aoa_to_sheet([[...headers],[...headers.map(h=>ejemplos[hoja][clave(h)] ?? ''),'EJEMPLO'],...rows.map(r=>headers.map(h=>r[clave(h)] ?? ''))]);
    ws['!cols']=headers.map(()=>({wch:24})); ws['!autofilter']={ref:`A1:${XLSX.utils.encode_col(headers.length-1)}${rows.length+2}`};
    for(const addr of Object.keys(ws).filter(a=>!a.startsWith('!'))) {
      const {r}=XLSX.utils.decode_cell(addr);
      ws[addr].s={font:{name:'Arial',sz:11,bold:r===0,color:{rgb:r===0?'FFFFFF':r===1?'777777':'000000'}},fill:r===0?{fgColor:{rgb:'183D4A'}}:undefined,alignment:{wrapText:true,vertical:'top'}};
    }
    XLSX.utils.book_append_sheet(wb,ws,hoja);
  }
  const zip=await JSZip.loadAsync(XLSX.write(wb,{type:'array',bookType:'xlsx'}));
  const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  let index=2;
  for(const hoja of Object.keys(HOJAS) as Hoja[]) {
    const path=`xl/worksheets/sheet${index++}.xml`; const entry=zip.file(path); if(!entry)continue;
    const valid=Object.entries(listas[hoja] ?? {}).map(([key,values])=>{const col=XLSX.utils.encode_col(HOJAS[hoja].findIndex(h=>clave(h)===key));return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Valor no válido" error="Selecciona un valor de la lista" sqref="${col}2:${col}1048576"><formula1>&quot;${escape(values.join(','))}&quot;</formula1></dataValidation>`;});
    zip.file(path,insertarValidaciones(await entry.async('string'),`<dataValidations count="${valid.length}">${valid.join('')}</dataValidations>`));
  }
  return zip.generateAsync({type:'uint8array'});
}

export function leerPlantilla(buffer:ArrayBuffer):LibroCatalogo {
  const wb=XLSX.read(buffer,{type:'array'}); const ins=wb.Sheets.Instrucciones;
  const version=texto(ins?.B1?.v);
  const hojas={} as Record<Hoja,Fila[]>;
  for(const hoja of Object.keys(HOJAS) as Hoja[]) {
    const ws=wb.Sheets[hoja]; if(!ws)throw new Error(`Falta la hoja ${hoja}`);
    const grilla=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,defval:'',blankrows:true});
    const headers=(grilla[0] ?? []).map(texto);
    if(HOJAS[hoja].some(h=>!headers.includes(h)))throw new Error(`Encabezados incompletos en ${hoja}`);
    hojas[hoja]=grilla.slice(1).flatMap((r,index)=>{
      if(texto(r[HOJAS[hoja].length])==='EJEMPLO' || !r.some(v=>texto(v)))return [];
      return [{...Object.fromEntries(HOJAS[hoja].map(h=>[clave(h),r[headers.indexOf(h)] ?? ''])),_renglon:index+2}];
    });
  }
  return {version,hojas};
}

export function previsualizarCatalogo(libro:LibroCatalogo,c:Catalogo,normas:NormaEspecificacion[]=[],medias:Map<string,number>=new Map()):PreviewCatalogo {
  const errores:string[]=libro.version===VERSION_CATALOGO?[]:['Plantilla de otra versión'];
  const filas:CambioCatalogo[]=[];
  const refs=(hoja:Hoja,rows:Fila[],code:unknown)=>!texto(code) || porCodigo(rows,code).length===1 || libro.hojas[hoja].some(r=>normal(r.codigo)===normal(code));
  for(const hoja of Object.keys(HOJAS) as Hoja[]) {
    const vistos=new Set<string>();
    for(const [index,raw] of libro.hojas[hoja].entries()) {
      const r={...raw};const err:string[]=[]; const avisos:string[]=[];const renglon=Number(r._renglon ?? index+2);
      for(const h of HOJAS[hoja])if(h.endsWith('*') && !texto(r[clave(h)]))err.push(`Falta ${clave(h)}`);
      for(const [key,options] of Object.entries(listas[hoja] ?? {}))if(texto(r[key]) && !options.includes(texto(r[key])) && !(key==='clase' && (ISO_CLASES as string[]).includes(isoDesdeEtiqueta(r[key]))))err.push(`${key}: lista inválida`);
      for(const k of numericos.filter(k=>HOJAS[hoja].some(h=>clave(h)===k))) { const v=texto(r[k]);r[k]=v===''?null:Number(v.replace(',','.'));if(v!=='' && !Number.isFinite(r[k]))err.push(`${k}: número inválido`); }
      for(const k of booleanos.filter(k=>HOJAS[hoja].some(h=>clave(h)===k)))r[k]=texto(r[k])===''?(k==='activo'?true:k==='criterio_interno'?false:null):r[k]==='Sí';
      const codigo=hoja==='Objetivos_presion'?(texto(r.codigo)||`OBJ-${texto(r.instrumento)}`):texto(r.codigo);
      const unique=hoja==='Objetivos_presion' && r.uso==='saturación'?`saturacion:${normal(r.instrumento)}`:normal(codigo);
      if(vistos.has(unique))err.push('Código duplicado');vistos.add(unique);
      let valores:Fila={};let prev:Fila[]=[];
      if(hoja==='Sistemas_HVAC'){valores={codigo,nombre_uma:texto(r.nombre),descripcion:texto(r.descripcion),activo:r.activo};prev=porCodigo(c.hvac,codigo);}
      if(hoja==='Areas'){
        if(!refs('Sistemas_HVAC',c.hvac,r.sistema_hvac))err.push('Sistema HVAC inexistente');
        valores={codigo,nombre:texto(r.nombre),iso:isoDesdeEtiqueta(r.clase),hvac_codigo:texto(r.sistema_hvac)||null,activo:r.activo};prev=porCodigo(c.areas,codigo);
      }
      if(hoja==='Instrumentos'){
        if(!refs('Areas',c.areas,r.area))err.push('Área inexistente');
        if(r.estado_especificacion==='validada' && r.lie==null && r.lse==null && r.lie_hr==null && r.lse_hr==null)err.push('Validada sin ningún límite');
        if(r.lie!=null && r.lie_estricto==null || r.lse!=null && r.lse_estricto==null)err.push('Límite sin comparación');
        if(r.lie!=null && r.lse!=null && Number(r.lie)>Number(r.lse) || r.lie_hr!=null && r.lse_hr!=null && Number(r.lie_hr)>Number(r.lse_hr))err.push('LIE mayor que LSE');
        if(['Presión diferencial','ΔP de filtro'].includes(texto(r.variable)) && r.lie!=null && r.lse!=null && (Number(r.lie)>=18 && Number(r.lse)<=25 || Number(r.lie)>=30 && Number(r.lse)<=65))err.push('Valores que parecen de temperatura o HR en una presión');
        valores=Object.fromEntries(Object.entries(MAPA_INSTRUMENTO).map(([k,v])=>[v,r[k] ?? null]));
        valores.codigo=codigo;valores.tipo=Object.entries(TIPOS_EQUIPO).find(([,v])=>v===r.tipo_equipo)?.[0] ?? r.tipo_equipo;
        valores.clase_instrumento=CLASES_INSTRUMENTO.find(x=>x.label===r.tipo_analisis)?.value ?? r.tipo_analisis;
        delete valores.area_id;valores.area_codigo=texto(r.area)||null;
        valores.spec_lie_estricto=r.lie_estricto ?? false;valores.spec_lse_estricto=r.lse_estricto ?? false;
        valores.spec_estado=r.estado_especificacion || 'pendiente';
        for(const k of ['area_libre','descripcion_equipo','codigo_bitacora','spec_referencia','spec_nota'])valores[k]=texto(valores[k])||null;
        valores.spec_texto=textoEspecificacion(r.lie as number|null,r.lse as number|null,!!r.lie_estricto,!!r.lse_estricto,texto(r.unidad));
        valores.spec_texto_hr=textoEspecificacion(r.lie_hr as number|null,r.lse_hr as number|null,false,false,'%');
        prev=porCodigo(c.instrumentos,codigo);
        if(prev[0]?.area_estado==='validada' && !texto(r.area))err.push('Área validada sin área asignada');
        const iso=libro.hojas.Areas.find(a=>normal(a.codigo)===normal(r.area))?.clase;const iso2=iso?isoDesdeEtiqueta(iso):porCodigo(c.areas,r.area)[0]?.iso;
        avisos.push(...revisarInstrumento({...prev[0],...valores} as unknown as Instrumento,texto(iso2),medias.get(texto(prev[0]?.id)),normas).map(h=>h.mensaje));
      }
      if(hoja==='Objetivos_presion'){
        if(!refs('Instrumentos',c.instrumentos,r.instrumento))err.push('Instrumento inexistente');
        for(const k of ['area_mayor','area_menor'])if(!refs('Areas',c.areas,r[k]))err.push(`${k}: área inexistente`);
        if(r.uso==='saturación') {
          const i=libro.hojas.Instrumentos.find(i=>normal(i.codigo)===normal(r.instrumento)); const actual=porCodigo(c.instrumentos,r.instrumento)[0];
          if((i?.tipo_analisis ?? actual?.clase_instrumento)!=='Filtro o ducto' && (i?.tipo_analisis ?? actual?.clase_instrumento)!=='filtro_ducto')err.push('Saturación requiere filtro o ducto');
          if(i && texto(i.dp_saturacion)!=='' && Number(i.dp_saturacion)!==r.valor)err.push('Saturación contradice dp_saturacion del instrumento');
          if(i && texto(i.unidad)!==texto(r.unidad))err.push('Unidad de saturación distinta a la del instrumento');
          if(i && texto(i.activo) && (i.activo==='Sí')!==r.activo)err.push('Estado de saturación contradice activo del instrumento');
          valores={instrumento_codigo:r.instrumento,uso:r.uso,dp_final_fabricante:r.valor,escala_unidad:r.unidad,activo:r.activo};prev=actual?[actual]:[];
        } else {
          valores={codigo,nombre:texto(r.nombre)||codigo,instrumento_codigo:r.instrumento,uso:r.uso,cuarto_x_codigo:texto(r.area_mayor)||null,cuarto_y_codigo:texto(r.area_menor)||null,limite_normativo_pa:r.valor,unidad:r.unidad,activo:r.activo};prev=porCodigo(c.objetivos,codigo);
        }
      }
      if(prev.length>1)err.push('Código ambiguo: existen varios registros con ese código');
      const anterior=prev[0] ?? null;
      const equivalentes:Fila={...anterior};
      if(anterior){for(const [k,rows,id] of [['hvac_codigo',c.hvac,'hvac_id'],['area_codigo',c.areas,'area_id'],['instrumento_codigo',c.instrumentos,'instrumento_id'],['cuarto_x_codigo',c.areas,'cuarto_x_id'],['cuarto_y_codigo',c.areas,'cuarto_y_id']] as const)equivalentes[k]=rows.find(x=>x.id===anterior[id])?.codigo ?? null;}
      const cambios=Object.entries(valores).filter(([k,v])=>k!=='uso' && !igual(equivalentes[k],v)).map(([campo,despues])=>({campo,antes:equivalentes[campo] ?? null,despues}));
      filas.push({hoja,renglon,codigo,estado:err.length?'error':!anterior?'nuevo':cambios.length?'cambia':'sin cambio',cambios,errores:err,avisos,valores,anterior});
    }
  }
  errores.push(...filas.flatMap(f=>f.errores.map(e=>`${f.hoja} ${f.renglon}: ${e}`)));
  return {filas,errores,paquete:{version:libro.version,filas}};
}
/** Inserta dataValidations en la posición que exige el esquema OOXML (CT_Worksheet). */
const DESPUES_DE_VALIDACIONES=['hyperlinks','printOptions','pageMargins','pageSetup','headerFooter','rowBreaks','colBreaks','customProperties','cellWatches','ignoredErrors','smartTags','drawing','legacyDrawing','legacyDrawingHF','drawingHF','picture','oleObjects','controls','webPublishItems','tableParts','extLst'];
export function insertarValidaciones(xml:string,bloque:string):string{
  let pos=-1;
  for(const t of DESPUES_DE_VALIDACIONES){const m=new RegExp(`<${t}[\\s>/]`).exec(xml);if(m && (pos<0 || m.index<pos))pos=m.index;}
  if(pos<0)pos=xml.lastIndexOf('</worksheet>');
  return xml.slice(0,pos)+bloque+xml.slice(pos);
}
