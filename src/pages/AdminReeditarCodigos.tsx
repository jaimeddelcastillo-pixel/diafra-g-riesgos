import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { getEstadoStyle } from "@/hooks/useFolios";

interface FolioRow {
  id: string;
  codigo: string;
  estado: string;
  created_at: string;
}

interface OrgRow {
  id: string;
  nombre: string;
  plan: string;
  folio_prefijo: string | null;
  folio_formato_periodo: string | null;
  folio_digitos_consecutivo: number | null;
}

export default function AdminReeditarCodigos() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState<string>("");
  const [filtro, setFiltro] = useState("");
  const [nuevos, setNuevos] = useState<Record<string, string>>({});
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmText, setConfirmText] = useState("");

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const { data: orgs = [] } = useQuery<OrgRow[]>({
    queryKey: ["admin-orgs-reedicion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nombre, plan, folio_prefijo, folio_formato_periodo, folio_digitos_consecutivo")
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as OrgRow[];
    },
  });

  const org = orgs.find((o) => o.id === orgId);

  const { data: folios = [], isLoading } = useQuery<FolioRow[]>({
    queryKey: ["admin-folios-reedicion", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folios")
        .select("id, codigo, estado, created_at")
        .eq("org_id", orgId)
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as FolioRow[];
    },
  });

  const { data: tipos = [] } = useQuery<{ codigo: string }[]>({
    queryKey: ["admin-tipos-reedicion", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_folio_tipos")
        .select("codigo")
        .eq("org_id", orgId)
        .eq("activo", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const editable = (estado: string) => estado === "Borrador";

  const visibles = useMemo(() => {
    const f = filtro.trim().toUpperCase();
    return f ? folios.filter((x) => x.codigo.toUpperCase().includes(f)) : folios;
  }, [folios, filtro]);

  /** Valida un código nuevo contra la configuración de la organización. */
  function validar(folio: FolioRow): string | null {
    const raw = (nuevos[folio.id] ?? "").trim().toUpperCase();
    if (!raw) return "Escribe el nuevo código.";
    if (raw === folio.codigo) return "El código es idéntico al actual.";
    if (!/^[A-Z0-9]+(-[A-Z0-9]+)+$/.test(raw)) return "Formato inválido (usa PREFIJO-GRUPO-PERIODO-CONSECUTIVO).";

    const parts = raw.split("-");
    if (parts.length < 3) return "Faltan bloques en el código.";

    const prefijo = (org?.folio_prefijo ?? "GR").toUpperCase();
    if (parts[0] !== prefijo) return `El prefijo debe ser ${prefijo}.`;

    if (tipos.length > 0 && !tipos.some((t) => t.codigo === parts[1])) {
      return `Grupo inválido o inactivo: ${parts[1]}.`;
    }

    const digitos = org?.folio_digitos_consecutivo ?? 3;
    const consec = parts[parts.length - 1];
    if (!new RegExp(`^\\d{${digitos}}$`).test(consec)) {
      return `El consecutivo debe tener ${digitos} dígitos.`;
    }

    // Duplicados contra folios existentes de la organización
    if (folios.some((f) => f.id !== folio.id && f.codigo.toUpperCase() === raw)) {
      return "Ya existe un folio con ese código en esta organización.";
    }
    // Duplicados dentro del lote
    const enLote = folios.filter(
      (f) => f.id !== folio.id && marcados[f.id] && (nuevos[f.id] ?? "").trim().toUpperCase() === raw,
    );
    if (enLote.length > 0) return "Código repetido en otra fila del lote.";

    return null;
  }

  const seleccionados = folios.filter((f) => marcados[f.id] && editable(f.estado));
  const errores = seleccionados
    .map((f) => ({ folio: f, error: validar(f) }))
    .filter((x) => x.error !== null);
  const puedeAplicar = seleccionados.length > 0 && errores.length === 0;

  const aplicarMutation = useMutation({
    mutationFn: async () => {
      const cambios = seleccionados.map((f) => ({
        folio_id: f.id,
        nuevo_codigo: (nuevos[f.id] ?? "").trim().toUpperCase(),
      }));
      const { data, error } = await supabase.functions.invoke("admin-reeditar-codigos", {
        body: { org_id: orgId, motivo: motivo.trim(), cambios },
      });
      if (error) {
        const msg = (data as any)?.error ?? error.message;
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { modificados: number };
    },
    onSuccess: (data) => {
      toast.success(`${data?.modificados ?? 0} folios corregidos y registrados en auditoría`);
      setDialogOpen(false);
      setConfirmText("");
      setMotivo("");
      setNuevos({});
      setMarcados({});
      queryClient.invalidateQueries({ queryKey: ["admin-folios-reedicion", orgId] });
      queryClient.invalidateQueries({ queryKey: ["folios"] });
    },
    onError: (e: Error) => toast.error(e.message || "No se pudieron aplicar los cambios"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Reedición de códigos de folio</h1>
          <p className="text-sm text-muted-foreground">
            Herramienta interna de corrección. Solo folios en Borrador; cada cambio queda registrado en auditoría.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Organización</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={orgId} onValueChange={(v) => { setOrgId(v); setNuevos({}); setMarcados({}); }}>
            <SelectTrigger className="sm:w-96">
              <SelectValue placeholder="Selecciona una organización" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nombre} — {o.plan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {orgId && (
            <div className="relative sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por código"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {orgId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              2. Folios ({visibles.length}) — {seleccionados.length} marcados para modificar
            </CardTitle>
            <Button
              disabled={!puedeAplicar}
              onClick={() => setDialogOpen(true)}
            >
              Aplicar cambios
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando folios…</p>
            ) : visibles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esta organización no tiene folios.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código actual</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nuevo código</TableHead>
                    <TableHead className="w-28 text-center">¿Modificar?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((f) => {
                    const puede = editable(f.estado);
                    const error = puede && marcados[f.id] ? validar(f) : null;
                    const preview = (nuevos[f.id] ?? "").trim().toUpperCase();
                    return (
                      <TableRow key={f.id} className={puede ? "" : "opacity-60"}>
                        <TableCell className="font-mono text-sm">{f.codigo}</TableCell>
                        <TableCell>
                          <Badge className={getEstadoStyle(f.estado)}>{f.estado}</Badge>
                        </TableCell>
                        <TableCell>
                          {puede ? (
                            <div className="space-y-1">
                              <Input
                                className="font-mono"
                                placeholder={f.codigo}
                                value={nuevos[f.id] ?? ""}
                                onChange={(e) =>
                                  setNuevos((p) => ({ ...p, [f.id]: e.target.value.toUpperCase() }))
                                }
                              />
                              {preview && !error && (
                                <p className="text-xs text-muted-foreground">
                                  Quedará como <span className="font-mono">{preview}</span>
                                </p>
                              )}
                              {error && <p className="text-xs text-destructive">{error}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No modificable</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            disabled={!puede}
                            checked={!!marcados[f.id]}
                            onCheckedChange={(v) =>
                              setMarcados((p) => ({ ...p, [f.id]: v === true }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar corrección de códigos</DialogTitle>
            <DialogDescription>
              Se modificarán {seleccionados.length} folios. Esta acción queda registrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 space-y-1 text-sm font-mono max-h-48 overflow-y-auto">
              {seleccionados.map((f) => (
                <div key={f.id}>
                  {f.codigo} → {(nuevos[f.id] ?? "").trim().toUpperCase()}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo de la corrección *</Label>
              <Textarea
                id="motivo"
                rows={3}
                placeholder="Ej. Corrección de codificación — cliente piloto en pruebas"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 10 caracteres. Se guarda en el audit trail junto con cada cambio.
              </p>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Los PDFs ya generados no se actualizan. Escribe <strong>CONFIRMAR</strong> para proceder.
              </AlertDescription>
            </Alert>

            <Input
              placeholder="CONFIRMAR"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                confirmText.trim() !== "CONFIRMAR" ||
                motivo.trim().length < 10 ||
                !puedeAplicar ||
                aplicarMutation.isPending
              }
              onClick={() => aplicarMutation.mutate()}
            >
              {aplicarMutation.isPending ? "Aplicando…" : "Aplicar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}