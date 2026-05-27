import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, Trash2, Pencil, Plus, FileText, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface ArchivoRow {
  id: string;
  producto: string;
  nombre: string;
  descripcion: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  orden: number;
  activo: boolean;
  created_at: string;
}

const PRODUCTO = "protocolos";

function formatSize(b: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminProtocolos() {
  const { isSuperAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<ArchivoRow | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formOrden, setFormOrden] = useState(0);

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const { data: archivos } = useQuery<ArchivoRow[]>({
    queryKey: ["admin-addon-archivos", PRODUCTO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_archivos")
        .select("*")
        .eq("producto", PRODUCTO)
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data as ArchivoRow[]) ?? [];
    },
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${PRODUCTO}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("addon-protocolos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const nextOrden = (archivos?.length ?? 0) + 1;
      const { error: insErr } = await supabase.from("addon_archivos").insert({
        producto: PRODUCTO,
        nombre: file.name,
        descripcion: "",
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        orden: nextOrden,
        activo: true,
      });
      if (insErr) throw insErr;

      toast.success(`${file.name} subido`);
      qc.invalidateQueries({ queryKey: ["admin-addon-archivos", PRODUCTO] });
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  const deleteMut = useMutation({
    mutationFn: async (row: ArchivoRow) => {
      await supabase.storage.from("addon-protocolos").remove([row.storage_path]);
      const { error } = await supabase.from("addon_archivos").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Archivo eliminado");
      qc.invalidateQueries({ queryKey: ["admin-addon-archivos", PRODUCTO] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const toggleMut = useMutation({
    mutationFn: async (row: ArchivoRow) => {
      const { error } = await supabase
        .from("addon_archivos")
        .update({ activo: !row.activo })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-addon-archivos", PRODUCTO] }),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("addon_archivos")
        .update({ nombre: formNombre, descripcion: formDescripcion, orden: formOrden })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Actualizado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-addon-archivos", PRODUCTO] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  function openEdit(row: ArchivoRow) {
    setEditing(row);
    setFormNombre(row.nombre);
    setFormDescripcion(row.descripcion);
    setFormOrden(row.orden);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Catálogo: Protocolos de Validación
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Archivos que recibirán las organizaciones que compren el addon "protocolos".
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Subir archivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Acepta PDF, Word (.doc, .docx). Sube de uno en uno.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archivos del catálogo ({archivos?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!archivos || archivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin archivos todavía.</p>
          ) : (
            archivos.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 border rounded-md">
                <div className="text-xs font-mono text-muted-foreground w-8 text-center">
                  {a.orden}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.nombre}</p>
                  {a.descripcion && (
                    <p className="text-xs text-muted-foreground truncate">{a.descripcion}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {a.mime_type ?? "—"} · {formatSize(a.size_bytes)}
                  </p>
                </div>
                {!a.activo && <Badge variant="secondary" className="text-[10px]">Oculto</Badge>}
                <Button size="icon" variant="ghost" onClick={() => toggleMut.mutate(a)} title={a.activo ? "Ocultar" : "Mostrar"}>
                  {a.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`¿Eliminar "${a.nombre}"? Esta acción no se puede deshacer.`)) {
                      deleteMut.mutate(a);
                    }
                  }}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar archivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre (visible al cliente)</Label>
              <Input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formDescripcion}
                onChange={(e) => setFormDescripcion(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Orden</Label>
              <Input
                type="number"
                value={formOrden}
                onChange={(e) => setFormOrden(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}