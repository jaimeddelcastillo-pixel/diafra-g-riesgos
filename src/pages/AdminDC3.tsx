import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileBadge, CheckCircle2, Clock, Mail } from "lucide-react";
import { toast } from "sonner";

type Solicitud = {
  id: string;
  user_id: string;
  org_id: string | null;
  org_nombre: string | null;
  plan_org: string | null;
  curso_titulo: string | null;
  curso_norma: string | null;
  calificacion: number | null;
  email_destino: string;
  alumno_nombre: string | null;
  fuente: "incluido" | "comprado";
  estado: "pendiente" | "enviado" | "cancelado";
  solicitado_en: string;
  enviado_en: string | null;
  dc3_url: string | null;
  notas_admin: string | null;
};

export default function AdminDC3() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"pendiente" | "enviado" | "todas">("pendiente");
  const [target, setTarget] = useState<Solicitud | null>(null);
  const [dc3Url, setDc3Url] = useState("");
  const [notas, setNotas] = useState("");
  const [notificar, setNotificar] = useState(true);

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ["dc3-solicitudes", filtro],
    queryFn: async () => {
      let q = supabase
        .from("dc3_solicitudes")
        .select("*")
        .order("solicitado_en", { ascending: false });
      if (filtro !== "todas") q = q.eq("estado", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Solicitud[];
    },
  });

  const marcarEnviado = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Sin solicitud seleccionada");
      const { error } = await supabase
        .from("dc3_solicitudes")
        .update({
          estado: "enviado",
          enviado_en: new Date().toISOString(),
          dc3_url: dc3Url.trim() || null,
          notas_admin: notas.trim() || null,
        })
        .eq("id", target.id);
      if (error) throw error;
      if (notificar) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "dc3-enviado",
              recipientEmail: target.email_destino,
              idempotencyKey: `dc3-enviado-${target.id}`,
              templateData: {
                nombre: target.alumno_nombre,
                curso_titulo: target.curso_titulo,
                dc3_url: dc3Url.trim() || undefined,
                notas: notas.trim() || undefined,
              },
            },
          });
        } catch (e) { console.error(e); }
      }
    },
    onSuccess: () => {
      toast.success("Solicitud marcada como enviada");
      qc.invalidateQueries({ queryKey: ["dc3-solicitudes"] });
      setTarget(null);
      setDc3Url("");
      setNotas("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const conteos = useMemo(() => {
    return {
      pendiente: solicitudes.filter((s) => s.estado === "pendiente").length,
      enviado: solicitudes.filter((s) => s.estado === "enviado").length,
    };
  }, [solicitudes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileBadge className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">DC-3 pendientes</h1>
        </div>
        <div className="flex items-center gap-3">
          {filtro !== "todas" && (
            <Badge variant="outline" className="gap-1">
              {filtro === "pendiente" ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {filtro === "pendiente" ? conteos.pendiente : conteos.enviado} {filtro}
            </Badge>
          )}
          <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="enviado">Enviadas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitudes de constancia DC-3 oficial STPS</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
          ) : solicitudes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sin solicitudes en este filtro.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Alumno</th>
                  <th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">Curso</th>
                  <th className="text-left p-3">Calif.</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Solicitado</th>
                  <th className="text-left p-3">Fuente</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/20">
                    <td className="p-3 font-medium">{s.alumno_nombre ?? "—"}</td>
                    <td className="p-3">{s.org_nombre ?? "—"}<div className="text-xs text-muted-foreground">{s.plan_org ?? ""}</div></td>
                    <td className="p-3">{s.curso_titulo ?? "—"}<div className="text-xs text-muted-foreground">{s.curso_norma}</div></td>
                    <td className="p-3">{s.calificacion != null ? `${Number(s.calificacion).toFixed(0)}/100` : "—"}</td>
                    <td className="p-3">
                      <a href={`mailto:${s.email_destino}`} className="text-primary underline">{s.email_destino}</a>
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs">
                      {new Date(s.solicitado_en).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {s.fuente === "comprado" ? "Comprado" : "Incluido"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {s.estado === "pendiente" ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
                      ) : s.estado === "enviado" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Enviado</Badge>
                      ) : (
                        <Badge variant="outline">Cancelado</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {s.estado === "pendiente" && (
                        <Button size="sm" onClick={() => { setTarget(s); setDc3Url(""); setNotas(""); }}>
                          Marcar enviado
                        </Button>
                      )}
                      {s.estado === "enviado" && s.dc3_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={s.dc3_url} target="_blank" rel="noopener noreferrer">Ver PDF</a>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar DC-3 como enviado</DialogTitle>
            <DialogDescription>
              {target?.alumno_nombre} — {target?.curso_titulo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="dc3-url">URL del DC-3 (opcional)</Label>
              <Input id="dc3-url" placeholder="https://…" value={dc3Url} onChange={(e) => setDc3Url(e.target.value)} />
              <p className="text-xs text-muted-foreground">Si subiste el PDF a algún storage, pega la URL aquí.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dc3-notas">Notas internas (opcional)</Label>
              <Textarea id="dc3-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} />
              <Mail className="h-4 w-4" /> Notificar al alumno por correo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button onClick={() => marcarEnviado.mutate()} disabled={marcarEnviado.isPending}>
              {marcarEnviado.isPending ? "Guardando…" : "Confirmar envío"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}