import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Download, Search, Pencil, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const sb = supabase as any;
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—";
const ESTADO_VAR: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  borrador: "outline", activo: "default", cerrado: "secondary", revocado: "destructive",
};
const vencido = (a: any) => a.estado === "activo" && new Date(a.expira_en) <= new Date();
const TIPO_LABEL: Record<string, string> = { folio: "Folio", documento: "Documento", conocimiento: "Conocimiento" };
const ACCION_LABEL: Record<string, string> = { AUDITOR_CONSULTO: "Consultó", AUDITOR_DESCARGO: "Descargó", AUDITORIA_ACTIVADA: "Expediente activado", AUDITORIA_DUPLICADA: "Expediente creado por duplicado" };

function usePuedeGestionar() {
  const { hasRole, orgRole } = useAuth();
  return { gestiona: hasRole("admin") || hasRole("responsable_sanitario"), esRS: orgRole === "responsable_sanitario" };
}

async function errorFuncion(error: any) {
  try { const b = await error?.context?.json?.(); if (b?.error) return b.error; } catch { /* noop */ }
  return error?.message ?? "Error";
}

// El servicio de invitación rechaza correos con espacios o puntos al final: se limpian al capturar.
export const limpiarCorreo = (e: string) => e.trim().toLowerCase().replace(/[\s.]+$/, "");
export const correoValido = (e: string) => /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(e);

type Modo = "nuevo" | "editar" | "duplicar";

