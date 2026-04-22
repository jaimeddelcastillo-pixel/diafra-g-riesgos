import { supabase } from "@/integrations/supabase/client";

/** Devuelve la URL pública del logo de una org (o null si no hay). */
export function getOrgLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  // Si ya es URL absoluta, regresarla; si es path, generar pública
  if (/^https?:\/\//i.test(logoPath)) return logoPath;
  const { data } = supabase.storage.from("org-logos").getPublicUrl(logoPath);
  return data.publicUrl;
}

/**
 * Descarga el logo y lo entrega como DataURL para insertarlo en jsPDF.
 * Devuelve null si no existe o el formato no es PNG/JPG.
 */
export async function fetchOrgLogoDataUrl(
  logoPath: string | null | undefined,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  const url = getOrgLogoUrl(logoPath);
  if (!url) return null;
  try {
    const resp = await fetch(url, { cache: "no-cache" });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") || "";
    let format: "PNG" | "JPEG" | null = null;
    if (ct.includes("image/png")) format = "PNG";
    else if (ct.includes("image/jpeg") || ct.includes("image/jpg")) format = "JPEG";
    if (!format) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("read error"));
      r.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch {
    return null;
  }
}
