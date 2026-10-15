import { supabase } from "@/integrations/supabase/client";
import { generateFolioPDF, type VersionRow } from "@/lib/generateFolioPDF";
import { generarFichaConocimientoPDF, generarCaratulaPDF } from "@/lib/auditoriaPdf";

async function mensajeError(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch { /* noop */ }
  return error?.message ?? "No se pudo completar la acción";
}

function guardarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ResultadoArchivo =
  | { modo: "descarga" }
  | { modo: "vista"; url: string }        // no PDF: URL firmada de 60 s
  | { modo: "vista_pdf"; url: string };   // PDF con marca de agua en memoria (blob:)

/**
 * Archivo de un ítem (documento o evidencia).
 * PDF: siempre con marca de agua servida por la función; `descargar` lo guarda, si no se ve en pantalla.
 * No PDF: vista de 60 s.
 */
export async function abrirArchivoAuditor(itemId: string, nombre: string, path?: string, descargar = false): Promise<ResultadoArchivo> {
  const { data, error } = await supabase.functions.invoke("auditoria-descargar", {
    body: { item_id: itemId, path: path ?? null, modo: descargar ? "descarga" : "vista" },
  });
  if (error) throw new Error(await mensajeError(error));
  if (data instanceof Blob) {
    const pdf = new Blob([data], { type: "application/pdf" });
    if (descargar) {
      guardarBlob(pdf, `${nombre.replace(/\.pdf$/i, "")}_copia_auditoria.pdf`);
      return { modo: "descarga" };
    }
    return { modo: "vista_pdf", url: URL.createObjectURL(pdf) };
  }
  if (data?.modo === "vista" && data.url) {
    window.open(data.url, "_blank", "noopener");
    return { modo: "vista", url: data.url };
  }
  throw new Error(data?.error ?? "Respuesta inesperada");
}

/** PDF del folio generado en el navegador; antes valida y registra (vista o descarga) en el servidor. */
export async function folioPdfAuditor(itemId: string, datos: any, descargar: boolean): Promise<ResultadoArchivo> {
  const { data, error } = await supabase.rpc("auditor_registrar_folio_pdf" as any, { p_item_id: itemId, p_descargar: descargar });
  if (error) throw new Error(error.message);
  const r = data as { expediente: string; auditor: string; fecha: string };
  const fecha = new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  const marcaAgua = `COPIA NO CONTROLADA — ${r.expediente} — ${r.auditor} — ${fecha}`;
  const vs = (datos.versiones ?? []) as { version: string; motivo_revision: string | null; created_at: string; realizado_por: string | null }[];
  const versiones: VersionRow[] = vs.map((v, i) => ({
    version_de: v.version,
    version_a: vs[i + 1]?.version ?? (datos.folio.numero_version || "1.0"),
    fecha: new Date(v.created_at).toLocaleDateString("es-MX"),
    descripcion: v.motivo_revision || "—",
    realizado_por: v.realizado_por || "—",
  }));
  const blob = await generateFolioPDF(datos.folio, datos.riesgos, datos.comite, datos.org, { marcaAgua, versiones, soloBlob: !descargar });
  if (descargar || !blob) return { modo: "descarga" };
  return { modo: "vista_pdf", url: URL.createObjectURL(blob) };
}

/** C6c.2: ficha de conocimiento en PDF (BPD). Valida y registra antes de generar. */
export async function fichaConocimientoAuditor(itemId: string, datos: any, descargar: boolean): Promise<ResultadoArchivo> {
  const { data, error } = await supabase.rpc("auditor_registrar_pdf_generado" as any, { p_item_id: itemId, p_descargar: descargar });
  if (error) throw new Error(error.message);
  const blob = await generarFichaConocimientoPDF(datos, data as any, !descargar);
  if (descargar || !blob) return { modo: "descarga" };
  return { modo: "vista_pdf", url: URL.createObjectURL(blob) };
}

/** C6c.2: carátula e índice del expediente. La función valida acceso y registra. */
export async function caratulaAuditor(auditoriaId: string, descargar: boolean): Promise<ResultadoArchivo> {
  const { data, error } = await supabase.rpc("auditor_caratula" as any, { p_auditoria_id: auditoriaId, p_descargar: descargar });
  if (error) throw new Error(error.message);
  const blob = await generarCaratulaPDF(data, !descargar);
  if (descargar || !blob) return { modo: "descarga" };
  return { modo: "vista_pdf", url: URL.createObjectURL(blob) };
}
