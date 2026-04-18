import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Building2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Org {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  activo: boolean;
  max_users: number;
  trial_expires_at: string | null;
  created_at: string;
}

const planLabels: Record<string, string> = {
  trial: "Trial",
  pro: "Pro",
  enterprise: "Enterprise",
};

const planStyles: Record<string, string> = {
  trial: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pro: "bg-blue-100 text-blue-800 border-blue-200",
  enterprise: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function Admin() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [editForm, setEditForm] = useState({ plan: "", trial_expires_at: "", max_users: 5 });
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!isSuperAdmin()) return <Navigate to="/" replace />;

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data as Org[];
    },
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      toast.success("Estado actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateOrgMutation = useMutation({
    mutationFn: async ({
      id, plan, trial_expires_at, max_users,
    }: { id: string; plan: string; trial_expires_at: string | null; max_users: number }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ plan, trial_expires_at, max_users })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      toast.success("Organización actualizada");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (org: Org) => {
    setEditOrg(org);
    setEditForm({
      plan: org.plan,
      trial_expires_at: org.trial_expires_at ? org.trial_expires_at.slice(0, 10) : "",
      max_users: org.max_users,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editOrg) return;
    updateOrgMutation.mutate({
      id: editOrg.id,
      plan: editForm.plan,
      trial_expires_at: editForm.trial_expires_at
        ? new Date(editForm.trial_expires_at + "T23:59:59").toISOString()
        : null,
      max_users: Math.max(1, Number(editForm.max_users)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm text-muted-foreground">Gestión global de organizaciones — solo super admin</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organizaciones ({orgs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay organizaciones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 font-medium text-muted-foreground">Organización</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Slug</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Trial expira</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Máx. usuarios</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Activo</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => {
                    const trialVencido =
                      org.plan === "trial" &&
                      org.trial_expires_at !== null &&
                      new Date(org.trial_expires_at) < new Date();
                    return (
                      <tr key={org.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{org.nombre}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{org.slug}</td>
                        <td className="py-2">
                          <Badge className={`text-[10px] ${planStyles[org.plan] ?? "bg-muted text-muted-foreground"}`}>
                            {planLabels[org.plan] ?? org.plan}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs">
                          {org.trial_expires_at ? (
                            <span className={trialVencido ? "text-destructive font-medium" : "text-muted-foreground"}>
                              {new Date(org.trial_expires_at).toLocaleDateString("es-MX")}
                              {trialVencido && " ⚠ Vencido"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 text-center text-muted-foreground">{org.max_users}</td>
                        <td className="py-2">
                          <Switch
                            checked={org.activo}
                            onCheckedChange={(v) => toggleActivoMutation.mutate({ id: org.id, activo: v })}
                          />
                        </td>
                        <td className="py-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(org)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar — {editOrg?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan</label>
              <Select
                value={editForm.plan}
                onValueChange={(v) => setEditForm((f) => ({ ...f, plan: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(planLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Trial expira</label>
              <Input
                type="date"
                value={editForm.trial_expires_at}
                onChange={(e) => setEditForm((f) => ({ ...f, trial_expires_at: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Solo aplica si el plan es Trial. Dejar vacío para sin vencimiento.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Límite de usuarios</label>
              <Input
                type="number"
                min={1}
                value={editForm.max_users}
                onChange={(e) => setEditForm((f) => ({ ...f, max_users: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateOrgMutation.isPending}>
              {updateOrgMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
