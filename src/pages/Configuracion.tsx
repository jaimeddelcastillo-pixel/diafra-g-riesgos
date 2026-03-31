import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Bell, Pencil, UserPlus, Upload, X, KeyRound, Lock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  comite_tecnico: "Comité Técnico",
  operador: "Operador",
  lectura: "Lectura",
  responsable_sanitario: "Responsable Sanitario",
};

const rolStyles: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive",
  operador: "bg-primary/10 text-primary",
  comite_tecnico: "bg-accent/10 text-accent",
  lectura: "bg-muted text-muted-foreground",
  responsable_sanitario: "bg-destructive/10 text-destructive",
};

interface UserWithRole {
  id: string;
  nombre: string;
  email: string;
  cargo: string | null;
  firma_url: string | null;
  role: AppRole;
}

// Standard signature size: 200x80px
const FIRMA_WIDTH = 200;
const FIRMA_HEIGHT = 80;

function getPublicFirmaUrl(path: string) {
  const { data } = supabase.storage.from("firmas").getPublicUrl(path);
  return data.publicUrl;
}

async function uploadFirma(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/firma.${ext}`;

  // Resize image to standard size using canvas
  const resizedBlob = await resizeImage(file, FIRMA_WIDTH, FIRMA_HEIGHT);

  const { error } = await supabase.storage
    .from("firmas")
    .upload(path, resizedBlob, { upsert: true, contentType: "image/png" });
  if (error) throw error;
  return path;
}

function resizeImage(file: File, maxW: number, maxH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = maxW;
      canvas.height = maxH;
      const ctx = canvas.getContext("2d")!;
      // Clear with transparent background
      ctx.clearRect(0, 0, maxW, maxH);
      // Scale proportionally and center
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (maxW - w) / 2;
      const y = (maxH - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to resize image"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

function FirmaUpload({
  currentUrl,
  onFileSelect,
  previewFile,
}: {
  currentUrl: string | null;
  onFileSelect: (file: File | null) => void;
  previewFile: File | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen (PNG, JPG)");
      return;
    }
    onFileSelect(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const displayUrl = previewSrc || (currentUrl ? getPublicFirmaUrl(currentUrl) : null);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Firma (PNG transparente)</label>
      <div className="flex items-center gap-3">
        <div
          className="w-[200px] h-[80px] border-2 border-dashed rounded flex items-center justify-center bg-muted/30 cursor-pointer overflow-hidden"
          onClick={() => inputRef.current?.click()}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Firma"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center text-muted-foreground text-xs">
              <Upload className="h-5 w-5 mx-auto mb-1" />
              Subir firma
            </div>
          )}
        </div>
        {(previewSrc || currentUrl) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              onFileSelect(null);
              setPreviewSrc(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <p className="text-[10px] text-muted-foreground">
        Se redimensionará a {FIRMA_WIDTH}×{FIRMA_HEIGHT}px con fondo transparente.
      </p>
    </div>
  );
}

export default function Configuracion() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("responsable_sanitario");
  const queryClient = useQueryClient();

  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", cargo: "", role: "" as AppRole });
  const [editFirmaFile, setEditFirmaFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    email: "",
    password: "",
    nombre: "",
    cargo: "",
    role: "operador" as AppRole,
  });
  const [newFirmaFile, setNewFirmaFile] = useState<File | null>(null);

  // Change own password state
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  // Admin reset password state
  const [resetPwDialogOpen, setResetPwDialogOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<UserWithRole | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [resetPwLoading, setResetPwLoading] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, nombre, email, cargo, firma_url")
        .order("nombre");
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      const roleMap = new Map<string, AppRole>();
      roles?.forEach((r) => roleMap.set(r.user_id, r.role as AppRole));

      return (profiles || []).map((p) => ({
        ...p,
        firma_url: (p as any).firma_url || null,
        role: roleMap.get(p.id) || ("lectura" as AppRole),
      }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nombre, cargo, role, firmaFile }: { id: string; nombre: string; cargo: string; role: AppRole; firmaFile: File | null }) => {
      let firma_url: string | undefined;
      if (firmaFile) {
        firma_url = await uploadFirma(firmaFile, id);
      }

      const updateData: any = { nombre, cargo };
      if (firma_url) updateData.firma_url = firma_url;

      const { error: pErr } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", id);
      if (pErr) throw pErr;

      const { error: rErr } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", id);
      if (rErr) throw rErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Usuario actualizado");
      setDialogOpen(false);
      setEditFirmaFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async (form: typeof newForm & { firmaFile: File | null }) => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          cargo: form.cargo,
          role: form.role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Upload signature if provided
      if (form.firmaFile && data?.user?.id) {
        const firmaPath = await uploadFirma(form.firmaFile, data.user.id);
        await supabase
          .from("profiles")
          .update({ firma_url: firmaPath } as any)
          .eq("id", data.user.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Usuario creado exitosamente. Se ha enviado un correo de confirmación.");
      setNewDialogOpen(false);
      setNewForm({ email: "", password: "", nombre: "", cargo: "", role: "operador" });
      setNewFirmaFile(null);
    },
    onError: (e: any) => toast.error(e.message || "Error al crear usuario"),
  });

  const openEdit = (u: UserWithRole) => {
    setEditUser(u);
    setEditForm({ nombre: u.nombre, cargo: u.cargo || "", role: u.role });
    setEditFirmaFile(null);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id,
      nombre: editForm.nombre,
      cargo: editForm.cargo,
      role: editForm.role,
      firmaFile: editFirmaFile,
    });
  };

  const handleCreate = () => {
    if (!newForm.email || !newForm.password || !newForm.nombre) {
      toast.error("Completa los campos obligatorios: Nombre, Correo y Contraseña");
      return;
    }
    if (newForm.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    createMutation.mutate({ ...newForm, firmaFile: newFirmaFile });
  };

  // Change own password
  const handleChangePassword = async () => {
    if (!pwForm.newPw || !pwForm.confirm) {
      toast.error("Completa todos los campos");
      return;
    }
    if (pwForm.newPw.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    setPwLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Contraseña actualizada correctamente");
      setPwDialogOpen(false);
      setPwForm({ current: "", newPw: "", confirm: "" });
    }
  };

  // Admin reset password for another user
  const handleResetPassword = async () => {
    if (!resetPwUser || !resetPwValue) return;
    if (resetPwValue.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setResetPwLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: resetPwUser.id, new_password: resetPwValue },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Contraseña de ${resetPwUser.nombre} actualizada`);
      setResetPwDialogOpen(false);
      setResetPwValue("");
      setResetPwUser(null);
    } catch (e: any) {
      toast.error(e.message || "Error al resetear contraseña");
    }
    setResetPwLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-muted-foreground">Gestión de usuarios, roles y notificaciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPwDialogOpen(true)} className="gap-2">
            <Lock className="h-4 w-4" /> Cambiar mi Contraseña
          </Button>
          {isAdmin && (
            <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Nuevo Usuario
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Usuarios del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Correo</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Cargo</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Firma</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Rol</th>
                  {isAdmin && <th className="text-left pb-2 font-medium text-muted-foreground">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{u.nombre}</td>
                    <td className="py-2 text-muted-foreground">{u.email}</td>
                    <td className="py-2 text-muted-foreground">{u.cargo || "—"}</td>
                    <td className="py-2">
                      {u.firma_url ? (
                        <img
                          src={getPublicFirmaUrl(u.firma_url)}
                          alt="Firma"
                          className="h-8 w-auto object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">Sin firma</span>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge className={`text-[10px] ${rolStyles[u.role]}`}>
                        {roleLabels[u.role]}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="py-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Alertas Configuradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Las alertas de correo automático se activarán próximamente.
          </p>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={editForm.nombre}
                onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cargo</label>
              <Input
                value={editForm.cargo}
                onChange={(e) => setEditForm((f) => ({ ...f, cargo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rol</label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as AppRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FirmaUpload
              currentUrl={editUser?.firma_url || null}
              onFileSelect={setEditFirmaFile}
              previewFile={editFirmaFile}
            />
            <p className="text-xs text-muted-foreground">Correo: {editUser?.email}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Nombre completo *</label>
              <Input
                value={newForm.nombre}
                onChange={(e) => setNewForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Juan Pérez López"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Correo electrónico *</label>
              <Input
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contraseña temporal *</label>
              <Input
                type="password"
                value={newForm.password}
                onChange={(e) => setNewForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cargo</label>
              <Input
                value={newForm.cargo}
                onChange={(e) => setNewForm((f) => ({ ...f, cargo: e.target.value }))}
                placeholder="Ej. Jefe de Calidad"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rol</label>
              <Select
                value={newForm.role}
                onValueChange={(v) => setNewForm((f) => ({ ...f, role: v as AppRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FirmaUpload
              currentUrl={null}
              onFileSelect={setNewFirmaFile}
              previewFile={newFirmaFile}
            />
            <p className="text-xs text-muted-foreground">
              Se enviará un correo de confirmación al usuario para que verifique su cuenta.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
