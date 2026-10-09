import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { nombresPersonas } from "@/lib/nombresPersonas";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { CerebroVacio } from "@/components/cerebro/CerebroPage";

/** No cuentan como vigentes. */
export const ESTADOS_RETIRADOS = ["obsoleto", "sustituido", "rechazado"];

const texto = (i: any) => i.titulo ?? i.enunciado ?? i.contenido ?? "—";

type TipoAccion = "validado" | "rechazado" | "obsoleto" | "sustituido";
type Accion = { tipo: TipoAccion; item: any } | null;

const TITULOS: Record<TipoAccion, string> = {
  validado: "Validar conocimiento",
  rechazado: "Rechazar conocimiento",
  obsoleto: "Marcar obsoleto",
  sustituido: "Sustituir por…",
};

/**
 * Lista de conocimiento con ciclo de vida.
 * modo "validacion": acciones Validar/Rechazar sobre pendientes.
 * modo "conocimiento": acciones Obsoleto/Sustituir solo sobre validados.
 */
export function ListaConocimiento({
  items, filtroBase, vacio, modo = "conocimiento",
}: { items: any[]; filtroBase?: (i: any) => boolean; vacio: string; modo?: "validacion" | "conocimiento" }) {
  const { orgRole, isSuperAdmin } = useAuth();
  // C3.3: rol en la empresa activa entregado por el servidor.
  const puedeGobernar = isSuperAdmin() || orgRole === "admin" || orgRole === "responsable_sanitario";
  const qc = useQueryClient();
  const [verRetirados, setVerRetirados] = useState(false);
  const [accion, setAccion] = useState<Accion>(null);
  const [motivo, setMotivo] = useState("");
  const [sustitutoId, setSustitutoId] = useState("");
  const [guardando, setGuardando] = useState(false);

  const porId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const visibles = items.filter((i) => {
    const retirado = ESTADOS_RETIRADOS.includes(i.estado);
    if (retirado) return modo === "conocimiento" && verRetirados;
    return filtroBase ? filtroBase(i) : true;
  });
  const validados = items.filter((i) => i.estado === "validado" && i.id !== accion?.item?.id);

  const ids = visibles.flatMap((i) => [i.estado_cambiado_por, i.validado_por]).filter(Boolean);
  const { data: nombres = {} } = useQuery({
    queryKey: ["cerebro-nombres-estado", ids],
    enabled: ids.length > 0,
    queryFn: () => nombresPersonas(ids),
  });
  const nombre = (id?: string | null) => (id ? (nombres as any)[id] ?? id : "—");
  const fecha = (f?: string | null) => (f ? new Date(f).toLocaleString("es-MX") : "—");

  const abrir = (tipo: TipoAccion, item: any) => {
    setAccion({ tipo, item }); setMotivo(""); setSustitutoId("");
  };

  const confirmar = async () => {
    if (!accion) return;
    const esValidar = accion.tipo === "validado";
    if (!esValidar && !motivo.trim()) return toast.error("El motivo es obligatorio");
    if (accion.tipo === "sustituido" && !sustitutoId) return toast.error("Elige el conocimiento que lo sustituye");
    setGuardando(true);
    const cambios: Record<string, unknown> = { estado: accion.tipo };
    if (esValidar) cambios.comentario_validacion = motivo.trim() || null;
    else cambios.motivo_estado = motivo.trim();
    if (accion.tipo === "sustituido") cambios.sustituido_por_id = sustitutoId;
    const { error } = await supabase.from("brain_knowledge_items").update(cambios as any).eq("id", accion.item.id);
    setGuardando(false);
    if (error) return toast.error(error.message);
    toast.success({
      validado: "Conocimiento validado",
      rechazado: "Conocimiento rechazado",
      obsoleto: "Marcado como obsoleto",
      sustituido: "Marcado como sustituido",
    }[accion.tipo]);
    setAccion(null);
    qc.invalidateQueries({ queryKey: ["brain", "knowledge"] });
  };

  return (
    <div className="space-y-3">
      {modo === "conocimiento" && (
        <div className="flex items-center gap-2">
          <Switch id="ver-retirados" checked={verRetirados} onCheckedChange={setVerRetirados} />
          <Label htmlFor="ver-retirados" className="text-sm">Ver obsoletos, sustituidos y rechazados</Label>
        </div>
      )}

      {visibles.length === 0 ? (
        <CerebroVacio mensaje={vacio} />
      ) : (
        <div className="space-y-2">
          {visibles.map((i) => {
            const retirado = ESTADOS_RETIRADOS.includes(i.estado);
            const sustituto = i.sustituido_por_id ? porId[i.sustituido_por_id] : null;
            const mostrarValidacion = i.validado_por && (i.estado === "validado" || i.estado === "obsoleto" || i.estado === "sustituido");
            return (
              <Card key={i.id} id={`k-${i.id}`} className={retirado ? "opacity-75" : undefined}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{texto(i)}</p>
                    <Badge variant={retirado ? "secondary" : i.estado === "validado" ? "default" : "outline"}>{i.estado}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{i.tipo}</p>
                  {mostrarValidacion && (
                    <div className="text-xs text-muted-foreground space-y-0.5 border-l-2 border-primary/40 pl-2">
                      <p><span className="font-medium">Validado por:</span> {nombre(i.validado_por)} · {fecha(i.validado_en)}</p>
                      {i.comentario_validacion && (
                        <p><span className="font-medium">Comentario:</span> {i.comentario_validacion}</p>
                      )}
                    </div>
                  )}
                  {retirado && (
                    <div className="text-xs text-muted-foreground space-y-0.5 border-l-2 pl-2">
                      <p><span className="font-medium">Motivo:</span> {i.motivo_estado ?? "—"}</p>
                      <p><span className="font-medium">Por:</span> {nombre(i.estado_cambiado_por)} · {fecha(i.estado_cambiado_en)}</p>
                      {i.estado === "sustituido" && i.sustituido_por_id && (
                        <p>
                          <span className="font-medium">Sustituido por:</span>{" "}
                          <a className="underline text-primary" href={`#k-${i.sustituido_por_id}`}>
                            {sustituto ? texto(sustituto).slice(0, 80) : i.sustituido_por_id}
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                  {puedeGobernar && modo === "validacion" && !retirado && i.estado !== "validado" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => abrir("validado", i)}>Validar</Button>
                      <Button size="sm" variant="outline" onClick={() => abrir("rechazado", i)}>Rechazar</Button>
                    </div>
                  )}
                  {puedeGobernar && modo === "conocimiento" && i.estado === "validado" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => abrir("obsoleto", i)}>Marcar obsoleto</Button>
                      <Button size="sm" variant="outline" onClick={() => abrir("sustituido", i)}>Sustituir por…</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!accion} onOpenChange={(o) => !o && setAccion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{accion ? TITULOS[accion.tipo] : ""}</DialogTitle>
            <DialogDescription>
              {accion?.tipo === "validado"
                ? "Quedará registrado a tu nombre, con fecha y hora."
                : "No se borra nada. Para recuperarlo después habrá que validarlo de nuevo."}
            </DialogDescription>
          </DialogHeader>
          {accion && <p className="text-sm border-l-2 pl-2">{texto(accion.item).slice(0, 300)}</p>}
          {accion?.tipo === "sustituido" && (
            <div className="space-y-1">
              <Label className="text-xs">Conocimiento validado que lo sustituye</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={sustitutoId}
                onChange={(e) => setSustitutoId(e.target.value)}
              >
                <option value="">Elige…</option>
                {validados.map((v) => (
                  <option key={v.id} value={v.id}>{texto(v).slice(0, 100)}</option>
                ))}
              </select>
              {validados.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay conocimiento validado disponible.</p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">{accion?.tipo === "validado" ? "Comentario (opcional)" : "Motivo (obligatorio)"}</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccion(null)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={guardando}>{guardando ? "Guardando…" : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
