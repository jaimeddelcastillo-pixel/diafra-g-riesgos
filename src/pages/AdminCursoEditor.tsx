import { useEffect, useState, useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Save, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { toast } from "sonner";

type Curso = { id: string; norma: string; titulo: string; descripcion: string; activo: boolean };
type Modulo = { id: string; curso_id: string; titulo: string; descripcion: string; orden: number; activo: boolean };
type Leccion = {
  id: string;
  modulo_id: string;
  leccion_id: string;
  titulo: string;
  tipo: "video" | "descarga" | "practica" | "evaluacion";
  url_video: string | null;
  archivo_storage: string | null;
  proximamente: boolean;
  orden: number;
  activo: boolean;
};

export default function AdminCursoEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useAuth();
  const [curso, setCurso] = useState<Curso | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [lecciones, setLecciones] = useState<Record<string, Leccion[]>>({});
  const [archivos, setArchivos] = useState<string[]>([]);
  const [load, setLoad] = useState(true);
  const [uploadingLec, setUploadingLec] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const { data: c } = await (supabase as any).from("cursos").select("*").eq("id", id).maybeSingle();
    setCurso(c);
    const { data: m } = await (supabase as any)
      .from("curso_modulos")
      .select("*")
      .eq("curso_id", id)
      .order("orden", { ascending: true });
    setModulos(m ?? []);
    const ids = (m ?? []).map((x: any) => x.id);
    if (ids.length) {
      const { data: l } = await (supabase as any)
        .from("curso_lecciones")
        .select("*")
        .in("modulo_id", ids)
        .order("orden", { ascending: true });
      const grouped: Record<string, Leccion[]> = {};
      (l ?? []).forEach((x: any) => {
        (grouped[x.modulo_id] ||= []).push(x);
      });
      setLecciones(grouped);
    }
    setLoad(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.storage.from("tracea-recursos").list("", { limit: 100 });
      setArchivos((data ?? []).map((f) => f.name).filter((n) => !n.startsWith(".")));
    })();
  }, []);

  const refreshArchivos = async () => {
    const { data } = await supabase.storage.from("tracea-recursos").list("", { limit: 100 });
    setArchivos((data ?? []).map((f) => f.name).filter((n) => !n.startsWith(".")));
  };

  const subirArchivo = async (l: Leccion, file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Solo se permiten archivos PDF");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("El archivo excede 20 MB");
      return;
    }
    setUploadingLec(l.id);
    try {
      const existing = new Set(archivos);
      let nombre = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (existing.has(nombre)) {
        const ts = Date.now();
        const dot = nombre.lastIndexOf(".");
        nombre = dot > 0 ? `${nombre.slice(0, dot)}_${ts}${nombre.slice(dot)}` : `${nombre}_${ts}`;
      }
      const { error: upErr } = await supabase.storage
        .from("tracea-recursos")
        .upload(nombre, file, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      await refreshArchivos();
      const { error: dbErr } = await (supabase as any)
        .from("curso_lecciones")
        .update({ archivo_storage: nombre })
        .eq("id", l.id);
      if (dbErr) {
        toast.error(dbErr.message);
        return;
      }
      updLec(l.modulo_id, l.id, { archivo_storage: nombre });
      toast.success(`Archivo subido: ${nombre}`);
    } finally {
      setUploadingLec(null);
    }
  };

  if (loading) return null;
  if (!isSuperAdmin()) return <Navigate to="/" replace />;
  if (load) return <div className="p-6 text-sm text-muted-foreground">Cargando...</div>;
  if (!curso) return <div className="p-6">Curso no encontrado.</div>;

  const guardarCurso = async () => {
    const { error } = await (supabase as any)
      .from("cursos")
      .update({ titulo: curso.titulo, descripcion: curso.descripcion, activo: curso.activo })
      .eq("id", curso.id);
    if (error) toast.error(error.message); else toast.success("Curso guardado");
  };

  const agregarModulo = async () => {
    const nextOrden = (modulos[modulos.length - 1]?.orden ?? 0) + 1;
    const { error } = await (supabase as any)
      .from("curso_modulos")
      .insert({ curso_id: curso.id, titulo: "Nuevo módulo", orden: nextOrden });
    if (error) toast.error(error.message); else { toast.success("Módulo agregado"); fetchAll(); }
  };

  const guardarModulo = async (m: Modulo) => {
    const { error } = await (supabase as any)
      .from("curso_modulos")
      .update({ titulo: m.titulo, descripcion: m.descripcion, activo: m.activo, orden: m.orden })
      .eq("id", m.id);
    if (error) toast.error(error.message); else toast.success("Módulo guardado");
  };

  const eliminarModulo = async (mid: string) => {
    if (!confirm("¿Eliminar módulo y todas sus lecciones?")) return;
    const { error } = await (supabase as any).from("curso_modulos").delete().eq("id", mid);
    if (error) toast.error(error.message); else { toast.success("Módulo eliminado"); fetchAll(); }
  };

  const moverModulo = async (m: Modulo, dir: -1 | 1) => {
    const idx = modulos.findIndex((x) => x.id === m.id);
    const target = modulos[idx + dir];
    if (!target) return;
    await (supabase as any).from("curso_modulos").update({ orden: target.orden }).eq("id", m.id);
    await (supabase as any).from("curso_modulos").update({ orden: m.orden }).eq("id", target.id);
    fetchAll();
  };

  const agregarLeccion = async (m: Modulo) => {
    const ls = lecciones[m.id] ?? [];
    const nextOrden = (ls[ls.length - 1]?.orden ?? 0) + 1;
    const leccion_id = `${curso.norma === "NOM-241" ? "nom241" : "nom059"}-${m.orden}-${Date.now()}`;
    const { error } = await (supabase as any)
      .from("curso_lecciones")
      .insert({ modulo_id: m.id, leccion_id, titulo: "Nueva lección", tipo: "video", orden: nextOrden });
    if (error) toast.error(error.message); else { toast.success("Lección agregada"); fetchAll(); }
  };

  const guardarLeccion = async (l: Leccion) => {
    const { error } = await (supabase as any)
      .from("curso_lecciones")
      .update({
        titulo: l.titulo, tipo: l.tipo, url_video: l.url_video, archivo_storage: l.archivo_storage,
        proximamente: l.proximamente, activo: l.activo, orden: l.orden,
      })
      .eq("id", l.id);
    if (error) toast.error(error.message); else toast.success("Lección guardada");
  };

  const eliminarLeccion = async (lid: string) => {
    if (!confirm("¿Eliminar lección?")) return;
    const { error } = await (supabase as any).from("curso_lecciones").delete().eq("id", lid);
    if (error) toast.error(error.message); else { toast.success("Lección eliminada"); fetchAll(); }
  };

  const updLec = (mid: string, lid: string, patch: Partial<Leccion>) => {
    setLecciones((prev) => ({
      ...prev,
      [mid]: (prev[mid] ?? []).map((x) => (x.id === lid ? { ...x, ...patch } : x)),
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/cursos")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Volver a cursos
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Editar curso</CardTitle>
            <Badge variant="outline">{curso.norma}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={curso.titulo} onChange={(e) => setCurso({ ...curso, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={curso.descripcion} onChange={(e) => setCurso({ ...curso, descripcion: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={curso.activo} onCheckedChange={(v) => setCurso({ ...curso, activo: v })} />
            <Label>Activo</Label>
          </div>
          <Button onClick={guardarCurso}><Save className="h-4 w-4 mr-2" /> Guardar curso</Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Módulos</h2>
        <Button size="sm" onClick={agregarModulo}><Plus className="h-4 w-4 mr-2" /> Agregar módulo</Button>
      </div>

      {modulos.map((m, mi) => (
        <Card key={m.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <Input
                value={m.titulo}
                onChange={(e) => setModulos((prev) => prev.map((x) => x.id === m.id ? { ...x, titulo: e.target.value } : x))}
                className="font-medium"
              />
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" disabled={mi === 0} onClick={() => moverModulo(m, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={mi === modulos.length - 1} onClick={() => moverModulo(m, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => eliminarModulo(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={m.activo}
                onCheckedChange={(v) => setModulos((prev) => prev.map((x) => x.id === m.id ? { ...x, activo: v } : x))}
              />
              <Label>Activo</Label>
              <Button size="sm" variant="outline" onClick={() => guardarModulo(m)}>
                <Save className="h-3 w-3 mr-1" /> Guardar módulo
              </Button>
            </div>

            <div className="space-y-2 pl-2 border-l-2">
              {(lecciones[m.id] ?? []).map((l) => (
                <div key={l.id} className="border rounded-md p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Input
                      value={l.titulo}
                      onChange={(e) => updLec(m.id, l.id, { titulo: e.target.value })}
                      placeholder="Título"
                    />
                    <Button size="icon" variant="ghost" onClick={() => eliminarLeccion(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={l.tipo} onValueChange={(v) => updLec(m.id, l.id, { tipo: v as Leccion["tipo"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="descarga">Descarga</SelectItem>
                          <SelectItem value="practica">Práctica</SelectItem>
                          <SelectItem value="evaluacion">Evaluación</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">ID lección (no editar tras crear)</Label>
                      <Input value={l.leccion_id} disabled />
                    </div>
                  </div>
                  {l.tipo === "video" && (
                    <div>
                      <Label className="text-xs">URL de YouTube (no listado)</Label>
                      <Input
                        value={l.url_video ?? ""}
                        onChange={(e) => updLec(m.id, l.id, { url_video: e.target.value })}
                        placeholder="https://youtube.com/watch?v=..."
                      />
                    </div>
                  )}
                  {l.tipo === "descarga" && (
                    <div>
                      <Label className="text-xs">Archivo en bucket tracea-recursos</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={l.archivo_storage ?? ""}
                            onValueChange={(v) => updLec(m.id, l.id, { archivo_storage: v })}
                          >
                            <SelectTrigger><SelectValue placeholder="Seleccionar archivo" /></SelectTrigger>
                            <SelectContent>
                              {archivos.map((a) => (
                                <SelectItem key={a} value={a}>{a}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) subirArchivo(l, f);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={uploadingLec === l.id}
                            asChild
                          >
                            <span className="cursor-pointer">
                              <Upload className="h-3 w-3 mr-1" />
                              {uploadingLec === l.id ? "Subiendo..." : "Subir PDF"}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={l.proximamente} onCheckedChange={(v) => updLec(m.id, l.id, { proximamente: v })} />
                      <Label className="text-xs">Próximamente</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={l.activo} onCheckedChange={(v) => updLec(m.id, l.id, { activo: v })} />
                      <Label className="text-xs">Activa</Label>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => guardarLeccion(l)}>
                      <Save className="h-3 w-3 mr-1" /> Guardar
                    </Button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => agregarLeccion(m)}>
                <Plus className="h-4 w-4 mr-2" /> Agregar lección
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}