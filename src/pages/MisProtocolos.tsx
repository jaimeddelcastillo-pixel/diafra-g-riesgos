import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText, Loader2, Lock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Archivo {
  id: string;
  nombre: string;
  descripcion: string;
  mime_type: string | null;
  size_bytes: number | null;
  orden: number;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconForMime(mime: string | null): string {
  if (!mime) return "📄";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("word") || mime.includes("officedocument")) return "📘";
  return "📄";
}

export default function MisProtocolos() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Verificar compra
  const { data: tienCompra, isLoading: loadingCompra } = useQuery({
    queryKey: ["addon-purchase-protocolos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: member } = await supabase
        .from("org_members").select("org_id").eq("user_id", user!.id).maybeSingle();
      if (!member?.org_id) return false;
      const { data } = await supabase
        .from("addon_purchases")
        .select("id")
        .eq("org_id", member.org_id)
        .eq("producto", "protocolos")
        .maybeSingle();
      return !!data;
    },
  });

  const { data: archivos, isLoading: loadingArchivos } = useQuery<Archivo[]>({
    queryKey: ["addon-archivos-protocolos"],
    enabled: !!tienCompra,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_archivos")
        .select("id, nombre, descripcion, mime_type, size_bytes, orden")
        .eq("producto", "protocolos")
        .eq("activo", true)
        .order("orden", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (archivo_id: string) => {
      const { data, error } = await supabase.functions.invoke("addon-archivo-url", {
        body: { archivo_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string };
    },
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
    },
    onError: (e: any) => toast.error(e.message || "No se pudo descargar"),
  });

  if (loadingCompra) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tienCompra) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Protocolos de Validación DQ/IQ/OQ/PQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tu organización aún no ha adquirido este paquete. Incluye los 8 protocolos
              de calificación (DQ, IQ, OQ, PQ) más glosario técnico, listos para ejecutar
              conforme a NOM-241 / NOM-059 y expediente maestro COFEPRIS.
            </p>
            <Button onClick={() => navigate("/precios")} className="gap-2">
              <ShoppingBag className="h-4 w-4" /> Ver paquete y comprar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Mis Protocolos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Protocolos de Validación DQ/IQ/OQ/PQ y glosario técnico — disponibles para tu organización.
          </p>
        </div>
        <Badge variant="secondary">Acceso permanente</Badge>
      </div>

      {loadingArchivos ? (
        <Card><CardContent className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>
      ) : !archivos || archivos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Los archivos se están preparando. Si esto persiste, contacta a{" "}
            <a href="mailto:soporte@tracea.com.mx" className="text-primary underline">
              soporte@tracea.com.mx
            </a>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {archivos.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-3xl">{iconForMime(a.mime_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.nombre}</p>
                  {a.descripcion && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {a.descripcion}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatSize(a.size_bytes)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloadMutation.isPending && downloadMutation.variables === a.id}
                  onClick={() => downloadMutation.mutate(a.id)}
                  className="gap-2 flex-shrink-0"
                >
                  {downloadMutation.isPending && downloadMutation.variables === a.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  Descargar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Las descargas se generan con enlaces firmados de un solo uso, válidos por 60 minutos.
      </p>
    </div>
  );
}