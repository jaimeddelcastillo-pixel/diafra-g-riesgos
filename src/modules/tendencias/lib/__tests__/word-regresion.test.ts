import { describe,it,expect,vi } from 'vitest';import JSZip from 'jszip';
import { generarWordForVal16 as original } from './word-atdiafra.reference';import { FORMATO_DEFAULT as originalFormato } from './formato-atdiafra.reference';
import { generarWordForVal16,type WordArgs } from '../word-forval16';import { FORMATO_DEFAULT } from '../formato-forval16';import { construirBloques } from '../export-forval16';import { generarTexto } from '../texto-forval16';import type { Registro } from '../semanas';import type { Instrumento } from '../catalogos';import fixture from './fixtures/ins-cmb-03-t-q1-2025.json';
const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
class TestImage {naturalWidth=1;naturalHeight=1;onload?:()=>void;set src(_:string){queueMicrotask(()=>this.onload?.());}}
const datos=()=>{
 const r={...fixture,id:'fixture',nombre:'Fixture de prueba',modulo:'temphr',instrumento_id:'fixture-instrumento',area_id:'fixture-area',iso:'ISO-7',created_at:'2025-01-01',lie_t:18,lse_t:25,lie_hr:30,lse_hr:65,semanas:fixture.semanas.map((s,i)=>({...s,id:`sem-${i}`,mes:'enero',anio:'2025',unidad:'°C',observaciones:'',source:'manual',saved_at:'2025-04-01',lecturas:s.lecturas.map(p=>({...p,hora:null,quien:null}))}))} as Registro;
 const i:Instrumento={id:'fixture-instrumento',codigo:'INS-CMB-03',tipo:'termohigrometro',area_id:'fixture-area',area_libre:null,parametro:'Temperatura',especificacion:'18 a 25 °C',activo:true,lie_pa:null,lse_pa:null,baseline_pa:null,baseline_tolerancia_pct:null,codigo_bitacora:'BIT-QA',dp_final_fabricante:null,spec_estado:'validada',spec_lie:18,spec_lse:25,spec_lie_hr:30,spec_lse_hr:65,area_estado:'validada'};
 const {bloques}=construirBloques({registros:[r],instrMap:new Map([[i.id,i]]),areasMap:new Map([['fixture-area',{id:'fixture-area',codigo:'QA-01',nombre:'Área QA',iso:'ISO-7',hvac_id:null,activo:true}]]),desde:'2025-01-01',hasta:'2025-03-31'});
 const texto=generarTexto(bloques,{primera:'2025-01-06',ultima:'2025-03-31'},{tipo:'instrumentos',codigos:[i.codigo]});
 return {bloques,texto};
};
const normalize=(xml:string)=>xml.replace(/\b(?:r:id|r:embed)="[^"]+"/g,'r:id="REL"').replace(/(<wp:docPr[^>]*\bid=")[^"]+/g,'$1ID');
describe('Regresión Word atdiafra con identidad en tend_formato',()=>{
 it('mantiene mismas secciones, tablas, textos y resultados con los mismos datos',async()=>{
  vi.stubGlobal('Blob', (await import('node:buffer')).Blob);
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:()=> 'blob:qa'});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:()=>{}});
  vi.stubGlobal('Image',TestImage);
  const {bloques,texto}=datos();expect(bloques.length).toBeGreaterThan(0);expect(bloques[0].n).toBeGreaterThan(0);
  const args:WordArgs={...{formato:{...originalFormato,logo}},codigoAT:'AT-2025-001',version:1,estado:'emitido',emitidoAt:'2025-04-01',sistema:'QA',tituloSistema:'Sistema QA',periodo:'enero–marzo 2025',desde:'2025-01-01',hasta:'2025-03-31',bloques,texto,justificaciones:{},cambios:[],sustituye:'N/A',areas:['QA-01 Área QA'],png:async()=>[{nombre:'gráfica QA',blob:await(await fetch(logo)).blob()}]};
  const formato={...FORMATO_DEFAULT,version:originalFormato.version,logo,firmantes:originalFormato.firmantes,identidad:{nombre:'DIAFRA S.A. de C.V.',logoDescripcion:'Logo DIAFRA',confidencialidad:'Documento confidencial propiedad de Diafra S. A. de C. V. Queda prohibido su uso, divulgación y/o reproducción total o parcial sin previa autorización.'}};
  const before=await original(args);const after=await generarWordForVal16({...args,formato});
  const [a,b]=await Promise.all([JSZip.loadAsync(await before.blob.arrayBuffer()),JSZip.loadAsync(await after.blob.arrayBuffer())]);
  expect(after.archivo).toBe(before.archivo);
  const parts=['word/document.xml','word/header1.xml','word/footer1.xml','word/numbering.xml','word/styles.xml'];
  for(const path of parts){const pa=a.file(path),pb=b.file(path);if(!pa || !pb)throw new Error(`Falta ${path}`);const xa=normalize(await pa.async('string')),xb=normalize(await pb.async('string'));expect(xb,path).toBe(xa);}
  const da=a.file('word/document.xml'),db=b.file('word/document.xml');if(!da || !db)throw new Error('Sin documento');const xa=await da.async('string'),xb=await db.async('string');
  expect(xb.match(/<w:tbl>/g)?.length).toBe(xa.match(/<w:tbl>/g)?.length);
  expect(xb.match(/<w:t[^>]*>.*?<\/w:t>/g)).toEqual(xa.match(/<w:t[^>]*>.*?<\/w:t>/g));
  const mediaA=Object.keys(a.files).filter(k=>k.startsWith('word/media/')&&!a.files[k].dir),mediaB=Object.keys(b.files).filter(k=>k.startsWith('word/media/')&&!b.files[k].dir);expect(mediaB).toEqual(mediaA);for(const path of mediaA){expect(await b.file(path)?.async('uint8array')).toEqual(await a.file(path)?.async('uint8array'));}
  vi.unstubAllGlobals();
 });
});
describe('Marca de agua del Word FOR-VAL-16-02',()=>{
 it('el borrador lleva marca de agua y el emitido va limpio',async()=>{
  vi.stubGlobal('Blob', (await import('node:buffer')).Blob);
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:()=> 'blob:qa'});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:()=>{}});
  vi.stubGlobal('Image',TestImage);
  const fakeCtx={fillStyle:'',textAlign:'',textBaseline:'',font:'',translate(){},rotate(){},fillText(){}};
  const realCreate=document.createElement.bind(document);
  const pngBytes=Uint8Array.from(atob(logo.split(',')[1]),c=>c.charCodeAt(0));
  vi.spyOn(document,'createElement').mockImplementation((tag:string)=>tag==='canvas'?({width:0,height:0,getContext:()=>fakeCtx,toBlob:(cb:BlobCallback)=>cb(new Blob([pngBytes],{type:'image/png'}))} as unknown as HTMLElement):realCreate(tag as 'div'));
  const {bloques,texto}=datos();
  const formato={...FORMATO_DEFAULT,logo,identidad:{nombre:'DIAFRA S.A. de C.V.',logoDescripcion:'Logo DIAFRA',confidencialidad:'Documento confidencial propiedad de Diafra S. A. de C. V.'}};
  const base:WordArgs={formato,codigoAT:'AT-2025-001',version:1,estado:'borrador',emitidoAt:null,sistema:'QA',tituloSistema:'Sistema QA',periodo:'enero–marzo 2025',desde:'2025-01-01',hasta:'2025-03-31',bloques,texto,justificaciones:{},cambios:[],sustituye:'N/A',areas:['QA-01'],png:async()=>[{nombre:'g',blob:await(await fetch(logo)).blob()}]};
  const borrador=await generarWordForVal16(base);
  const emitidoDoc=await generarWordForVal16({...base,estado:'emitido',emitidoAt:'2025-04-01'});
  const [zb,ze]=await Promise.all([JSZip.loadAsync(await borrador.blob.arrayBuffer()),JSZip.loadAsync(await emitidoDoc.blob.arrayBuffer())]);
  const hb=await zb.file('word/header1.xml')?.async('string') ?? '';const he=await ze.file('word/header1.xml')?.async('string') ?? '';
  expect(hb).toContain('behindDoc');expect(he).not.toContain('behindDoc');
  expect(hb).toContain('Borrador');expect(he).toContain('01');expect(he).not.toContain('>Borrador<');
  vi.unstubAllGlobals();
 });
});
