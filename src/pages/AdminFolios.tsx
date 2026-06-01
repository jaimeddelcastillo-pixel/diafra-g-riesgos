import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Search } from "lucide-react";
import { toast } from "sonner";
import {
  getTiposDisponibles, type TipoFolioInfo, type TipoFolioKey,
} from "@/config/tipos-folio";

interface FolioHistorico {
  id: string;
  codigo: string;
  org_id: string;
  norma_folio: string;
  estado: string;
  created_at: string;
  organizations: { nombre: string; norma_aplicable: string } | null;
}

export default function AdminFolios() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [seleccion, setSeleccion] = useState<Record<string, TipoFolioKey | "">>({});

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const { data: folios = [], isLoading } = useQuery<FolioHistorico[]>({
    queryKey: ["admin-folios-historicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folios")
        .select("id, codigo, org_id, norma_folio, estado, created_at, organizations(nombre, norma_aplicable)")
        .is("tipo_folio", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FolioHistorico[];
    },
  });

  const asignarMutation = useMutation({
    mutationFn: async ({ folio_id, tipo }: { folio_id: string; tipo: TipoFolioKey }) => {
      const { data, error } = await supabase.functions.invoke("admin-asignar-tipo-folio", {
        body: { folio_id, tipo },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_data, vars) => {
      toast.success("Tipo asignado al folio");
      setSeleccion((s) => {
        const cp = { ...s };
        delete cp[vars.folio_id];
        return cp;
      });
      queryClient.invalidateQueries({ queryKey: ["admin-folios-historicos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo asignar"),
  });

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return folios;
    return folios.filter(
      (f) =>
        f.codigo.toLowerCase().includes(q) ||
        f.organizations?.nombre?.toLowerCase().includes(q),
    );
  }, [folios, filtro]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Gestión de Folios
          </h1>
          <p className="text-sm text-muted-foreground">
            Asigna un tipo de análisis a folios históricos (formato GR-AAAA-NNN).
            El código original nunca se modifica.
          </p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1 border-primary/40 text-primary">
          Super Admin
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">
              Folios sin tipo{" "}
              <span className="text-muted-foreground font-normal">({folios.length})</span>
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por código u organización…"
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
          ) : filtrados.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {folios.length === 0
                ? "No hay folios históricos sin tipo. Todo está clasificado."
                : "Sin coincidencias para la búsqueda."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Organización</TableHead>
                    <TableHead>Norma</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="min-w-[220px]">Tipo a asignar</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((f) => {
                    const norma = f.organizations?.norma_aplicable ?? f.norma_folio;
                    const opciones: TipoFolioInfo[] = getTiposDisponibles(norma);
                    const valor = seleccion[f.id] ?? "";
                    const enviando =
                      asignarMutation.isPending &&
                      (asignarMutation.variables as any)?.folio_id === f.id;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-xs">{f.codigo}</TableCell>
                        <TableCell className="text-sm">
                          {f.organizations?.nombre ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{norma}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{f.estado}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={valor}
                            onValueChange={(v) =>
                              setSeleccion((s) => ({ ...s, [f.id]: v as TipoFolioKey }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecciona tipo…" />
                            </SelectTrigger>
                            <SelectContent>
                              {opciones.map((op) => (
                                <SelectItem key={op.key} value={op.key}>
                                  {op.short} — {op.descripcion}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={!valor || enviando}
                            onClick={() =>
                              asignarMutation.mutate({
                                folio_id: f.id,
                                tipo: valor as TipoFolioKey,
                              })
                            }
                          >
                            {enviando ? "Asignando…" : "Asignar tipo"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}