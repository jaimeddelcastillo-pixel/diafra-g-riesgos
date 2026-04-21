import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, ArrowLeft, MessageSquare, Clock, AlertTriangle, CheckCircle2, Send, LifeBuoy,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────
type Prioridad = "Baja" | "Normal" | "Alta" | "Crítica";
type Estado = "Abierto" | "En Atención" | "Esperando Cliente" | "Resuelto" | "Cerrado";
type Categoria = "Bug" | "Consulta" | "Solicitud de Mejora" | "Capacitación" | "Acceso" | "Otro";

interface Ticket {
  id: string;
  codigo: string;
  asunto: string;
  descripcion: string;
  categoria: Categoria;
  prioridad: Prioridad;
  estado: Estado;
  created_by_nombre: string;
  created_by_email: string;
  created_at: string;
  sla_respuesta_at: string;
  sla_resolucion_at: string;
  primera_respuesta_at: string | null;
}

interface Mensaje {
  id: string;
  ticket_id: string;
  autor_nombre: string;
  autor_email: string;
  es_soporte: boolean;
  es_interno: boolean;
  mensaje: string;
  created_at: string;
}

// ── Helpers UI ───────────────────────────────────────────────────────────────
const prioridadStyles: Record<Prioridad, string> = {
  "Baja":    "bg-slate-100 text-slate-700",
  "Normal":  "bg-blue-100 text-blue-700",
  "Alta":    "bg-orange-100 text-orange-700",
  "Crítica": "bg-red-100 text-red-700",
};

const estadoStyles: Record<Estado, string> = {
  "Abierto":            "bg-amber-100 text-amber-800",
  "En Atención":        "bg-blue-100 text-blue-800",
  "Esperando Cliente":  "bg-purple-100 text-purple-800",
  "Resuelto":           "bg-green-100 text-green-800",
  "Cerrado":            "bg-slate-200 text-slate-700",
};

