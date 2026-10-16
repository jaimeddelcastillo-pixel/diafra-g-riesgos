import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Sparkles } from "lucide-react";

/** C4b: interruptor «Composición de IA (Riesgos)» por empresa. Solo super_admin; queda en la bitácora. */
export default function ComposicionIACard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ia-config-org", orgId],
    queryFn: async () => {
      const [{ data: cfg }, { data: org }] = await Promise.all([
        supabase.from("ia_config_org").select("composicion_riesgos, cambiado_en").eq("org_id", orgId).maybeSingle(),
        supabase.from("organizations").select("es_prueba").eq("id", orgId).maybeSingle(),
      ]);
      return { valor: (cfg?.composicion_riesgos ?? "monolitica") as string, cambiado: cfg?.cambiado_en ?? null, esPrueba: !!(org as any)?.es_prueba };
    },
  });

  async function cambiar(valor: string) {
    if (valor === "bloques" && data && !data.esPrueba &&
        !window.confirm("Vas a cambiar la IA de una empresa real a la composición por bloques. El cambio queda en la bitácora. ¿Continuar?")) return;
    const { error } = await supabase.from("ia_config_org")
      .upsert({ org_id: orgId, composicion_riesgos: valor }, { onConflict: "org_id" });
    if (error) { toast({ title: "No se pudo cambiar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Composición actualizada", description: "El cambio quedó en la bitácora." });
    qc.invalidateQueries({ queryKey: ["ia-config-org", orgId] });
    qc.invalidateQueries({ queryKey: ["ia-skills-uso-empresas"] });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Composición de IA (Riesgos)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={data?.valor ?? "monolitica"} onValueChange={(v) => void cambiar(v)}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monolitica">Monolítica (dm / farma)</SelectItem>
            <SelectItem value="bloques">Por bloques</SelectItem>
            <SelectItem value="bloques_borrador" disabled={!data?.esPrueba}>
              Por bloques con borradores{!data?.esPrueba ? " (solo empresas de prueba)" : ""}
            </SelectItem>
          </SelectContent>
        </Select>
        {data && !data.esPrueba && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Empresa real: la composición por bloques es solo para pilotos.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Por bloques se usa solo si plataforma, riesgos_amef y la norma tienen versión vigente; con borradores usa el borrador de cada pieza si existe y si no la vigente. Si falta alguna, sigue con dm/farma y se registra.
        </p>
      </CardContent>
    </Card>
  );
}
