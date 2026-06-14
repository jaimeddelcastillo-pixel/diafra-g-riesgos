import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileDown, Search, XCircle } from "lucide-react";
import { getMotivoLabel } from "@/config/motivos-cancelacion";

interface FolioCanceladoRow {
  id: string;
  codigo: string;
  estado: string;
  proceso_equipo: string;
  org_id: string;
  cancelado_por: string | null;
  cancelado_en: string | null;
  motivo_cancelacion_codigo: string | null;
  motivo_cancelacion: string | null;
  created_at: string;
  organizations: { nombre: string | null } | null;
}

function exportarCSV(rows: FolioCanceladoRow[], nombres: Map<string, string>) {
  const headers = [
    "Codigo", "Estado", "Proceso", "Organizacion",
    "Cancelado por", "Fecha cancelacion", "Motivo (codigo)", "Motivo (descripcion)",
  ];
  const lines = rows.map((r) => [
    r.codigo,
    r.estado,
    (r.proceso_equipo || "").replace(/"/g, "'"),
    r.organizations?.nombre || "",
    r.cancelado_por ? (nombres.get(r.cancelado_por) || r.cancelado_por) : "",
    r.cancelado_en ? new Date(r.cancelado_en).toLocaleString("es-MX") : "",
    r.motivo_cancelacion_codigo || "",
    (r.motivo_cancelacion || "").replace(/"/g, "'"),
  ]);
  const bom = "\uFEFF";
  const csv =
    bom +
    [headers, ...lines]
      .map((row) => row.map((c) => `"${String(c ?? "")}"`).join(","))
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TRACEA_Folios_Cancelados_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminFoliosCancelados() {
  const { isSuperAdmin, hasRole, orgId } = useAuth();
  const [filtro, setFiltro] = useState("");

  const esAdminOrg = hasRole("admin") || hasRole("responsable_sanitario");
  const puedeVer = isSuperAdmin() || esAdminOrg;

  if (!puedeVer) return <Navigate to="/" replace />;

  const { data: rows = [], isLoading } = useQuery<FolioCanceladoRow[]>({
    queryKey: ["folios-cancelados", isSuperAdmin() ? "all" : orgId],
    enabled: isSuperAdmin() || !!orgId,
    queryFn: async () => {
      let q = supabase
        .from("folios")
        .select(
          "id, codigo, estado, proceso_equipo, org_id, cancelado_por, cancelado_en, motivo_cancelacion_codigo, motivo_cancelacion, created_at, organizations(nombre)",
        )
        .eq("estado", "Cancelado")
        .order("cancelado_en", { ascending: false });
      if (!isSuperAdmin() && orgId) q = q.eq("org_id", orgId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FolioCanceladoRow[];
    },
  });

  // Resolver nombres de usuarios (cancelado_por)
  const userIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.cancelado_por).filter(Boolean) as string[])),
    [rows],
  );
  const { data: nombres = new Map<string, string>() } = useQuery({
    queryKey: ["profiles-nombres", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nombre, email")
        .in("id", userIds);
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) =>
        m.set(p.id, p.nombre || p.email || p.id.slice(0, 8)),
      );
      return m;
    },
  });

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.codigo.toLowerCase().includes(q) ||
        r.proceso_equipo?.toLowerCase().includes(q) ||
        r.organizations?.nombre?.toLowerCase().includes(q) ||
        r.motivo_cancelacion?.toLowerCase().includes(q),
    );
  }, [rows, filtro]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <XCircle className="h-6 w-6 text-destructive" />
            Folios Cancelados
          </h1>
          <p className="text-sm text-muted-foreground">
            Trazabilidad COFEPRIS — todos los folios cancelados de
            {isSuperAdmin() ? " todas las organizaciones" : " tu organización"}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => exportarCSV(filtrados, nombres)}
          disabled={filtrados.length === 0}
        >
          <FileDown className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">
              Cancelados{" "}
              <span className="text-muted-foreground font-normal">({rows.length})</span>
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por código, proceso, motivo…"
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
              {rows.length === 0
                ? "No hay folios cancelados en el sistema."
                : "Sin coincidencias para la búsqueda."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    {isSuperAdmin() && <TableHead>Organización</TableHead>}
                    <TableHead>Proceso</TableHead>
                    <TableHead>Cancelado por</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-bold">{r.codigo}</TableCell>
                      {isSuperAdmin() && (
                        <TableCell className="text-sm">{r.organizations?.nombre ?? "—"}</TableCell>
                      )}
                      <TableCell className="text-sm max-w-[260px] truncate" title={r.proceso_equipo}>
                        {r.proceso_equipo}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.cancelado_por
                          ? nombres.get(r.cancelado_por) ?? r.cancelado_por.slice(0, 8)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.cancelado_en
                          ? new Date(r.cancelado_en).toLocaleDateString("es-MX")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="mr-2">
                          {getMotivoLabel(r.motivo_cancelacion_codigo)}
                        </Badge>
                        {r.motivo_cancelacion && (
                          <span className="text-muted-foreground">{r.motivo_cancelacion}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}