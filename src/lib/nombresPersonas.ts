import { supabase } from "@/integrations/supabase/client";

/**
 * Nombres de personas de la empresa activa, incluidas las desactivadas (C2b-F).
 * El servidor solo responde por miembros actuales o personas en la bitácora de la empresa.
 */
export async function nombresPersonas(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x && /^[0-9a-f-]{36}$/i.test(x)))];
  const m: Record<string, string> = {};
  for (let i = 0; i < unicos.length; i += 200) {
    const { data } = await supabase.rpc("nombres_personas" as any, { _ids: unicos.slice(i, i + 200) });
    ((data as any[]) ?? []).forEach((p) => { if (p?.id) m[p.id] = p.nombre || p.id; });
  }
  return m;
}
