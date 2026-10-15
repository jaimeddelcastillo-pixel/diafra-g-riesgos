import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Layers, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrgTiposFolio, type OrgFolioTipo } from "@/hooks/useOrgTiposFolio";
import { toast } from "sonner";

export function OrgTiposFolioCard() {
  const { orgId, hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("responsable_sanitario");
  const queryClient = useQueryClient();
  const { data: tipos = [], isLoading } = useOrgTiposFolio(false);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [pendiente, setPendiente] = useState<{ tipo: OrgFolioTipo; folios: number } | null>(null);

  // Conteo de folios por tipo, para advertir al desactivar
  const { data: conteos = {} } = useQuery({
    queryKey: ["org-folio-tipos-conteo", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folios")
        .select("tipo_folio")
        .eq("org_id", orgId!);
      if (error) throw error;
      const acc: Record<string, number> = {};
      (data ?? []).forEach((f: any) => {
        if (f.tipo_folio) acc[f.tipo_folio] = (acc[f.tipo_folio] ?? 0) + 1;
      });
      return acc;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["org-folio-tipos"] });
    queryClient.invalidateQueries({ queryKey: ["org-folio-tipos-conteo", orgId] });
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("org_folio_tipos").update({ activo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Grupo actualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message || "No se pudo actualizar"),
  });

  const crearMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sin organización");
      const cod = codigo.trim().toUpperCase();
      if (!/^[A-Z0-9]{2,4}$/.test(cod)) throw new Error("El código debe tener 2 a 4 caracteres (A–Z, 0–9)");
      if (!nombre.trim()) throw new Error("El nombre es obligatorio");
      if (tipos.some((t) => t.codigo === cod)) throw new Error(`Ya existe el grupo ${cod}`);
      const { error } = await supabase.from("org_folio_tipos").insert({
        org_id: orgId,
        codigo: cod,
        nombre: nombre.trim(),
        es_personalizado: true,
        orden: (tipos.at(-1)?.orden ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo creado");
      setCodigo(""); setNombre("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || "No se pudo crear"),
  });

  const borrarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_folio_tipos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Grupo eliminado"); invalidate(); },
    onError: (e: any) => toast.error(e.message || "No se pudo eliminar"),
  });

  const pedirToggle = (tipo: OrgFolioTipo) => {
    const n = conteos[tipo.codigo] ?? 0;
    if (tipo.activo && n > 0) {
      setPendiente({ tipo, folios: n });
      return;
    }
    toggleMutation.mutate({ id: tipo.id, activo: !tipo.activo });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" /> Tipos de folio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Los grupos definen el segundo bloque del código (por ejemplo{" "}
          <span className="font-mono">GR-<b>FAB</b>-2026-001</span>). Puedes desactivar los que no
          uses y crear grupos propios de tu sistema de calidad.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-32">Origen</TableHead>
                  <TableHead className="w-20 text-center">Folios</TableHead>
                  <TableHead className="w-24 text-center">Activo</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipos.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs font-semibold">{t.codigo}</TableCell>
                    <TableCell className="text-sm">{t.nombre}</TableCell>
                    <TableCell>
                      <Badge variant={t.es_personalizado ? "secondary" : "outline"} className="text-[10px]">
                        {t.es_personalizado ? "Personalizado" : "TRACEA"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs">{conteos[t.codigo] ?? 0}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={t.activo}
                        disabled={!canEdit || toggleMutation.isPending}
                        onCheckedChange={() => pedirToggle(t)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && t.es_personalizado && (conteos[t.codigo] ?? 0) === 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => borrarMutation.mutate(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end border-t pt-4">
            <div className="space-y-1 sm:w-28">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Código</label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                placeholder="LIM"
                className="font-mono"
              />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Nombre del grupo</label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Limpieza y Sanitización"
                maxLength={80}
              />
            </div>
            <Button
              size="sm"
              className="gap-1"
              disabled={!codigo || !nombre.trim() || crearMutation.isPending}
              onClick={() => crearMutation.mutate()}
            >
              <Plus className="h-3.5 w-3.5" /> Agregar grupo
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!pendiente} onOpenChange={(o) => !o && setPendiente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar grupo {pendiente?.tipo.codigo}</AlertDialogTitle>
            <AlertDialogDescription>
              Este grupo tiene {pendiente?.folios} folios asociados. Al desactivarlo no podrás crear
              nuevos folios de este tipo, pero los folios existentes se conservan intactos.
              ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendiente) toggleMutation.mutate({ id: pendiente.tipo.id, activo: false });
                setPendiente(null);
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}