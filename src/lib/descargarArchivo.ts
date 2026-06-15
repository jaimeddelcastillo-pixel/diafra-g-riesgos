import { supabase } from "@/integrations/supabase/client";

/**
 * Descarga un archivo de un bucket público de Storage como blob y dispara
 * la descarga en el navegador sin navegar a la URL de Supabase.
 *
 * Esto evita que extensiones como WOT (Web of Trust) marquen el dominio
 * `*.supabase.co` como sospechoso, ya que el navegador nunca abre esa URL
 * en una pestaña — solo hace un fetch en segundo plano.
 *
 * @returns true si la descarga inició correctamente
 */
export async function descargarArchivoStorage(
  bucket: string,
  storagePath: string,
  nombreSugerido?: string,
): Promise<boolean> {
  try {
    // Intentar descarga directa por SDK (funciona en buckets públicos y privados con sesión)
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) return false;

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreSugerido ?? storagePath.split("/").pop() ?? "archivo";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (e) {
    console.error("descargarArchivoStorage", e);
    return false;
  }
}