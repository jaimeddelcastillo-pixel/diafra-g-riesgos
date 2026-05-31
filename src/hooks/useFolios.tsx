import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

export type Folio = Tables<"folios">;
export type Riesgo = Tables<"riesgos">;
export type FolioComite = Tables<"folio_comite">;
export type AuditEntry = Tables<"audit_trail">;

export function useFolios() {
  const { orgId, isSuperAdmin } = useAuth();
  return useQuery({
    queryKey: ["folios", orgId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("folios").select("*").order("codigo", { ascending: true });
      // Super admin sin org seleccionada ve todo; con orgId (real o impersonado) filtra
      if (orgId) q = q.eq("org_id", orgId);
      if (error) throw error;
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Folio[];
    },
    enabled: orgId != null || isSuperAdmin(),
  });
}

export function useFolioDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["folio", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: folio, error } = await supabase
        .from("folios")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;

      const [{ data: riesgos }, { data: comite }] = await Promise.all([
        supabase.from("riesgos").select("*").eq("folio_id", id!).order("numero_id"),
        supabase.from("folio_comite").select("*").eq("folio_id", id!).order("created_at"),
      ]);

      return {
        folio: folio as Folio,
        riesgos: (riesgos || []) as Riesgo[],
        comite: (comite || []) as FolioComite[],
      };
    },
  });
}

export function useAllRiesgos() {
  return useQuery({
    queryKey: ["all-riesgos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("riesgos").select("*, folios(codigo)");
      if (error) throw error;
      return data as (Riesgo & { folios: { codigo: string } | null })[];
    },
  });
}

export function useAuditTrail() {
  return useQuery({
    queryKey: ["audit-trail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_trail")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditEntry[];
    },
  });
}

export function getNPRLevel(npr: number, severidad?: number) {
  if ((severidad !== undefined && severidad >= 9) || npr > 150)
    return { label: "Crítico", color: "npr-critical", dot: "🔴" };
  if (npr >= 60)
    return { label: "Mayor", color: "npr-high", dot: "🟡" };
  return { label: "Menor", color: "npr-low", dot: "🟢" };
}

export function getEstadoStyle(estado: string) {
  switch (estado) {
    case "Borrador": return "bg-secondary text-secondary-foreground";
    case "En Firma": return "bg-primary text-primary-foreground";
    case "Aprobado": return "bg-success text-success-foreground";
    case "Cerrado": return "bg-muted text-muted-foreground";
    default: return "";
  }
}
