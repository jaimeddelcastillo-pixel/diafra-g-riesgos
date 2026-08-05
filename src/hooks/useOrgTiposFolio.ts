import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrgFolioTipo {
  id: string;
  org_id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  es_personalizado: boolean;
  orden: number;
}

/** Tipos/grupos de folio configurados para la organización activa. */
export function useOrgTiposFolio(soloActivos = true) {
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["org-folio-tipos", orgId, soloActivos],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from("org_folio_tipos")
        .select("id, org_id, codigo, nombre, activo, es_personalizado, orden")
        .eq("org_id", orgId!)
        .order("orden", { ascending: true });
      if (soloActivos) q = q.eq("activo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OrgFolioTipo[];
    },
  });
}

/** Etiqueta "SGC — Sistema de Gestión de Calidad" a partir de la lista cargada. */
export function labelTipo(tipos: OrgFolioTipo[] | undefined, codigo: string): string {
  const t = tipos?.find((x) => x.codigo === codigo);
  return t ? `${t.codigo} — ${t.nombre}` : codigo;
}