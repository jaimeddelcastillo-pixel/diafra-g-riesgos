import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface UsuarioADesactivar { id: string; nombre: string; email?: string | null }

/** Diálogo único de desactivación (motivo obligatorio) → función delete-user. */
export function DesactivarUsuarioDialog({ open, onOpenChange, target, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: UsuarioADesactivar | null;
  onDone?: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: async ({ user_id, motivo }: { user_id: string; motivo: string }) => {
      const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id, motivo } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Usuario desactivado.");
      setMotivo("");
      onOpenChange(false);
      onDone?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Desactivar usuario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            ¿Confirmas desactivar a <strong>{target?.nombre}</strong>{target?.email ? ` (${target.email})` : ""}?
          </p>
          <p className="text-xs text-muted-foreground">
            La persona ya no podrá entrar. Su nombre se conserva en todos los registros que creó, firmó o validó.
          </p>
          <div className="space-y-1">
            <Label htmlFor="motivo-desactivar">Motivo *</Label>
            <Textarea id="motivo-desactivar" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} placeholder="Ej. Baja de la empresa" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => target && m.mutate({ user_id: target.id, motivo: motivo.trim() })}
            disabled={m.isPending || !motivo.trim()}
          >
            {m.isPending ? "Desactivando…" : "Desactivar usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
