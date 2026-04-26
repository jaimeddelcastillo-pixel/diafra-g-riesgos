import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function OrgFormatoCard() {
  const { orgId, hasRole } = useAuth();
  const canEdit = hasRole("admin");
  const queryClient = useQueryClient();

  const { data: orgRow } = useQuery({
    queryKey: ["org-formato", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nombre, codigo_formato, version_formato")
        .eq("id", orgId!)
        .single();
      if (error) throw error;
      return data as { id: string; nombre: string; codigo_formato: string; version_formato: string };
    },
  });

  const [codigo, setCodigo] = useState("");
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (orgRow) {
      setCodigo(orgRow.codigo_formato || "");
      setVersion(orgRow.version_formato || "");
    }
  }, [orgRow]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sin organización");
      const { error } = await supabase
        .from("organizations")
        .update({
          codigo_formato: codigo.trim(),
          version_formato: version.trim(),
        } as any)
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Formato actualizado");
      queryClient.invalidateQueries({ queryKey: ["org-formato", orgId] });
      // Recarga global para refrescar la cabecera del folio y los PDFs
      setTimeout(() => window.location.reload(), 400);
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const dirty =
    !!orgRow &&
    (codigo.trim() !== (orgRow.codigo_formato || "") ||
      version.trim() !== (orgRow.version_formato || ""));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Identificación del Formato Documental
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Estos valores aparecen en la cabecera y pie del Archivo Maestro de Gestión de Riesgos
            (UI, PDFs y correos), junto con el nombre de la organización. Personalízalos según tu
            sistema de calidad (FEUM / ISO 14971 / NOM-241-SSA1-2025). Déjalos vacíos si tu
            organización aún no asigna un código de formato controlado.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                Código del formato
              </label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej. FOR-SGC-11-01 (opcional)"
                disabled={!canEdit}
                maxLength={40}
              />
              <p className="text-[10px] text-muted-foreground">
                Código interno del documento controlado.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                Versión / revisión
              </label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Ej. 02 (opcional)"
                disabled={!canEdit}
                maxLength={10}
              />
              <p className="text-[10px] text-muted-foreground">
                Número o etiqueta de revisión del formato.
              </p>
            </div>
          </div>

          <div className="rounded border bg-muted/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Vista previa
            </p>
            <p className="text-xs">
              {codigo.trim() ? (
                <>
                  <span className="font-mono">
                    {codigo.trim()}
                    {version.trim() ? ` (${version.trim()})` : ""}
                  </span>{" "}
                  · {orgRow?.nombre || "—"}
                </>
              ) : (
                <span className="italic text-muted-foreground">
                  Sin código de formato — solo se mostrará el nombre de la organización: {orgRow?.nombre || "—"}
                </span>
              )}
            </p>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!dirty || saveMutation.isPending}
                className="gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}