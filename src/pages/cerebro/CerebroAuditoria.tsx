import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { nombresPersonas } from "@/lib/nombresPersonas";
import { useProfiles } from "@/hooks/useProfiles";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CerebroPage, CerebroVacio } from "@/components/cerebro/CerebroPage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Download } from "lucide-react";

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

const PAGE = 100;
const MAX_EXPORT = 50000;
const SISTEMA = "Sistema (IA / importación)";
const COLS = "id, created_at, user_id, tabla, registro_id, accion, valor_anterior, valor_nuevo";

type Filtros = { desde: string; hasta: string; tipo: string; accion: string; persona: string };

function aplicarFiltros(q: any, orgId: string, f: Filtros) {
  q = q.eq("org_id", orgId).like("tabla", "brain\\_%");
  if (f.desde) q = q.gte("created_at", new Date(f.desde + "T00:00:00").toISOString());
  if (f.hasta) q = q.lte("created_at", new Date(f.hasta + "T23:59:59.999").toISOString());
  if (f.tipo) q = q.eq("tabla", f.tipo);
  if (f.accion) q = q.eq("accion", f.accion);
  if (f.persona) q = q.eq("user_id", f.persona);
  return q.order("created_at", { ascending: false }).order("id", { ascending: false });
}

/** Persona responsable sin atribuir nunca a alguien algo que no hizo. */
function responsable(f: Fila, perfiles: Record<string, string>): { texto: string; sistema: boolean } {
  if (f.user_id) return { texto: perfiles[f.user_id] ?? f.user_id, sistema: false };
  if (f.accion === "INSERT") {
    const r = f.valor_nuevo ?? {};
    const uid = r?.contexto?.capturado_por ?? r.imported_by ?? r.generado_por ?? null;
    if (uid) return { texto: `${SISTEMA}, a solicitud de ${perfiles[uid] ?? uid}`, sistema: true };
  }
  return { texto: SISTEMA, sistema: true };
}

function idsDePersonas(filas: Fila[]): string[] {
  const s = new Set<string>();
  filas.forEach((f) => {
    if (f.user_id) s.add(f.user_id);
    else if (f.accion === "INSERT") {
      const r = f.valor_nuevo ?? {};
      [r?.contexto?.capturado_por, r.imported_by, r.generado_por].forEach((x) => typeof x === "string" && s.add(x));
    }
  });
  return [...s];
}

async function cargarPerfiles(ids: string[]): Promise<Record<string, string>> {
  // C2b-F: incluye personas desactivadas que aparecen en la bitácora de la empresa.
  return nombresPersonas(ids);
}

