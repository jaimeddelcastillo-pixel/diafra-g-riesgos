import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Hooks de lectura del Cerebro Institucional (patrón useOrgTiposFolio). */
function useOrgQuery<T>(key: string, fn: (orgId: string) => Promise<T>) {
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["brain", key, orgId],
    enabled: !!orgId,
    queryFn: () => fn(orgId!),
  });
}

export function useBrainAreas(soloActivas = true) {
  return useOrgQuery("areas", async (orgId) => {
    let q = supabase
      .from("brain_areas")
      .select("*")
      .eq("org_id", orgId)
      .order("orden", { ascending: true });
    if (soloActivas) q = q.eq("activo", true);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainProcesses() {
  return useOrgQuery("processes", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_processes")
      .select("*")
      .eq("org_id", orgId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainDocuments() {
  return useOrgQuery("documents", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_documents")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainAssignments() {
  return useOrgQuery("assignments", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_interview_assignments")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainSessions() {
  return useOrgQuery("sessions", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_interview_sessions")
      .select("*")
      .eq("org_id", orgId)
      .order("iniciada_en", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainKnowledge() {
  return useOrgQuery("knowledge", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_knowledge_items")
      .select("*, fuentes:brain_knowledge_sources(id, tipo_fuente, archivo_id, documento_codigo, documento_revision, nombre_fuente, pagina, parrafo, seccion, cita_textual, metodo, extraccion_id)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainContradictions() {
  return useOrgQuery("contradictions", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_contradictions")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainGaps() {
  return useOrgQuery("gaps", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_gaps")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainExports() {
  return useOrgQuery("exports", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_exports")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

/**
 * Índice de madurez del conocimiento identificado.
 * validados / (capturados + gaps abiertos) × 100
 */
export function calcularCobertura(
  validados: number,
  capturados: number,
  gapsAbiertos: number,
): number {
  const base = capturados + gapsAbiertos;
  if (base <= 0) return 0;
  return Math.round((validados / base) * 100);
}
export function useBrainImportBatches() {
  return useOrgQuery("import-batches", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_import_batches")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

export function useBrainImportPropuestas() {
  return useOrgQuery("import-propuestas", async (orgId) => {
    const { data, error } = await supabase
      .from("brain_import_propuestas")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}
