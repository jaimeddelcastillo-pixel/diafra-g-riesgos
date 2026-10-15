import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Hash, Info, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrgTiposFolio } from "@/hooks/useOrgTiposFolio";
import { toast } from "sonner";

type Periodo = "anio_completo" | "anio_corto" | "trimestre" | "sin_periodo";

const PERIODOS: { value: Periodo; label: string; ejemplo: string }[] = [
  { value: "anio_completo", label: "Año completo", ejemplo: "2026" },
  { value: "anio_corto", label: "Año corto", ejemplo: "26" },
  { value: "trimestre", label: "Trimestre", ejemplo: "Q1-26" },
  { value: "sin_periodo", label: "Sin período", ejemplo: "—" },
];

export function periodoActual(formato: Periodo): string | null {
  const now = new Date();
  const y = now.getFullYear();
  switch (formato) {
    case "anio_completo": return String(y);
    case "anio_corto": return String(y).slice(-2);
    case "trimestre": return `Q${Math.floor(now.getMonth() / 3) + 1}-${String(y).slice(-2)}`;
    default: return null;
  }
}

export function previewCodigo(prefijo: string, tipo: string, formato: Periodo, digitos: number) {
  const per = periodoActual(formato);
  return [prefijo || "GR", tipo, per, "1".padStart(digitos, "0")]
    .filter(Boolean)
    .join("-");
}

export function OrgFolioCodigoCard() {
  const { orgId, hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("responsable_sanitario");
  const queryClient = useQueryClient();
  const { data: tipos } = useOrgTiposFolio(true);

  const { data: org } = useQuery({
    queryKey: ["org-folio-codigo", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, folio_prefijo, folio_formato_periodo, folio_digitos_consecutivo")
        .eq("id", orgId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [prefijo, setPrefijo] = useState("GR");
  const [formato, setFormato] = useState<Periodo>("anio_completo");
  const [digitos, setDigitos] = useState(3);

  useEffect(() => {
    if (org) {
      setPrefijo(org.folio_prefijo ?? "GR");
      setFormato((org.folio_formato_periodo ?? "anio_completo") as Periodo);
      setDigitos(org.folio_digitos_consecutivo ?? 3);
    }
  }, [org]);

  const prefijoValido = /^[A-Z]{2,4}$/.test(prefijo);

  const dirty =
    !!org &&
    (prefijo !== (org.folio_prefijo ?? "GR") ||
      formato !== (org.folio_formato_periodo ?? "anio_completo") ||
      digitos !== (org.folio_digitos_consecutivo ?? 3));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sin organización");
      const { error } = await supabase
        .from("organizations")
        .update({
          folio_prefijo: prefijo,
          folio_formato_periodo: formato,
          folio_digitos_consecutivo: digitos,
        })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Formato de folio actualizado — aplica a folios nuevos");
      queryClient.invalidateQueries({ queryKey: ["org-folio-codigo", orgId] });
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const tipoEjemplo = tipos?.[0]?.codigo ?? "SGC";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Hash className="h-4 w-4" /> Formato de folio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Define cómo se arma el código de los folios de tu organización:
          prefijo, grupo, período y consecutivo, separados por guion.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Prefijo</label>
            <Input
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
              placeholder="GR"
              disabled={!canEdit}
            />
            <p className={`text-[10px] ${prefijoValido ? "text-muted-foreground" : "text-destructive"}`}>
              2 a 4 letras (A–Z).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Período</label>
            <Select value={formato} onValueChange={(v) => setFormato(v as Periodo)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} {p.ejemplo !== "—" ? `(${p.ejemplo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">El consecutivo reinicia con cada período.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Consecutivo</label>
            <Select
              value={String(digitos)}
              onValueChange={(v) => setDigitos(Number(v))}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 dígitos (001)</SelectItem>
                <SelectItem value="4">4 dígitos (0001)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Longitud del número secuencial.</p>
          </div>
        </div>

        <div className="rounded border bg-muted/30 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">
            Vista previa
          </p>
          <p className="text-xs">
            Tu próximo folio se verá así:{" "}
            <span className="font-mono font-semibold">
              {previewCodigo(prefijo, tipoEjemplo, formato, digitos)}
            </span>
          </p>
        </div>

        {dirty && (
          <div className="rounded border border-primary/30 bg-primary/5 px-3 py-2 flex gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Este cambio aplica solo a folios nuevos. Los folios ya creados conservan su código
              original. Esto protege la trazabilidad regulatoria de tu expediente.
            </p>
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1"
              disabled={!dirty || !prefijoValido || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}