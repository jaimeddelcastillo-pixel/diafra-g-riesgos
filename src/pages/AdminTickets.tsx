import { useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  Ticket as TicketIcon,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Building2,
  ArrowRight,
} from "lucide-react";

interface TicketRow {
  id: string;
  codigo: string;
  asunto: string;
  categoria: string;
  prioridad: string;
  estado: string;
  org_id: string;
  created_by_nombre: string;
  created_by_email: string;
  created_at: string;
  primera_respuesta_at: string | null;
  resuelto_at: string | null;
  cerrado_at: string | null;
  sla_respuesta_at: string;
  sla_resolucion_at: string;
  organizations?: { nombre: string; slug: string } | null;
}

const prioridadColor: Record<string, string> = {
  Crítica: "bg-red-100 text-red-700 border-red-200",
  Alta: "bg-orange-100 text-orange-700 border-orange-200",
  Normal: "bg-blue-100 text-blue-700 border-blue-200",
  Baja: "bg-slate-100 text-slate-600 border-slate-200",
};

const estadoColor: Record<string, string> = {
  Abierto: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "En Atención": "bg-blue-100 text-blue-700 border-blue-200",
  "Esperando Cliente": "bg-purple-100 text-purple-700 border-purple-200",
  Resuelto: "bg-green-100 text-green-700 border-green-200",
  Cerrado: "bg-slate-100 text-slate-600 border-slate-200",
};

