import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileStack, Plus, Pencil, Trash2, RotateCcw, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Tipo {
  id: string;
  clave: string;
  nombre: string;
  claves_codigo: string[];
  sinonimos: string[];
  es_registro: boolean;
  activo: boolean;
  orden: number;
  es_propio: boolean;
}

const lista = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function DocumentoTiposCard() {
  const { orgId, orgRole } = useAuth();
  const puede = orgRole === "admin" || orgRole === "responsable_sanitario" || orgRole === "super_admin";
  const sb = supabase as any;
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [uso, setUso] = useState<Record<string, number>>({});
  const [posicion, setPosicion] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [edit, setEdit] = useState<Partial<Tipo> | null>(null);
  const [form, setForm] = useState({ clave: "", nombre: "", claves: "", sinonimos: "", es_registro: false });

  const cargar = async () => {
    if (!orgId) return;
    setCargando(true);
    const [{ data: t }, { data: u }, { data: c }] = await Promise.all([
      sb.from("documento_tipos").select("*").eq("org_id", orgId).order("orden").order("clave"),
      sb.rpc("documento_tipos_uso"),
      sb.from("documento_tipos_config").select("posicion_tipo_en_codigo").eq("org_id", orgId).maybeSingle(),
    ]);
    setTipos((t ?? []) as Tipo[]);
    const m: Record<string, number> = {};
    for (const r of (u ?? []) as any[]) m[r.clave] = Number(r.documentos) + Number(r.archivos);
    setUso(m);
    setPosicion(c?.posicion_tipo_en_codigo ?? 1);
    setCargando(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  if (!puede) return null;

  const abrir = (t?: Tipo) => {
    setEdit(t ?? {});
    setForm({
      clave: t?.clave ?? "",
      nombre: t?.nombre ?? "",
      claves: (t?.claves_codigo ?? []).join(", "),
      sinonimos: (t?.sinonimos ?? []).join(", "),
      es_registro: t?.es_registro ?? false,
    });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error("Escribe el nombre del tipo.");
    const payload = {
      nombre: form.nombre.trim(),
      claves_codigo: lista(form.claves).map((x) => x.toUpperCase()),
      sinonimos: lista(form.sinonimos),
      es_registro: form.es_registro,
    };
    setOcupado(true);
    let error;
    if (edit?.id) {
      ({ error } = await sb.from("documento_tipos").update(payload).eq("id", edit.id));
    } else {
      const clave = form.clave.trim().toLowerCase();
      if (!/^[a-z0-9_]{1,40}$/.test(clave)) {
        setOcupado(false);
        return toast.error("La clave interna solo admite minúsculas, números y guion bajo.");
      }
      ({ error } = await sb.from("documento_tipos").insert({
        ...payload, clave, org_id: orgId, es_propio: true, orden: 200,
      }));
    }
    setOcupado(false);
    if (error) return toast.error(error.message.includes("documento_tipos_org_clave_uq") ? "Ya existe un tipo con esa clave." : error.message);
    toast.success(edit?.id ? "Tipo actualizado." : "Tipo propio agregado.");
    setEdit(null);
    cargar();
  };

  const quitar = async (t: Tipo) => {
    if (!window.confirm(`¿Quitar el tipo "${t.nombre}"?`)) return;
    const { data, error } = await sb.rpc("quitar_documento_tipo", { p_id: t.id });
    if (error) return toast.error(error.message);
    toast.success(data === "eliminado"
      ? `"${t.nombre}" se eliminó porque ningún documento lo usaba.`
      : `"${t.nombre}" se desactivó porque hay documentos que lo usan. Esos documentos conservan su tipo; ya no aparecerá para documentos nuevos.`);
    cargar();
  };

  const reactivar = async (t: Tipo) => {
    const { error } = await sb.from("documento_tipos").update({ activo: true }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(`"${t.nombre}" está activo otra vez.`);
    cargar();
  };

  const restaurar = async () => {
    setOcupado(true);
    const { data, error } = await sb.rpc("restaurar_documento_tipos");
    setOcupado(false);
    if (error) return toast.error(error.message);
    toast.success(data > 0 ? `Se restauraron ${data} tipos de la plantilla.` : "No faltaba ningún tipo de la plantilla.");
    cargar();
  };

  const reclasificar = async () => {
    if (!window.confirm("Se volverán a clasificar los documentos del Listado Maestro con este catálogo. ¿Continuar?")) return;
    setOcupado(true);
    const { data, error } = await sb.rpc("reclasificar_documentos");
    setOcupado(false);
    if (error) return toast.error(error.message);
    toast.success(`Revisados ${data?.revisados ?? 0} documentos; cambiaron de tipo ${data?.cambiados ?? 0}.`);
    cargar();
  };

  const guardarPosicion = async (v: number) => {
    if (!orgId || v < 1 || v > 10) return;
    setPosicion(v);
    const { error } = await sb.from("documento_tipos_config")
      .upsert({ org_id: orgId, posicion_tipo_en_codigo: v }, { onConflict: "org_id" });
    if (error) toast.error(error.message); else toast.success("Posición guardada.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileStack className="h-4 w-4" /> Tipos de documento
        </CardTitle>
        <CardDescription>
          Catálogo de tu empresa. Se usa para reconocer el tipo de cada documento por su código
          (por ejemplo, PNO en PNO-VAL-16) o por la columna "Tipo" del Listado Maestro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="pos-tipo" className="text-xs">Posición del tipo en el código</Label>
            <Input id="pos-tipo" type="number" min={1} max={10} className="w-24" value={posicion}
              onChange={(e) => guardarPosicion(Number(e.target.value))} />
          </div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Solo se compara ese segmento (1 = el primero). Si no coincide, se usa la columna "Tipo"; si tampoco, queda como Otro.
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => abrir()}><Plus className="h-3.5 w-3.5" /> Agregar tipo propio</Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={restaurar}><RotateCcw className="h-3.5 w-3.5" /> Restaurar tipos de la plantilla</Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={reclasificar}>
              {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Reclasificar documentos
            </Button>
          </div>
        </div>

        {cargando ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Claves de código</TableHead>
                  <TableHead>Sinónimos</TableHead>
                  <TableHead className="text-right">Documentos</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipos.map((t) => (
                  <TableRow key={t.id} className={t.activo ? "" : "opacity-60"}>
                    <TableCell>
                      <div className="font-medium text-sm">{t.nombre}</div>
                      <div className="flex gap-1 mt-1">
                        {t.es_propio && <Badge variant="secondary">Propio</Badge>}
                        {t.es_registro && <Badge variant="outline">Registro</Badge>}
                        {!t.activo && <Badge variant="outline">Inactivo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{t.claves_codigo.join(", ") || "—"}</TableCell>
                    <TableCell className="text-xs max-w-xs">{t.sinonimos.join(", ") || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{uso[t.clave] ?? 0}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => abrir(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {t.activo ? (
                        <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => quitar(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => reactivar(t)}>Reactivar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar tipo" : "Agregar tipo propio"}</DialogTitle>
            <DialogDescription>Los cambios solo afectan a tu empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!edit?.id && (
              <div>
                <Label htmlFor="dt-clave">Clave interna</Label>
                <Input id="dt-clave" value={form.clave} placeholder="ej. dfq" onChange={(e) => setForm({ ...form, clave: e.target.value })} />
              </div>
            )}
            <div>
              <Label htmlFor="dt-nombre">Nombre</Label>
              <Input id="dt-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="dt-claves">Claves de código (separadas por coma)</Label>
              <Input id="dt-claves" value={form.claves} placeholder="ej. DFQ" onChange={(e) => setForm({ ...form, claves: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="dt-sin">Sinónimos (separados por coma)</Label>
              <Input id="dt-sin" value={form.sinonimos} onChange={(e) => setForm({ ...form, sinonimos: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="dt-reg" checked={form.es_registro} onCheckedChange={(v) => setForm({ ...form, es_registro: v })} />
              <Label htmlFor="dt-reg">Registro de evento (sin revisión)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={ocupado}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