export default function CerebroAuditoria() {
  const { orgId, org, roles, isSuperAdmin, profile, user } = useAuth();
  const permitido = isSuperAdmin() || roles.includes("admin" as any) || roles.includes("responsable_sanitario" as any);
  const { data: miembrosActuales = [] } = useProfiles();
  // Filtro de persona: miembros actuales + todas las personas de los eventos de la empresa.
  const { data: miembros = [] } = useQuery({
    queryKey: ["cerebro-auditoria-personas", orgId, (miembrosActuales as any[]).length],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("audit_trail").select("user_id")
        .eq("org_id", orgId!).like("tabla", "brain_%").not("user_id", "is", null).limit(10000);
      const ids = new Set<string>((miembrosActuales as any[]).map((m) => m.id));
      (data ?? []).forEach((r: any) => r.user_id && ids.add(r.user_id));
      const nombres = await nombresPersonas([...ids]);
      (miembrosActuales as any[]).forEach((m) => { if (!nombres[m.id]) nombres[m.id] = m.nombre; });
      return [...ids].map((id) => ({ id, nombre: nombres[id] ?? id }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
  });

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState("");
  const [accion, setAccion] = useState("");
  const [persona, setPersona] = useState("");
  const [exportando, setExportando] = useState(false);
  const filtros: Filtros = { desde, hasta, tipo, accion, persona };

  const q = useInfiniteQuery({
    queryKey: ["cerebro-auditoria", orgId, filtros],
    enabled: permitido && !!orgId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error, count } = await aplicarFiltros(
        supabase.from("audit_trail").select(COLS, { count: "exact" }), orgId!, filtros,
      ).range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return { filas: (data ?? []) as Fila[], count: count ?? 0, next: pageParam + PAGE };
    },
    getNextPageParam: (last) => (last.next < last.count ? last.next : undefined),
  });
  const filas = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.filas), [q.data]);
  const total = q.data?.pages[0]?.count ?? 0;

  const userIds = useMemo(() => idsDePersonas(filas), [filas]);
  const { data: perfiles = {} } = useQuery({
    queryKey: ["cerebro-auditoria-perfiles", userIds],
    enabled: userIds.length > 0,
    queryFn: () => cargarPerfiles(userIds),
  });

  const vista = (f: Fila, p: Record<string, string>) => {
    const resp = responsable(f, p);
    return {
      f, fecha: new Date(f.created_at), persona: resp.texto, sistema: resp.sistema,
      accion: ACCIONES[f.accion] ?? f.accion, que: TABLAS[f.tabla] ?? f.tabla,
      registro: String(etiquetaRegistro(f)), cambios: cambios(f),
    };
  };
  const filasVista = useMemo(() => filas.map((f) => vista(f, perfiles as Record<string, string>)), [filas, perfiles]);

  const exportarCSV = async () => {
    if (!orgId) return;
    if (total > MAX_EXPORT) {
      toast.error(`El filtro devuelve ${total.toLocaleString("es-MX")} eventos. El máximo para exportar es ${MAX_EXPORT.toLocaleString("es-MX")}; acota el filtro.`);
      return;
    }
    setExportando(true);
    try {
      const todas: Fila[] = [];
      for (let from = 0; from < MAX_EXPORT; from += 1000) {
        const { data, error } = await aplicarFiltros(supabase.from("audit_trail").select(COLS), orgId, filtros)
          .range(from, from + 999);
        if (error) throw error;
        todas.push(...((data ?? []) as Fila[]));
        if (!data || data.length < 1000) break;
      }
      const p = await cargarPerfiles(idsDePersonas(todas));
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const nombrePersona = persona ? (miembros as any[]).find((m) => m.id === persona)?.nombre ?? persona : "Todas";
      const desc = [
        `Desde: ${desde || "—"}`, `Hasta: ${hasta || "—"}`,
        `Tipo: ${tipo ? TABLAS[tipo] ?? tipo : "Todos"}`, `Acción: ${accion ? ACCIONES[accion] : "Todas"}`,
        `Persona: ${nombrePersona}`,
      ].join("; ");
      const lineas = [
        [
          `Organización: ${org?.nombre ?? orgId}`, `Filtros: ${desc}`,
          `Exportado: ${new Date().toLocaleString("es-MX")}`,
          `Exportado por: ${profile?.nombre ?? user?.email ?? ""}`, `Total: ${todas.length}`,
        ].map(esc).join(","),
        ["Fecha/hora", "Persona", "Acción", "Qué", "Registro", "Cambios"].map(esc).join(","),
        ...todas.map((f) => vista(f, p)).map((v) =>
          [v.fecha.toLocaleString("es-MX"), v.persona, v.accion, v.que, v.registro, v.cambios].map(esc).join(","),
        ),
      ];
      const blob = new Blob(["\uFEFF" + lineas.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cerebro_auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  };

  const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <CerebroPage
      titulo="Auditoría"
      descripcion="Bitácora de solo lectura de todos los cambios en el Cerebro Institucional."
      acciones={
        permitido && (
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={total === 0 || exportando}>
            <Download className="h-4 w-4 mr-1" /> {exportando ? "Exportando…" : "Exportar CSV"}
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
              <label className="text-xs space-y-1 flex flex-col">Persona
                <select className={selectCls} value={persona} onChange={(e) => setPersona(e.target.value)}>
                  <option value="">Todas</option>
                  {(miembros as any[]).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </label>
            </CardContent>
          </Card>

          {q.isLoading ? (
            <CerebroVacio mensaje="Cargando…" />
          ) : filasVista.length === 0 ? (
            <CerebroVacio mensaje="No hay registros con estos filtros." />
          ) : (
            <>
            <p className="text-xs text-muted-foreground">Mostrando {filasVista.length.toLocaleString("es-MX")} de {total.toLocaleString("es-MX")} eventos</p>
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
                        <td className="p-2">{v.sistema ? (
                          <span className="inline-flex items-center gap-1"><Badge variant="secondary" className="gap-1 text-[10px]"><Bot className="h-3 w-3" />Sistema</Badge><span className="text-xs text-muted-foreground">{v.persona.replace(SISTEMA, "IA / importación")}</span></span>
                        ) : v.persona}</td>
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
            {q.hasNextPage && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                  {q.isFetchingNextPage ? "Cargando…" : "Cargar más"}
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      )}
    </CerebroPage>
  );
}
