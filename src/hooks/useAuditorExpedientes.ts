import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ItemExpediente {
  id: string;
  tipo: "folio" | "documento" | "conocimiento";
  titulo: string | null;
  incluir_evidencias: boolean;
}

export interface ExpedienteAuditor {
  id: string;
  nombre: string;
  org_nombre: string;
  auditor_nombre: string;
  inicia_en: string;
  expira_en: string;
  permite_descarga: boolean;
  items: ItemExpediente[];
}

/** Expedientes de auditoría externa activos y vigentes de la persona (C6c). */
export function useAuditorExpedientes(habilitado = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["auditor-expedientes", user?.id],
    enabled: !!user && habilitado,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("auditor_mis_expedientes" as any);
      if (error) throw error;
      return (data ?? []) as unknown as ExpedienteAuditor[];
    },
  });
}
