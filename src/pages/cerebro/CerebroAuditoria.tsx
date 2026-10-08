import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";

const TABLAS: Record<string, string> = {
  brain_knowledge_items: "Conocimiento",
  brain_knowledge_sources: "Fuente de conocimiento",
  brain_documents: "Documento",
  brain_areas: "Área",
  brain_processes: "Proceso",
  brain_process_areas: "Proceso ↔ Área",
  brain_import_batches: "Importación",
  brain_import_propuestas: "Propuesta de importación",
  brain_interview_sessions: "Entrevista",
  brain_interview_assignments: "Asignación de entrevista",
  brain_assignment_processes: "Asignación ↔ Proceso",
  brain_session_processes: "Entrevista ↔ Proceso",
  brain_contradictions: "Contradicción",
  brain_gaps: "Brecha",
  brain_memoria_viva: "Memoria viva",
  brain_exports: "Exportación",
};
const ACCIONES: Record<string, string> = { INSERT: "Alta", UPDATE: "Cambio", DELETE: "Baja" };
const IGNORAR = new Set(["updated_at"]);

type Fila = {
  id: string; created_at: string; user_id: string | null; tabla: string; registro_id: string | null;
  accion: string; valor_anterior: any; valor_nuevo: any;
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function cambios(f: Fila): string {
  if (f.accion !== "UPDATE") return "";
  const a = f.valor_anterior ?? {}, n = f.valor_nuevo ?? {};
  return Object.keys(n)
    .filter((k) => !IGNORAR.has(k) && JSON.stringify(a[k]) !== JSON.stringify(n[k]))
    .map((k) => `${k}: ${fmt(a[k])} → ${fmt(n[k])}`)
    .join("; ");
}

function etiquetaRegistro(f: Fila): string {
  const r = f.valor_nuevo ?? f.valor_anterior ?? {};
  return r.titulo ?? r.nombre ?? r.codigo ?? r.nombre_archivo ?? r.descripcion?.slice?.(0, 60) ?? f.registro_id ?? "—";
}

export default function CerebroAuditoria() {
  const { orgId, roles, isSuperAdmin } = useAuth();
  const permitido = isSuperAdmin() || roles.includes("admin" as any) || roles.includes("responsable_sanitario" as any);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState("");
  const [accion, setAccion] = useState("");
  const [persona, setPersona] = useState("");

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["cerebro-auditoria", orgId],
    enabled: permitido && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_trail")
        .select("id, created_at, user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo")
        .eq("org_id", orgId!)
        .like("tabla", "brain\\_%")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Fila[];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    filas.forEach((f) => {
      const r = f.valor_nuevo ?? f.valor_anterior ?? {};
      [f.user_id, r?.contexto?.capturado_por, r.imported_by, r.generado_por].forEach((x) => x && s.add(x));
    });
    return [...s];
  }, [filas]);

  const { data: perfiles = {} } = useQuery({
    queryKey: ["cerebro-auditoria-perfiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nombre, email").in("id", userIds);
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => (m[p.id] = p.nombre || p.email || p.id));
      return m;
    },
  });

  const filasVista = useMemo(() => {
    return filas
      .map((f) => {
        const r = f.valor_nuevo ?? f.valor_anterior ?? {};
        const uid = f.user_id ?? r?.contexto?.capturado_por ?? r.imported_by ?? r.generado_por ?? null;
        return {
          f,
          fecha: new Date(f.created_at),
          persona: uid ? (perfiles as any)[uid] ?? uid : "Sistema (IA / importación)",
          accion: ACCIONES[f.accion] ?? f.accion,
          que: TABLAS[f.tabla] ?? f.tabla,
          registro: String(etiquetaRegistro(f)),
          cambios: cambios(f),
        };
      })
      .filter((v) => {
        if (desde && v.fecha < new Date(desde + "T00:00:00")) return false;
        if (hasta && v.fecha > new Date(hasta + "T23:59:59")) return false;
        if (tipo && v.f.tabla !== tipo) return false;
        if (accion && v.f.accion !== accion) return false;
        if (persona && !v.persona.toLowerCase().includes(persona.toLowerCase())) return false;
        return true;
      });
  }, [filas, perfiles, desde, hasta, tipo, accion, persona]);

  const exportarCSV = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lineas = [
      ["Fecha/hora", "Persona", "Acción", "Qué", "Registro", "Cambios"].map(esc).join(","),
      ...filasVista.map((v) =>
        [v.fecha.toLocaleString("es-MX"), v.persona, v.accion, v.que, v.registro, v.cambios].map(esc).join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lineas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cerebro_auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <CerebroPage
      titulo="Auditoría"
      descripcion="Bitácora de solo lectura de todos los cambios en el Cerebro Institucional."
      acciones={
        permitido && (
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={filasVista.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        )
      }
    >
      {!permitido ? (
        <CerebroVacio mensaje="La auditoría está disponible solo para administradores y el responsable sanitario." />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3 items-end">
              <label className="text-xs space-y-1">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
              <label className="text-xs space-y-1">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
              <label className="text-xs space-y-1 flex flex-col">Tipo de registro
                <select className={selectCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="text-xs space-y-1 flex flex-col">Acción
                <select className={selectCls} value={accion} onChange={(e) => setAccion(e.target.value)}>
                  <option value="">Todas</option>
                  {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="text-xs space-y-1">Persona<Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Nombre" /></label>
            </CardContent>
          </Card>

          {isLoading ? (
            <CerebroVacio mensaje="Cargando…" />
          ) : filasVista.length === 0 ? (
            <CerebroVacio mensaje="No hay registros con estos filtros." />
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      {["Fecha/hora", "Persona", "Acción", "Qué", "Registro", "Cambios"].map((h) => (
                        <th key={h} className="text-left p-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasVista.map((v) => (
                      <tr key={v.f.id} className="border-t align-top">
                        <td className="p-2 whitespace-nowrap">{v.fecha.toLocaleString("es-MX")}</td>
                        <td className="p-2">{v.persona}</td>
                        <td className="p-2">{v.accion}</td>
                        <td className="p-2">{v.que}</td>
                        <td className="p-2 max-w-[220px] truncate" title={v.registro}>{v.registro}</td>
                        <td className="p-2 text-xs text-muted-foreground break-words max-w-[420px]">{v.cambios}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </CerebroPage>
  );
}
