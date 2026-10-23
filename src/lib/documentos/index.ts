import { supabase } from '@/integrations/supabase/client';
import { fetchOrgLogoDataUrl } from '@/lib/orgLogo';
import { TIPOS_DOCUMENTO, type RolFirma } from '@/config/documentos';

/** D1: identidad documental compartida (encabezado, pie, firmas y folio TRACEA). */
export interface Firma { rol: RolFirma; nombre: string; cargo: string }
export interface Identidad { id?: string; version?: number; razon_social: string; domicilio: string; leyenda_confidencialidad: string; leyenda_copia: string; pie: string }
export interface Formato { id?: string; version?: number; tipo: string; codigo: string; version_formato: string; titulo: string; firmas: Firma[]; vigente_desde: string | null }
export interface Logo { dataUrl: string; format: 'PNG' | 'JPEG' }
export interface RegistroDocumento { folio: string; generado_en: string; formato: Formato | null; identidad: Identidad | null }

export interface ContextoDocumento {
  tipo: string; titulo: string; codigo: string; version: string; vigencia: string;
  razonSocial: string; domicilio: string; logo: Logo | null;
  leyendas: string[]; generadoPor: string; generadoEn: string; folio: string; firmas: Firma[];
}

export const fechaHoraMexico = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
const fechaMexico = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { dateStyle: 'medium' }) : '';

/** Pure: builds the context from the server registration. Logo only comes from the company itself. */
export function construirContexto(tipo: string, reg: RegistroDocumento, opts: { empresa: string; generadoPor: string; logo: Logo | null }): ContextoDocumento {
  const f = reg.formato; const i = reg.identidad;
  return {
    tipo,
    titulo: f?.titulo || TIPOS_DOCUMENTO[tipo]?.titulo || tipo,
    codigo: f?.codigo || '', version: f?.version_formato || '', vigencia: fechaMexico(f?.vigente_desde ?? null),
    razonSocial: i?.razon_social || opts.empresa, domicilio: i?.domicilio || '',
    logo: opts.logo,
    leyendas: [i?.leyenda_copia, i?.leyenda_confidencialidad, i?.pie].filter((x): x is string => !!x && !!x.trim()),
    generadoPor: opts.generadoPor, generadoEn: reg.generado_en, folio: reg.folio,
    firmas: (f?.firmas ?? []).filter(x => x?.rol),
  };
}

export const lineaGenerado = (c: ContextoDocumento) => `Generado por ${c.generadoPor} el ${fechaHoraMexico(c.generadoEn)} · ${c.folio}`;
export const datosFormato = (c: ContextoDocumento) =>
  [c.codigo && `Código: ${c.codigo}`, c.version && `Versión: ${c.version}`, c.vigencia && `Vigente desde: ${c.vigencia}`].filter(Boolean) as string[];

/** Registers the document (folio, versions used) and loads the company logo. */
export async function prepararDocumento(tipo: string, nombreArchivo: string, opts: { empresa: string; logoPath: string | null | undefined; generadoPor: string }): Promise<ContextoDocumento> {
  if (!TIPOS_DOCUMENTO[tipo]) throw new Error(`Tipo de documento no registrado: ${tipo}`);
  const [{ data, error }, logo] = await Promise.all([
    supabase.rpc('registrar_documento_generado', { _tipo: tipo, _nombre_archivo: nombreArchivo }),
    fetchOrgLogoDataUrl(opts.logoPath),
  ]);
  if (error) throw error;
  return construirContexto(tipo, data as unknown as RegistroDocumento, { empresa: opts.empresa, generadoPor: opts.generadoPor, logo });
}

export async function guardarIdentidad(i: Identidad, motivo: string) {
  const { error } = await supabase.rpc('guardar_identidad_documental', { _razon_social: i.razon_social, _domicilio: i.domicilio, _confidencialidad: i.leyenda_confidencialidad, _copia: i.leyenda_copia, _pie: i.pie, _motivo: motivo });
  if (error) throw error;
}
export async function guardarFormato(f: Formato, motivo: string) {
  const { error } = await supabase.rpc('guardar_formato_documento', { _tipo: f.tipo, _codigo: f.codigo, _version: f.version_formato, _titulo: f.titulo, _firmas: f.firmas as never, _vigente_desde: (f.vigente_desde || null) as never, _motivo: motivo });
  if (error) throw error;
}
