import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Bell, Pencil, Plus, UserPlus } from "lucide-react";
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
};

const rolStyles: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive",
  operador: "bg-primary/10 text-primary",
  comite_tecnico: "bg-accent/10 text-accent",
  lectura: "bg-muted text-muted-foreground",
};

interface UserWithRole {
  id: string;
  nombre: string;
  email: string;
  cargo: string | null;
  role: AppRole;
}

export default function Configuracion() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const queryClient = useQueryClient();

  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", cargo: "", role: "" as AppRole });
  const [dialogOpen, setDialogOpen] = useState(false);

  // New user dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    email: "",
    password: "",
    nombre: "",
    cargo: "",
    role: "operador" as AppRole,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, nombre, email, cargo")
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
        role: roleMap.get(p.id) || ("lectura" as AppRole),
      }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nombre, cargo, role }: { id: string; nombre: string; cargo: string; role: AppRole }) => {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ nombre, cargo })
        .eq("id", id);
      if (pErr) throw pErr;

      const { error: dErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", id);
      if (dErr) throw dErr;

      const { error: iErr } = await supabase
        .from("user_roles")
        .insert({ user_id: id, role });
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Usuario actualizado");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async (form: typeof newForm) => {
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Usuario creado exitosamente. Se ha enviado un correo de confirmación.");
      setNewDialogOpen(false);
      setNewForm({ email: "", password: "", nombre: "", cargo: "", role: "operador" });
    },
    onError: (e: any) => toast.error(e.message || "Error al crear usuario"),
  });

  const openEdit = (u: UserWithRole) => {
    setEditUser(u);
    setEditForm({ nombre: u.nombre, cargo: u.cargo || "", role: u.role });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id,
      nombre: editForm.nombre,
      cargo: editForm.cargo,
      role: editForm.role,
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
    createMutation.mutate(newForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-muted-foreground">Gestión de usuarios, roles y notificaciones</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Nuevo Usuario
          </Button>
        )}
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
