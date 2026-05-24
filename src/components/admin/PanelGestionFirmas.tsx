import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PenLine, Loader2, ShieldAlert } from "lucide-react";

interface FolioFirmas {
  id: string;
  codigo: string;
  estado: string;
  numero_version: string;
  firmas_activas: number;
  total_miembros: number;
}

const estadoColor: Record<string, string> = {
  Borrador: "bg-muted text-muted-foreground",
  "En Firma": "bg-amber-100 text-amber-800",
  Aprobado: "bg-green-100 text-green-800",
  Cerrado: "bg-slate-200 text-slate-700",
};

export default function PanelGestionFirmas({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [soloConFirmas, setSoloConFirmas] = useState(true);
  const [confirmando, setConfirmando] = useState<FolioFirmas | null>(null);
  const [reseteandoId, setReseteandoId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FolioFirmas[]>({
    queryKey: ["admin-firmas", orgId],
    queryFn: async () => {
      const { data: folios, error } = await supabase
        .from("folios")
        .select("id, codigo, estado, numero_version")
        .eq("org_id", orgId)
        .order("codigo", { ascending: false });
      if (error) throw error;
      if (!folios?.length) return [];

      const ids = folios.map((f) => f.id);
      const { data: comite } = await supabase
        .from("folio_comite")
        .select("folio_id, firmado")
        .in("folio_id", ids);

      const map = new Map<string, { activas: number; total: number }>();
      for (const c of comite ?? []) {
        const cur = map.get(c.folio_id) ?? { activas: 0, total: 0 };
        cur.total += 1;
        if (c.firmado) cur.activas += 1;
        map.set(c.folio_id, cur);
      }

      return folios.map((f) => ({
        ...f,
        firmas_activas: map.get(f.id)?.activas ?? 0,
        total_miembros: map.get(f.id)?.total ?? 0,
      }));
    },
  });

  const visibles = (data ?? []).filter((f) => (soloConFirmas ? f.firmas_activas > 0 : true));

  async function ejecutarReset(folio: FolioFirmas) {
    setReseteandoId(folio.id);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-reset-firmas", {
        body: { folio_id: folio.id },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      toast({
        title: "Firmas reseteadas",
        description: `${(res as any)?.firmas_reseteadas ?? 0} firma(s) del folio ${folio.codigo}.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-firmas", orgId] });
    } catch (e: any) {
      toast({
        title: "Error al resetear firmas",
        description: e?.message ?? "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setReseteandoId(null);
      setConfirmando(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            <PenLine className="h-4 w-4" /> Gestión de firmas
          </CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={soloConFirmas} onCheckedChange={setSoloConFirmas} />
            Sólo folios con firmas
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-muted rounded" />
            ))}
          </div>
        ) : !visibles.length ? (
          <p className="text-sm text-muted-foreground">
            {soloConFirmas
              ? "No hay folios con firmas activas."
              : "Sin folios en esta organización."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Folio</th>
                  <th className="text-left pb-2 font-medium">Estado</th>
                  <th className="text-left pb-2 font-medium">Ver.</th>
                  <th className="text-left pb-2 font-medium">Firmas</th>
                  <th className="text-right pb-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{f.codigo}</td>
                    <td className="py-2">
                      <Badge className={`text-[10px] ${estadoColor[f.estado] ?? ""}`} variant="outline">
                        {f.estado}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{f.numero_version}</td>
                    <td className="py-2 text-xs">
                      <span
                        className={
                          f.firmas_activas > 0 && f.estado === "Borrador"
                            ? "text-amber-600 font-semibold"
                            : ""
                        }
                      >
                        {f.firmas_activas} / {f.total_miembros}
                      </span>
                      {f.firmas_activas > 0 && f.estado === "Borrador" && (
                        <span className="ml-1 text-[10px] text-amber-600">⚠ inconsistente</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={f.firmas_activas === 0 || reseteandoId === f.id}
                        onClick={() => setConfirmando(f)}
                      >
                        {reseteandoId === f.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Resetear firmas"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmando} onOpenChange={(open) => !open && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Resetear firmas del folio
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción resetea todas las firmas del folio{" "}
              <span className="font-mono font-semibold">{confirmando?.codigo}</span>. Los datos del
              análisis (riesgos, alcance, comité) no se modifican. Quedará registro en el audit
              trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!reseteandoId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!reseteandoId}
              onClick={(e) => {
                e.preventDefault();
                if (confirmando) ejecutarReset(confirmando);
              }}
            >
              {reseteandoId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resetear firmas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}