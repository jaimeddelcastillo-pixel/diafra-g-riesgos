import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ConocimientoUsadoEn } from "./ConocimientoUsadoEn";
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
import { Input } from "@/components/ui/input";
import { FileText } from "lucide-react";

/** C6a.4: abre el archivo de Recursos con URL firmada, en la página si es PDF. */
async function verFuente(f: any) {
  const { data: arch, error } = await (supabase as any).from("org_documentos")
    .select("storage_path, mime_type").eq("id", f.archivo_id).maybeSingle();
  if (error || !arch) return toast.error("No se encontró el archivo en Recursos.");
  const { data, error: uErr } = await supabase.storage.from("org-documentos").createSignedUrl(arch.storage_path, 600);
  if (uErr || !data?.signedUrl) return toast.error("No se pudo abrir el archivo.");
  const pagina = arch.mime_type === "application/pdf" && f.pagina ? `#page=${f.pagina}` : "";
  window.open(`${data.signedUrl}${pagina}`, "_blank", "noopener");
}

function FuenteArchivo({ f }: { f: any }) {
  const ubicacion = f.pagina
    ? `Página ${f.pagina}`
    : f.parrafo ? `Párrafo ${f.parrafo}${f.seccion ? ` · Sección: ${f.seccion}` : ""}` : null;
  return (
    <div className="text-xs space-y-1 border-l-2 border-accent pl-2">
      <p className="flex items-center gap-1 text-muted-foreground">
        <FileText className="h-3 w-3" />
        {[f.documento_codigo, f.documento_revision ? `rev. ${f.documento_revision}` : null, f.nombre_fuente].filter(Boolean).join(" · ")}
        {ubicacion ? ` · ${ubicacion}` : ""}
      </p>
      {f.cita_textual && <p className="italic">“{f.cita_textual}”</p>}
      {f.metodo === "vision" && (
        <p className="text-muted-foreground">Texto obtenido por lectura de imagen (OCR): cotejar contra el documento</p>
      )}
      {f.archivo_id && (
        <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => verFuente(f)}>
          {f.pagina ? "Ver página" : "Ver archivo"}
        </Button>
      )}
    </div>
  );
}

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
  const [atender, setAtender] = useState<any>(null);
  const [opcionRev, setOpcionRev] = useState<"vigente" | "cambio">("vigente");
  const [revVigente, setRevVigente] = useState("");
  const [comentarioRev, setComentarioRev] = useState("");
  const [detalle, setDetalle] = useState<string | null>(null);
  const location = useLocation();
  useEffect(() => {
    const id = location.hash.startsWith("#k-") ? location.hash.slice(3) : null;
    if (id && items.some(i => i.id === id)) {
      setDetalle(id);
      document.getElementById(`k-${id}`)?.scrollIntoView({ block: "center" });
    }
  }, [location.hash, items]);

  const abrirAtender = (item: any) => {
    const rev = (item.fuentes ?? []).find((f: any) => f.documento_revision)?.documento_revision ?? "";
    setAtender(item); setOpcionRev("vigente"); setRevVigente(rev); setComentarioRev("");
  };
  const confirmarAtender = async () => {
    if (!atender) return;
    if (opcionRev === "cambio") {
      const item = atender;
      setAtender(null);
      // "Requiere cambio" no quita la marca: lleva a obsoleto/sustituir (validado) o a rechazar.
      abrir(item.estado === "validado" ? "obsoleto" : "rechazado", item);
      return;
    }
    if (!revVigente.trim()) return toast.error("Indica la revisión que sigue vigente");
    setGuardando(true);
    const { error } = await supabase.from("brain_knowledge_items").update({
      requiere_revision: false,
      revision_confirmada: revVigente.trim(),
      revision_comentario: comentarioRev.trim() || null,
    } as any).eq("id", atender.id);
    setGuardando(false);
    if (error) return toast.error(error.message);
    toast.success("Revisión atendida: sigue vigente");
    setAtender(null);
    qc.invalidateQueries({ queryKey: ["brain", "knowledge"] });
  };

  const porId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  // C4a: trazabilidad — con qué skill de IA se propuso cada conocimiento.
  const extraccionIds = useMemo(
    () => Array.from(new Set((items ?? []).flatMap((i: any) => (i.fuentes ?? []).map((f: any) => f.extraccion_id)).filter(Boolean))) as string[],
    [items],
  );
  const turnIds = useMemo(
    () => Array.from(new Set((items ?? []).map((i: any) => i.turn_id).filter(Boolean))) as string[],
    [items],
  );
  const { data: skillsPorExtraccion = {} } = useQuery({
    queryKey: ["cerebro-skills-extracciones", extraccionIds],
    enabled: extraccionIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("brain_extracciones").select("id, skills_usadas").in("id", extraccionIds);
      return Object.fromEntries((data ?? []).map((e: any) => [e.id, e.skills_usadas ?? null]));
    },
  });
  const { data: skillsPorTurno = {} } = useQuery({
    queryKey: ["cerebro-skills-turnos", turnIds],
    enabled: turnIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("brain_interview_turns").select("id, skills_usadas").in("id", turnIds);
      return Object.fromEntries((data ?? []).map((t: any) => [t.id, t.skills_usadas ?? null]));
    },
  });
  const skillsDe = (i: any) => {
    const exId = (i.fuentes ?? []).find((f: any) => f.extraccion_id)?.extraccion_id;
    return (exId ? (skillsPorExtraccion as any)[exId] : null)
      ?? (i.turn_id ? (skillsPorTurno as any)[i.turn_id] : null)
      ?? null;
  };

  const visibles = items.filter((i) => {
    const retirado = ESTADOS_RETIRADOS.includes(i.estado);
    if (retirado) return modo === "conocimiento" && verRetirados;
    return filtroBase ? filtroBase(i) : true;
  });
  const validados = items.filter((i) => i.estado === "validado" && i.id !== accion?.item?.id);

  const ids = visibles.flatMap((i) => [i.estado_cambiado_por, i.validado_por, i.revision_confirmada_por]).filter(Boolean);
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
                    <div className="min-w-0 space-y-1">
                      <Button variant="link" className="h-auto p-0 font-mono text-xs" onClick={() => setDetalle(detalle === i.id ? null : i.id)}>{i.codigo}</Button>
                      <p className="text-sm font-medium">{texto(i)}</p>
                    </div>
                    <Badge variant={retirado ? "secondary" : i.estado === "validado" ? "default" : "outline"}>{i.estado}</Badge>
                  </div>
                  {(() => {
                    const s = skillsDe(i);
                    return s?.length ? (
                      <p className="text-xs text-muted-foreground">
                        Propuesto por IA con: {s.map((x: any) => `${x.clave} v${x.version}`).join(" · ")}
                      </p>
                    ) : null;
                  })()}
                  <p className="text-xs text-muted-foreground">{i.tipo}</p>
                  {i.requiere_revision && (
                    <div className="text-xs border-l-2 border-destructive/60 pl-2">
                      <Badge variant="destructive" className="mr-2">Requiere revisión</Badge>
                      {i.motivo_revision}
                      {puedeGobernar && (
                        <Button size="sm" variant="outline" className="ml-2 h-7" onClick={() => abrirAtender(i)}>
                          Revisión atendida
                        </Button>
                      )}
                    </div>
                  )}
                  {!i.requiere_revision && i.revision_confirmada && (
                    <p className="text-xs text-muted-foreground">
                      Sigue vigente con la revisión {i.revision_confirmada} · {nombre(i.revision_confirmada_por)} · {fecha(i.revision_confirmada_en)}
                      {i.revision_comentario ? ` · ${i.revision_comentario}` : ""}
                    </p>
                  )}
                  {(i.fuentes ?? []).filter((f: any) => f.tipo_fuente === "archivo").map((f: any) => (
                    <FuenteArchivo key={f.id} f={f} />
                  ))}
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
                  {detalle === i.id && <ConocimientoUsadoEn id={i.id} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!atender} onOpenChange={(o) => !o && setAtender(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisión atendida</DialogTitle>
            <DialogDescription>Queda registrado a tu nombre, con fecha y hora.</DialogDescription>
          </DialogHeader>
          {atender && <p className="text-sm border-l-2 pl-2">{texto(atender).slice(0, 300)}</p>}
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={opcionRev === "vigente"} onChange={() => setOpcionRev("vigente")} />
              Sigue vigente con la revisión
              <Input className="h-8 w-28" value={revVigente} onChange={(e) => setRevVigente(e.target.value)} disabled={opcionRev !== "vigente"} />
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={opcionRev === "cambio"} onChange={() => setOpcionRev("cambio")} />
              Requiere cambio ({atender?.estado === "validado" ? "marcar obsoleto o sustituir" : "rechazar"})
            </label>
          </div>
          {opcionRev === "vigente" && (
            <div className="space-y-1">
              <Label className="text-xs">Comentario</Label>
              <Textarea value={comentarioRev} onChange={(e) => setComentarioRev(e.target.value)} rows={3} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtender(null)}>Cancelar</Button>
            <Button onClick={confirmarAtender} disabled={guardando}>{opcionRev === "cambio" ? "Continuar" : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
