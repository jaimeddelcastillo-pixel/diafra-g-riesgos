import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getOrgLogoUrl } from "@/lib/orgLogo";

const MAX_BYTES = 1024 * 1024; // 1 MB

export function OrgLogoCard() {
  const { orgId, hasRole } = useAuth();
  const canEdit = hasRole("admin");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { data: orgRow } = useQuery({
    queryKey: ["org-logo", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nombre, logo_url")
        .eq("id", orgId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const currentUrl = previewUrl || getOrgLogoUrl(orgRow?.logo_url ?? null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/png", "image/jpeg"].includes(f.type)) {
      toast.error("Solo se permiten archivos PNG o JPG");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("El logo no debe exceder 1 MB");
      return;
    }
    setPendingFile(f);
    const r = new FileReader();
    r.onload = () => setPreviewUrl(r.result as string);
    r.readAsDataURL(f);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!pendingFile || !orgId) throw new Error("Sin archivo");
      const ext = pendingFile.type === "image/png" ? "png" : "jpg";
      const path = `${orgId}/logo.${ext}`;
      // borrar variantes previas (png/jpg) para no dejar huérfanos
      await supabase.storage.from("org-logos").remove([
        `${orgId}/logo.png`,
        `${orgId}/logo.jpg`,
      ]).catch(() => {});
      const { error: upErr } = await supabase.storage
        .from("org-logos")
        .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
      if (upErr) throw upErr;
      const { error: orgErr } = await supabase
        .from("organizations")
        .update({ logo_url: path })
        .eq("id", orgId);
      if (orgErr) throw orgErr;
    },
    onSuccess: () => {
      toast.success("Logo actualizado");
      setPendingFile(null);
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ["org-logo", orgId] });
      // forzar recarga global de la org (sidebar)
      setTimeout(() => window.location.reload(), 400);
    },
    onError: (e: any) => toast.error(e.message || "Error al subir el logo"),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !orgRow?.logo_url) return;
      await supabase.storage.from("org-logos").remove([orgRow.logo_url]).catch(() => {});
      const { error } = await supabase
        .from("organizations")
        .update({ logo_url: "" })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Logo eliminado");
      setPendingFile(null);
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ["org-logo", orgId] });
      setTimeout(() => window.location.reload(), 400);
    },
    onError: (e: any) => toast.error(e.message || "No se pudo eliminar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Logo de la Organización
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6 flex-wrap">
          <div
            className={`w-[160px] h-[100px] border-2 border-dashed rounded flex items-center justify-center bg-muted/30 overflow-hidden ${
              canEdit ? "cursor-pointer" : ""
            }`}
            onClick={() => canEdit && inputRef.current?.click()}
          >
            {currentUrl ? (
              <img src={currentUrl} alt="Logo organización" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center text-muted-foreground text-xs px-2">
                <Upload className="h-5 w-5 mx-auto mb-1" />
                {canEdit ? "Subir logo" : "Sin logo"}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[200px] space-y-2">
            <p className="text-xs text-muted-foreground">
              Este logo se mostrará en el menú lateral y en los encabezados de los PDFs (folio individual y listado de folios).
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>Formatos: PNG o JPG</li>
              <li>Tamaño máximo: 1 MB</li>
              <li>Recomendado: imagen rectangular ~400×200 px con fondo claro</li>
            </ul>

            {canEdit && (
              <div className="flex gap-2 pt-2 flex-wrap">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Seleccionar archivo
                </Button>
                {pendingFile && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => uploadMutation.mutate()}
                      disabled={uploadMutation.isPending}
                    >
                      {uploadMutation.isPending ? "Subiendo…" : "Guardar logo"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPendingFile(null); setPreviewUrl(null); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                    </Button>
                  </>
                )}
                {orgRow?.logo_url && !pendingFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMutation.mutate()}
                    disabled={removeMutation.isPending}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Quitar logo
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