function tiempoDesde(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function slaInfo(t: Ticket) {
  if (t.estado === "Resuelto" || t.estado === "Cerrado") return null;
  const target = t.primera_respuesta_at ? t.sla_resolucion_at : t.sla_respuesta_at;
  const label = t.primera_respuesta_at ? "Resolución" : "Primera respuesta";
  const diff = new Date(target).getTime() - Date.now();
  const venceMin = Math.floor(diff / 60000);
  const vencido = venceMin < 0;
  let txt: string;
  if (vencido) txt = `${label}: vencido hace ${Math.abs(venceMin) < 60 ? Math.abs(venceMin) + "m" : Math.floor(Math.abs(venceMin) / 60) + "h"}`;
  else if (venceMin < 60) txt = `${label} en ${venceMin}m`;
  else txt = `${label} en ${Math.floor(venceMin / 60)}h`;
  return { txt, vencido };
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function Soporte() {
  const { id } = useParams<{ id: string }>();
  const { hasRole, isSuperAdmin, isImpersonating } = useAuth();

  const puedeCrear = hasRole("admin") || hasRole("responsable_sanitario");
  if (!puedeCrear && !isSuperAdmin() && !isImpersonating) {
    return <Navigate to="/" replace />;
  }

  return id ? <TicketDetalle id={id} /> : <ListaTickets puedeCrear={puedeCrear} />;
}

// ── Lista ────────────────────────────────────────────────────────────────────
function ListaTickets({ puedeCrear }: { puedeCrear: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Soporte</h1>
            <p className="text-xs text-muted-foreground">Levanta tickets y consulta su estado</p>
          </div>
        </div>
        {puedeCrear && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo ticket</Button>
            </DialogTrigger>
            <NuevoTicketDialog onClose={() => setOpen(false)} />
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-muted rounded" />)}</div>
      ) : !tickets?.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay tickets. {puedeCrear && "Crea uno para iniciar una solicitud de soporte."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {tickets.map((t) => {
            const sla = slaInfo(t);
            return (
              <Card key={t.id} className="cursor-pointer hover:border-primary/40 transition" onClick={() => navigate(`/soporte/${t.id}`)}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{t.codigo}</span>
                        <Badge className={`text-[10px] ${estadoStyles[t.estado]}`}>{t.estado}</Badge>
                        <Badge className={`text-[10px] ${prioridadStyles[t.prioridad]}`}>{t.prioridad}</Badge>
                        <span className="text-[10px] text-muted-foreground">{t.categoria}</span>
                      </div>
                      <p className="text-sm font-medium truncate">{t.asunto}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span>{t.created_by_nombre}</span>
                        <span>•</span>
                        <span>{tiempoDesde(t.created_at)}</span>
                        {sla && (
                          <>
                            <span>•</span>
                            <span className={`flex items-center gap-1 ${sla.vencido ? "text-red-600 font-medium" : "text-amber-600"}`}>
                              {sla.vencido ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {sla.txt}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Diálogo nuevo ticket ─────────────────────────────────────────────────────
function NuevoTicketDialog({ onClose }: { onClose: () => void }) {
  const { user, profile, orgId } = useAuth();
  const qc = useQueryClient();
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("Consulta");
  const [prioridad, setPrioridad] = useState<Prioridad>("Normal");

  const crear = useMutation({
    mutationFn: async () => {
      if (!user || !orgId) throw new Error("Sesión inválida");
      if (asunto.trim().length < 5) throw new Error("Asunto demasiado corto (mínimo 5 caracteres)");
      if (descripcion.trim().length < 10) throw new Error("Descripción demasiado corta (mínimo 10 caracteres)");

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          codigo: "",  // generado por trigger
          org_id: orgId,
          asunto: asunto.trim(),
          descripcion: descripcion.trim(),
          categoria,
          prioridad,
          created_by: user.id,
          created_by_email: user.email ?? "",
          created_by_nombre: profile?.nombre ?? user.email ?? "",
          sla_respuesta_at: new Date().toISOString(),  // sobreescrito por trigger
          sla_resolucion_at: new Date().toISOString(), // sobreescrito por trigger
        } as any)
        .select("id, codigo")
        .single();

      if (error) throw error;

      // Notificar a soporte
      await supabase.functions.invoke("ticket-notify", {
        body: { evento: "ticket_creado", ticket_id: data.id },
      }).catch((e) => console.warn("notify falló:", e));

      return data;
    },
    onSuccess: (d) => {
      toast.success(`Ticket ${d.codigo} creado. El equipo de soporte fue notificado.`);
      qc.invalidateQueries({ queryKey: ["tickets"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Error al crear ticket"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Nuevo ticket de soporte</DialogTitle>
        <DialogDescription>
          Describe tu solicitud. Recibirás respuesta según el SLA de la prioridad elegida.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Asunto *</Label>
          <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Resumen breve" maxLength={120} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Bug", "Consulta", "Solicitud de Mejora", "Capacitación", "Acceso", "Otro"] as Categoria[]).map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prioridad</Label>
            <Select value={prioridad} onValueChange={(v) => setPrioridad(v as Prioridad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Baja">Baja — 72h respuesta</SelectItem>
                <SelectItem value="Normal">Normal — 24h respuesta</SelectItem>
                <SelectItem value="Alta">Alta — 8h respuesta</SelectItem>
                <SelectItem value="Crítica">Crítica — 2h respuesta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Descripción *</Label>
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={6}
            placeholder="Detalla qué pasó, qué esperabas y los pasos para reproducirlo si aplica."
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={crear.isPending}>Cancelar</Button>
        <Button onClick={() => crear.mutate()} disabled={crear.isPending}>
          {crear.isPending ? "Creando..." : "Crear ticket"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Detalle + conversación ───────────────────────────────────────────────────
function TicketDetalle({ id }: { id: string }) {
  const navigate = useNavigate();
  const { user, profile, isSuperAdmin, hasRole } = useAuth();
  const qc = useQueryClient();
  const [respuesta, setRespuesta] = useState("");
  const [esInterna, setEsInterna] = useState(false);

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Ticket;
    },
  });

  const { data: mensajes } = useQuery<Mensaje[]>({
    queryKey: ["ticket-mensajes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_mensajes")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Mensaje[];
    },
  });

  const enviarRespuesta = useMutation({
    mutationFn: async () => {
      if (!user || !ticket) throw new Error("Sesión inválida");
      if (respuesta.trim().length < 1) throw new Error("Escribe una respuesta");
      const esSoporte = isSuperAdmin();

      const { error } = await supabase.from("ticket_mensajes").insert({
        ticket_id: ticket.id,
        autor_id: user.id,
        autor_email: user.email ?? "",
        autor_nombre: profile?.nombre ?? user.email ?? "",
        es_soporte: esSoporte,
        es_interno: esSoporte && esInterna,
        mensaje: respuesta.trim(),
      });
      if (error) throw error;

      // Notificar al cliente solo si soporte respondió en público
      if (esSoporte && !esInterna) {
        await supabase.functions.invoke("ticket-notify", {
          body: { evento: "respuesta_soporte", ticket_id: ticket.id, mensaje: respuesta.trim() },
        }).catch((e) => console.warn("notify falló:", e));
      }
    },
    onSuccess: () => {
      setRespuesta("");
      setEsInterna(false);
      qc.invalidateQueries({ queryKey: ["ticket-mensajes", id] });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Mensaje enviado");
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const cambiarEstado = useMutation({
    mutationFn: async (nuevo: Estado) => {
      if (!ticket) return;
      const patch: any = { estado: nuevo };
      if (nuevo === "Resuelto") patch.resuelto_at = new Date().toISOString();
      if (nuevo === "Cerrado") patch.cerrado_at = new Date().toISOString();
      const { error } = await supabase.from("tickets").update(patch).eq("id", ticket.id);
      if (error) throw error;
      await supabase.functions.invoke("ticket-notify", {
        body: { evento: "estado_cambiado", ticket_id: ticket.id, estado_nuevo: nuevo },
      }).catch((e) => console.warn("notify falló:", e));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Estado actualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  if (isLoading || !ticket) {
    return <div className="h-40 animate-pulse bg-muted rounded" />;
  }

  const sla = slaInfo(ticket);
  const esSoporte = isSuperAdmin();
  const puedeResponder = ticket.estado !== "Cerrado";
  const esAdminOrg = hasRole("admin");

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/soporte")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="font-mono text-xs text-muted-foreground">{ticket.codigo}</span>
          <Badge className={`text-[10px] ${estadoStyles[ticket.estado]}`}>{ticket.estado}</Badge>
          <Badge className={`text-[10px] ${prioridadStyles[ticket.prioridad]}`}>{ticket.prioridad}</Badge>
          <span className="text-[10px] text-muted-foreground">{ticket.categoria}</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{ticket.asunto}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Por {ticket.created_by_nombre} ({ticket.created_by_email}) • {tiempoDesde(ticket.created_at)}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{ticket.descripcion}</p>
          {sla && (
            <div className={`mt-3 flex items-center gap-2 text-xs ${sla.vencido ? "text-red-600" : "text-amber-600"}`}>
              {sla.vencido ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              SLA — {sla.txt}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones de estado */}
      {(esSoporte || esAdminOrg) && ticket.estado !== "Cerrado" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Cambiar estado:</span>
          {esSoporte && ticket.estado !== "Esperando Cliente" && (
            <Button size="sm" variant="outline" onClick={() => cambiarEstado.mutate("Esperando Cliente")}>Esperando cliente</Button>
          )}
          {esSoporte && ticket.estado !== "Resuelto" && (
            <Button size="sm" variant="outline" onClick={() => cambiarEstado.mutate("Resuelto")}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar resuelto
            </Button>
          )}
          {(esAdminOrg || esSoporte) && (
            <Button size="sm" variant="outline" onClick={() => cambiarEstado.mutate("Cerrado")}>Cerrar ticket</Button>
          )}
        </div>
      )}

      {/* Conversación */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Conversación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!mensajes?.length ? (
            <p className="text-xs text-muted-foreground">Aún no hay respuestas.</p>
          ) : (
            mensajes.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-lg border ${
                  m.es_interno
                    ? "bg-yellow-50 border-yellow-200"
                    : m.es_soporte
                      ? "bg-blue-50 border-blue-200"
                      : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs">
                  <span className="font-medium">{m.autor_nombre}</span>
                  {m.es_soporte && <Badge variant="outline" className="text-[9px]">TRACEA Soporte</Badge>}
                  {m.es_interno && <Badge className="text-[9px] bg-yellow-200 text-yellow-900">Nota interna</Badge>}
                  <span className="text-muted-foreground">• {tiempoDesde(m.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.mensaje}</p>
              </div>
            ))
          )}

          {puedeResponder && (
            <div className="pt-2 border-t space-y-2">
              <Textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                rows={3}
                placeholder={esSoporte ? "Responder al cliente..." : "Escribir respuesta..."}
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                {esSoporte && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={esInterna}
                      onChange={(e) => setEsInterna(e.target.checked)}
                      className="rounded"
                    />
                    Nota interna (no visible al cliente)
                  </label>
                )}
                <Button
                  size="sm"
                  onClick={() => enviarRespuesta.mutate()}
                  disabled={enviarRespuesta.isPending || !respuesta.trim()}
                  className="ml-auto"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}