function ExpedienteDialog({ open, onOpenChange, modo, base, onGuardado }: {
  open: boolean; onOpenChange: (v: boolean) => void; modo: Modo; base?: any; onGuardado?: () => void;
}) {
  const { orgId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const inicial = () => {
    const hoy = new Date();
    const fechas = { inicia_en: iso(hoy), expira_en: iso(new Date(hoy.getTime() + 7 * 86400000)) };
    if (modo === "editar" && base) return { nombre: base.nombre, auditor_nombre: base.auditor_nombre,
      auditor_organizacion: base.auditor_organizacion ?? "", auditor_email: base.auditor_email,
      inicia_en: iso(new Date(base.inicia_en)), expira_en: iso(new Date(base.expira_en)), permite_descarga: base.permite_descarga };
    if (modo === "duplicar" && base) return { nombre: `${base.nombre} (copia)`.slice(0, 200), auditor_nombre: "",
      auditor_organizacion: "", auditor_email: "", ...fechas, permite_descarga: base.permite_descarga };
    return { nombre: "", auditor_nombre: "", auditor_organizacion: "", auditor_email: "", ...fechas, permite_descarga: true };
  };
  const [f, setF] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const email = limpiarCorreo(f.auditor_email);
  const emailMal = f.auditor_email.trim() !== "" && !correoValido(email);

  const guardar = async () => {
    const ini = new Date(f.inicia_en), fin = new Date(f.expira_en);
    if (fin <= ini || fin.getTime() - ini.getTime() > 30 * 86400000) {
      toast({ title: "Vigencia inválida", description: "El vencimiento debe ser posterior al inicio y como máximo 30 días después.", variant: "destructive" });
      return;
    }
    const datos = { nombre: f.nombre.trim(), auditor_nombre: f.auditor_nombre.trim(),
      auditor_organizacion: f.auditor_organizacion.trim() || null, auditor_email: email,
      inicia_en: ini.toISOString(), expira_en: fin.toISOString(), permite_descarga: f.permite_descarga };
    setGuardando(true);
    if (modo === "editar") {
      const { error } = await sb.from("auditorias_externas").update(datos).eq("id", base.id);
      setGuardando(false);
      if (error) { toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Datos actualizados" });
      onOpenChange(false); onGuardado?.();
      return;
    }
    if (modo === "duplicar") {
      const { data, error } = await sb.rpc("duplicar_auditoria", { p_origen: base.id, p_nombre: datos.nombre,
        p_auditor_nombre: datos.auditor_nombre, p_auditor_organizacion: datos.auditor_organizacion ?? "",
        p_auditor_email: datos.auditor_email, p_inicia_en: datos.inicia_en, p_expira_en: datos.expira_en,
        p_permite_descarga: datos.permite_descarga });
      setGuardando(false);
      if (error) { toast({ title: "No se pudo duplicar", description: error.message, variant: "destructive" }); return; }
      const om = (data.omitidos ?? []) as { tipo: string; titulo: string; motivo: string }[];
      toast({
        title: `Preparación duplicada: ${data.copiados} ítem(s) copiados`,
        description: om.length ? `Se omitieron ${om.length}: ${om.map((o) => `${TIPO_LABEL[o.tipo]} «${String(o.titulo).slice(0, 50)}» (${o.motivo})`).join("; ")}` : undefined,
        duration: om.length ? 15000 : 5000,
      });
      onOpenChange(false);
      navigate(`/configuracion/auditorias/${data.id}`);
      return;
    }
    const { data, error } = await sb.from("auditorias_externas").insert({ org_id: orgId, ...datos }).select("id").single();
    setGuardando(false);
    if (error) { toast({ title: "No se pudo crear", description: error.message, variant: "destructive" }); return; }
    onOpenChange(false);
    navigate(`/configuracion/auditorias/${data.id}`);
  };

  const titulo = modo === "editar" ? "Editar datos del expediente" : modo === "duplicar" ? "Duplicar preparación para otro auditor" : "Nuevo expediente de auditoría";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        {modo === "duplicar" && (
          <p className="text-sm text-muted-foreground">Se crea un borrador nuevo con los ítems de este expediente que sigan vigentes. Los que ya no lo estén se omiten y se te avisa cuáles.</p>
        )}
        <div className="space-y-3">
          <div><Label>Nombre</Label><Input placeholder="Auditoría COFEPRIS oct-2026" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Auditor</Label><Input value={f.auditor_nombre} onChange={(e) => set("auditor_nombre", e.target.value)} /></div>
            <div><Label>Organización del auditor</Label><Input value={f.auditor_organizacion} onChange={(e) => set("auditor_organizacion", e.target.value)} /></div>
          </div>
          <div>
            <Label>Correo del auditor</Label>
            <Input type="email" value={f.auditor_email} onChange={(e) => set("auditor_email", e.target.value)} onBlur={() => set("auditor_email", email)} />
            {emailMal && <p className="text-xs text-destructive mt-1">Correo no válido</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Inicia</Label><Input type="datetime-local" value={f.inicia_en} onChange={(e) => set("inicia_en", e.target.value)} /></div>
            <div><Label>Vence (máx. 30 días)</Label><Input type="datetime-local" value={f.expira_en} onChange={(e) => set("expira_en", e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={f.permite_descarga} onCheckedChange={(v) => set("permite_descarga", v)} /><Label>Permitir descargas con marca de agua</Label></div>
          {!f.permite_descarga && <p className="text-xs text-muted-foreground">Sin descargas, el auditor ve los PDF en pantalla con la misma marca de agua.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={guardando || f.nombre.trim().length < 3 || f.auditor_nombre.trim().length < 2 || !correoValido(email)} onClick={guardar}>
            {modo === "editar" ? "Guardar" : modo === "duplicar" ? "Duplicar" : "Crear borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Lista() {
  const { orgId } = useAuth();
  const [nuevo, setNuevo] = useState(false);
  const { data } = useQuery({
    queryKey: ["auditorias-externas", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await sb.from("auditorias_externas")
        .select("id, nombre, auditor_nombre, auditor_email, estado, inicia_en, expira_en").eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link to="/configuracion" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Configuración</Link>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Auditorías externas</h1>
          <p className="text-sm text-muted-foreground">Expedientes de solo lectura para auditores externos. El auditor no es integrante de la empresa.</p>
        </div>
        <Button onClick={() => setNuevo(true)}><Plus className="h-4 w-4 mr-1" />Nuevo</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {(data ?? []).length === 0 && <p className="p-6 text-sm text-muted-foreground">Aún no hay expedientes.</p>}
          {(data ?? []).map((a) => (
            <Link key={a.id} to={`/configuracion/auditorias/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b last:border-0 hover:bg-muted">
              <div className="min-w-0">
                <p className="font-medium truncate">{a.nombre}</p>
                <p className="text-xs text-muted-foreground truncate">{a.auditor_nombre} · {a.auditor_email}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{fmt(a.inicia_en)} → {fmt(a.expira_en)}</span>
                <Badge variant={vencido(a) ? "secondary" : ESTADO_VAR[a.estado]}>{vencido(a) ? "vencido" : a.estado}</Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
      {nuevo && <ExpedienteDialog open modo="nuevo" onOpenChange={setNuevo} />}
    </div>
  );
}

function Buscador({ auditoriaId, orgId, onAgregado }: { auditoriaId: string; orgId: string; onAgregado: () => void }) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"folio" | "documento" | "conocimiento">("folio");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ id: string; titulo: string }[]>([]);
  const buscar = async () => {
    const t = q.trim().replace(/[%,()]/g, " ");
    let rows: any[] = [];
    if (tipo === "folio") {
      let qb = sb.from("folios").select("id, codigo, proceso_equipo, estado").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20);
      if (t) qb = qb.or(`codigo.ilike.%${t}%,proceso_equipo.ilike.%${t}%`);
      rows = ((await qb).data ?? []).map((f: any) => ({ id: f.id, titulo: `${f.codigo} · ${f.proceso_equipo ?? ""} (${f.estado})` }));
    } else if (tipo === "documento") {
      let qb = sb.from("org_documentos").select("id, nombre, version").eq("org_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
      if (t) qb = qb.ilike("nombre", `%${t}%`);
      rows = ((await qb).data ?? []).map((d: any) => ({ id: d.id, titulo: `${d.nombre}${d.version ? ` · ${d.version}` : ""}` }));
    } else {
      let qb = sb.from("brain_knowledge_items").select("id, contenido").eq("org_id", orgId).eq("estado", "validado").order("validado_en", { ascending: false }).limit(20);
      if (t) qb = qb.ilike("contenido", `%${t}%`);
      rows = ((await qb).data ?? []).map((k: any) => ({ id: k.id, titulo: String(k.contenido).slice(0, 140) }));
    }
    setRes(rows);
  };
  const agregar = async (id: string) => {
    const { error } = await sb.from("auditoria_items").insert({ auditoria_id: auditoriaId, org_id: orgId, tipo, entidad_id: id });
    if (error) {
      toast({ title: "No se pudo agregar", description: /duplicate|unique/i.test(error.message) ? "Ya está en el expediente" : error.message, variant: "destructive" });
      return;
    }
    onAgregado();
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(["folio", "documento", "conocimiento"] as const).map((t) => (
          <Button key={t} size="sm" variant={tipo === t ? "default" : "outline"} onClick={() => { setTipo(t); setRes([]); }}>
            {t === "conocimiento" ? "Conocimientos validados" : TIPO_LABEL[t] + "s"}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} />
        <Button variant="outline" onClick={buscar}><Search className="h-4 w-4" /></Button>
      </div>
      <div className="max-h-64 overflow-auto space-y-1">
        {res.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-1.5">
            <span className="truncate">{r.titulo}</span>
            <Button size="sm" variant="ghost" onClick={() => agregar(r.id)}><Plus className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Detalle({ id }: { id: string }) {
  const { orgId } = useAuth();
  const { esRS } = usePuedeGestionar();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [cierre, setCierre] = useState<null | "cerrado" | "revocado">(null);
  const [dialogo, setDialogo] = useState<null | "editar" | "duplicar">(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const { data: a, refetch } = useQuery({
    queryKey: ["auditoria-externa", id],
    queryFn: async () => {
      const { data, error } = await sb.from("auditorias_externas").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const { data: items, refetch: refItems } = useQuery({
    queryKey: ["auditoria-items", id],
    queryFn: async () => {
      const { data: its } = await sb.from("auditoria_items").select("*").eq("auditoria_id", id).order("created_at");
      const rows = (its ?? []) as any[];
      const ids = (t: string) => rows.filter((r) => r.tipo === t).map((r) => r.entidad_id);
      const [f, d, k] = await Promise.all([
        ids("folio").length ? sb.from("folios").select("id, codigo, proceso_equipo").in("id", ids("folio")) : { data: [] },
        ids("documento").length ? sb.from("org_documentos").select("id, nombre").in("id", ids("documento")) : { data: [] },
        ids("conocimiento").length ? sb.from("brain_knowledge_items").select("id, contenido").in("id", ids("conocimiento")) : { data: [] },
      ]);
      const t: Record<string, string> = {};
      (f.data ?? []).forEach((x: any) => (t[x.id] = `${x.codigo} · ${x.proceso_equipo ?? ""}`));
      (d.data ?? []).forEach((x: any) => (t[x.id] = x.nombre));
      (k.data ?? []).forEach((x: any) => (t[x.id] = String(x.contenido).slice(0, 140)));
      return rows.map((r) => ({ ...r, titulo: t[r.entidad_id] ?? r.entidad_id }));
    },
  });
  const { data: actividad } = useQuery({
    queryKey: ["auditoria-actividad", id],
    queryFn: async () => {
      const { data, error } = await sb.rpc("auditoria_actividad", { p_auditoria_id: id });
      if (error) throw error;
      return data as any[];
    },
  });

  if (!a) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const editable = a.estado === "borrador" || a.estado === "activo";
  const titulos = Object.fromEntries((items ?? []).map((i: any) => [i.id, `${TIPO_LABEL[i.tipo]} · ${i.titulo}`]));

  const activar = async () => {
    setOcupado(true);
    const { error } = await supabase.functions.invoke("auditoria-invitar", { body: { auditoria_id: id } });
    setOcupado(false);
    if (error) { toast({ title: "No se pudo activar", description: await errorFuncion(error), variant: "destructive" }); return; }
    toast({ title: "Expediente activado", description: "Se envió la invitación al auditor." });
    refetch(); qc.invalidateQueries({ queryKey: ["auditoria-actividad", id] });
  };
  const cerrar = async () => {
    setOcupado(true);
    const { error } = await sb.from("auditorias_externas").update({ estado: cierre, motivo_cierre: motivo.trim() }).eq("id", id);
    setOcupado(false);
    if (error) { toast({ title: "No se pudo cambiar", description: error.message, variant: "destructive" }); return; }
    setCierre(null); setMotivo(""); refetch();
  };
  const quitar = async (itemId: string) => {
    const { error } = await sb.from("auditoria_items").delete().eq("id", itemId);
    if (error) toast({ title: "No se pudo quitar", description: error.message, variant: "destructive" }); else refItems();
  };
  const evidencias = async (itemId: string, v: boolean) => {
    const { error } = await sb.from("auditoria_items").update({ incluir_evidencias: v }).eq("id", itemId);
    if (error) toast({ title: "No se pudo cambiar", description: error.message, variant: "destructive" }); else refItems();
  };
  const exportarCSV = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const filas = [["fecha", "grupo", "quien", "accion", "item", "archivo", "sha256", "ip"],
      ...(actividad ?? []).map((r) => [r.fecha, r.es_auditor ? "Auditor" : "Empresa", r.persona ?? "", ACCION_LABEL[r.accion] ?? r.accion, titulos[r.item_id] ?? r.item_id ?? "", r.archivo ?? "", r.sha256 ?? "", r.ip ?? ""])];
    const blob = new Blob(["\ufeff" + filas.map((f) => f.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a"); el.href = url; el.download = `actividad_${a.nombre.replace(/[^\w-]+/g, "_")}.csv`; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link to="/configuracion/auditorias" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Auditorías externas</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{a.nombre}</h1>
          <p className="text-sm text-muted-foreground">{a.auditor_nombre}{a.auditor_organizacion ? ` (${a.auditor_organizacion})` : ""} · {a.auditor_email}</p>
          <p className="text-sm text-muted-foreground">Vigencia: {fmt(a.inicia_en)} → {fmt(a.expira_en)} · {a.permite_descarga ? "Con descargas" : "Sin descargas"}</p>
          {a.motivo_cierre && <p className="text-sm mt-1">Motivo de {a.estado === "revocado" ? "revocación" : "cierre"}: {a.motivo_cierre} ({fmt(a.cerrado_en)})</p>}
          {a.duplicado_de && <Link to={`/configuracion/auditorias/${a.duplicado_de}`} className="text-xs text-primary underline">Duplicado de otro expediente</Link>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={vencido(a) ? "secondary" : ESTADO_VAR[a.estado]}>{vencido(a) ? "vencido" : a.estado}</Badge>
          {a.estado === "borrador" && <Button size="sm" variant="outline" onClick={() => setDialogo("editar")}><Pencil className="h-4 w-4 mr-1" />Editar datos</Button>}
          <Button size="sm" variant="outline" onClick={() => setDialogo("duplicar")}><Copy className="h-4 w-4 mr-1" />Duplicar preparación</Button>
          {esRS && a.estado === "borrador" && <Button size="sm" disabled={ocupado || !(items ?? []).length} onClick={activar}>Activar e invitar</Button>}
          {esRS && editable && <Button size="sm" variant="outline" onClick={() => setCierre("cerrado")}>Cerrar</Button>}
          {esRS && editable && <Button size="sm" variant="destructive" onClick={() => setCierre("revocado")}>Revocar</Button>}
        </div>
      </div>
      {!esRS && editable && <p className="text-xs text-muted-foreground">Solo el Responsable Sanitario activa, cierra o revoca el expediente.</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Ítems ({(items ?? []).length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 pt-0">
            {(items ?? []).length === 0 && <p className="text-sm text-muted-foreground">Agrega folios, documentos o conocimientos.</p>}
            {(items ?? []).map((i: any) => (
              <div key={i.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-1.5">
                <span className="truncate"><Badge variant="outline" className="mr-2">{TIPO_LABEL[i.tipo]}</Badge>{i.titulo}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {i.tipo === "folio" && (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Switch checked={i.incluir_evidencias} disabled={!editable} onCheckedChange={(v) => evidencias(i.id, v)} />Evidencias
                    </label>
                  )}
                  {editable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => quitar(i.id)} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        {editable && orgId && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Agregar ítems</CardTitle></CardHeader>
            <CardContent className="pt-0"><Buscador auditoriaId={id} orgId={orgId} onAgregado={refItems} /></CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Actividad del expediente</CardTitle>
          <Button size="sm" variant="outline" disabled={!(actividad ?? []).length} onClick={exportarCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-4 overflow-x-auto">
          {[{ titulo: "Acciones del auditor", filas: (actividad ?? []).filter((r) => r.es_auditor) },
            { titulo: "Acciones de la empresa", filas: (actividad ?? []).filter((r) => !r.es_auditor) }].map(({ titulo, filas }) => (
            <section key={titulo}>
              <h3 className="text-xs font-semibold mb-1">{titulo} ({filas.length})</h3>
              {filas.length === 0 ? <p className="text-sm text-muted-foreground">Sin actividad registrada.</p> : (
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground">{["Fecha", "Quién", "Acción", "Ítem", "Archivo", "SHA-256"].map((h) => <th key={h} className="p-1.5">{h}</th>)}</tr></thead>
                  <tbody>
                    {filas.map((r, n) => (
                      <tr key={n} className="border-t align-top">
                        <td className="p-1.5 whitespace-nowrap">{fmt(r.fecha)}</td>
                        <td className="p-1.5">{r.persona ?? "—"}</td>
                        <td className="p-1.5">{ACCION_LABEL[r.accion] ?? r.accion}{r.modo === "vista_60s" || r.modo === "vista_pdf" ? " (vista)" : ""}</td>
                        <td className="p-1.5">{titulos[r.item_id] ?? "—"}</td>
                        <td className="p-1.5">{r.archivo ?? "—"}</td>
                        <td className="p-1.5 font-mono break-all">{r.sha256 ? `${r.sha256.slice(0, 16)}…` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </CardContent>
      </Card>

      {dialogo && <ExpedienteDialog key={dialogo} open modo={dialogo} base={a} onOpenChange={(v) => !v && setDialogo(null)} onGuardado={() => refetch()} />}
      <Dialog open={!!cierre} onOpenChange={(v) => !v && setCierre(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cierre === "revocado" ? "Revocar expediente" : "Cerrar expediente"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">El auditor pierde el acceso de inmediato. No se puede deshacer.</p>
          <Label>Motivo (obligatorio)</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCierre(null)}>Cancelar</Button>
            <Button variant={cierre === "revocado" ? "destructive" : "default"} disabled={ocupado || motivo.trim().length < 5} onClick={cerrar}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AuditoriasExternas() {
  const { id } = useParams();
  const { loading } = useAuth();
  const { gestiona } = usePuedeGestionar();
  if (loading) return null;
  if (!gestiona) return <Navigate to="/configuracion" replace />;
  return id ? <Detalle id={id} /> : <Lista />;
}
