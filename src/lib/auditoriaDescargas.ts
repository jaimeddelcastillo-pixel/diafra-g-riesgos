import { supabase } from "@/integrations/supabase/client";
import { generateFolioPDF, type VersionRow } from "@/lib/generateFolioPDF";

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

/** Archivo de un ítem (documento o evidencia): PDF con marca de agua, o vista de 60 s si no es PDF. */
export async function abrirArchivoAuditor(itemId: string, nombre: string, path?: string) {
  const { data, error } = await supabase.functions.invoke("auditoria-descargar", {
    body: { item_id: itemId, path: path ?? null },
  });
  if (error) throw new Error(await mensajeError(error));
  if (data instanceof Blob) {
    guardarBlob(data, `${nombre.replace(/\.pdf$/i, "")}_copia_auditoria.pdf`);
    return "descarga" as const;
  }
  if (data?.modo === "vista" && data.url) {
    window.open(data.url, "_blank", "noopener");
    return "vista" as const;
  }
  throw new Error(data?.error ?? "Respuesta inesperada");
}

/** PDF del folio generado en el navegador; antes valida y registra la descarga en el servidor. */
export async function descargarFolioAuditor(itemId: string, datos: any) {
  const { data, error } = await supabase.rpc("auditor_registrar_descarga_folio" as any, { p_item_id: itemId });
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
  await generateFolioPDF(datos.folio, datos.riesgos, datos.comite, datos.org, { marcaAgua, versiones });
}