function tiempoRestante(iso: string): { texto: string; vencido: boolean; porVencer: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  const vencido = ms < 0;
  const abs = Math.abs(ms);
  const hrs = Math.floor(abs / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const txt = hrs >= 24
    ? `${Math.floor(hrs / 24)}d ${hrs % 24}h`
    : hrs >= 1
      ? `${hrs}h ${mins}m`
      : `${mins}m`;
  return {
    texto: vencido ? `Vencido hace ${txt}` : `${txt} restantes`,
    vencido,
    porVencer: !vencido && ms < 2 * 3_600_000,
  };
}

export default function AdminTickets() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [filtroOrg, setFiltroOrg] = useState<string>("all");
  const [filtroEstado, setFiltroEstado] = useState<string>("activos");
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("all");
  const [filtroSLA, setFiltroSLA] = useState<string>("all");
  const [busqueda, setBusqueda] = useState("");

  const { data: tickets = [], isLoading } = useQuery<TicketRow[]>({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, organizations(nombre, slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
    staleTime: 30_000,
  });

  const orgs = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((t) => {
      if (t.organizations?.nombre) map.set(t.org_id, t.organizations.nombre);
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [tickets]);

  const filtrados = useMemo(() => {
    return tickets.filter((t) => {
      if (filtroOrg !== "all" && t.org_id !== filtroOrg) return false;
      if (filtroEstado === "activos") {
        if (t.estado === "Cerrado") return false;
      } else if (filtroEstado !== "all" && t.estado !== filtroEstado) {
        return false;
      }
      if (filtroPrioridad !== "all" && t.prioridad !== filtroPrioridad) return false;
      if (filtroSLA !== "all") {
        const slaTarget = t.primera_respuesta_at ? t.sla_resolucion_at : t.sla_respuesta_at;
        const r = tiempoRestante(slaTarget);
        const cerradoOResuelto = t.estado === "Cerrado" || t.estado === "Resuelto";
        if (filtroSLA === "vencido" && !(r.vencido && !cerradoOResuelto)) return false;
        if (filtroSLA === "porvencer" && !(r.porVencer && !cerradoOResuelto)) return false;
        if (filtroSLA === "entiempo" && (r.vencido || cerradoOResuelto)) return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        if (!t.codigo.toLowerCase().includes(q)
          && !t.asunto.toLowerCase().includes(q)
          && !(t.organizations?.nombre ?? "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, filtroOrg, filtroEstado, filtroPrioridad, filtroSLA, busqueda]);

  // KPIs (sobre todos, no filtrados)
  const kpis = useMemo(() => {
    const abiertos = tickets.filter((t) => t.estado !== "Cerrado" && t.estado !== "Resuelto").length;
    let vencidos = 0;
    let respMs = 0;
    let respCount = 0;
    let resolMs = 0;
    let resolCount = 0;
    tickets.forEach((t) => {
      if (t.estado === "Cerrado" || t.estado === "Resuelto") return;
      const target = t.primera_respuesta_at ? t.sla_resolucion_at : t.sla_respuesta_at;
      if (new Date(target).getTime() < Date.now()) vencidos++;
    });
    tickets.forEach((t) => {
      if (t.primera_respuesta_at) {
        respMs += new Date(t.primera_respuesta_at).getTime() - new Date(t.created_at).getTime();
        respCount++;
      }
      if (t.resuelto_at) {
        resolMs += new Date(t.resuelto_at).getTime() - new Date(t.created_at).getTime();
        resolCount++;
      }
    });
    const avgRespHrs = respCount ? respMs / respCount / 3_600_000 : 0;
    const avgResolHrs = resolCount ? resolMs / resolCount / 3_600_000 : 0;
    return { abiertos, vencidos, avgRespHrs, avgResolHrs };
  }, [tickets]);

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-primary" />
            Tickets — Vista global
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión centralizada de soporte para todas las organizaciones.
          </p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1 border-primary/40 text-primary">
          Super Admin
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Tickets abiertos</p>
                <p className="text-3xl font-bold mt-1">{kpis.abiertos}</p>
              </div>
              <div className="h-11 w-11 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                <TicketIcon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={kpis.vencidos > 0 ? "border-red-200" : ""}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">SLA vencidos</p>
                <p className={`text-3xl font-bold mt-1 ${kpis.vencidos > 0 ? "text-red-600" : ""}`}>{kpis.vencidos}</p>
              </div>
              <div className="h-11 w-11 rounded-full flex items-center justify-center bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Tiempo prom. 1ª respuesta</p>
                <p className="text-3xl font-bold mt-1">
                  {kpis.avgRespHrs > 0 ? `${kpis.avgRespHrs.toFixed(1)}h` : "—"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full flex items-center justify-center bg-amber-50 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Tiempo prom. resolución</p>
                <p className="text-3xl font-bold mt-1">
                  {kpis.avgResolHrs > 0 ? `${kpis.avgResolHrs.toFixed(1)}h` : "—"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full flex items-center justify-center bg-green-50 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por código, asunto u organización…"
                className="pl-8 h-9"
              />
            </div>
            <Select value={filtroOrg} onValueChange={setFiltroOrg}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Organización" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las organizaciones</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activos">Activos (sin cerrar)</SelectItem>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="Abierto">Abierto</SelectItem>
                <SelectItem value="En Atención">En Atención</SelectItem>
                <SelectItem value="Esperando Cliente">Esperando Cliente</SelectItem>
                <SelectItem value="Resuelto">Resuelto</SelectItem>
                <SelectItem value="Cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Prioridad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                <SelectItem value="Crítica">Crítica</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={filtroSLA === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFiltroSLA("all")}
            >Todo SLA</Button>
            <Button
              variant={filtroSLA === "vencido" ? "destructive" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFiltroSLA("vencido")}
            >SLA vencido</Button>
            <Button
              variant={filtroSLA === "porvencer" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFiltroSLA("porvencer")}
            >Por vencer (&lt;2h)</Button>
            <Button
              variant={filtroSLA === "entiempo" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFiltroSLA("entiempo")}
            >En tiempo</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Tickets ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-muted/30 rounded" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay tickets con los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Folio</th>
                    <th className="text-left pb-2 font-medium">Organización</th>
                    <th className="text-left pb-2 font-medium">Asunto</th>
                    <th className="text-left pb-2 font-medium">Prioridad</th>
                    <th className="text-left pb-2 font-medium">Estado</th>
                    <th className="text-left pb-2 font-medium">SLA</th>
                    <th className="text-left pb-2 font-medium">Creado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((t) => {
                    const cerrado = t.estado === "Cerrado" || t.estado === "Resuelto";
                    const slaTarget = t.primera_respuesta_at ? t.sla_resolucion_at : t.sla_respuesta_at;
                    const slaTipo = t.primera_respuesta_at ? "Resol." : "1ª resp.";
                    const r = tiempoRestante(slaTarget);
                    return (
                      <tr
                        key={t.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/soporte/${t.id}`)}
                      >
                        <td className="py-3 font-mono text-xs">{t.codigo}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs">{t.organizations?.nombre ?? "—"}</span>
                          </div>
                        </td>
                        <td className="py-3 max-w-xs truncate">{t.asunto}</td>
                        <td className="py-3">
                          <Badge className={`text-[10px] ${prioridadColor[t.prioridad] ?? ""}`}>
                            {t.prioridad}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge className={`text-[10px] ${estadoColor[t.estado] ?? ""}`}>
                            {t.estado}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs">
                          {cerrado ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-col">
                              <span className={r.vencido ? "text-red-600 font-medium" : r.porVencer ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                                {r.texto}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{slaTipo}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("es-MX", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="py-3">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}