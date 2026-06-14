import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MOTIVOS_CANCELACION,
  type MotivoCancelacionCodigo,
} from "@/config/motivos-cancelacion";

type Modo = "borrador_intermedio" | "avanzado" | "delete_fisico";

interface Props {
  open: boolean;
  onClose: () => void;
  folioId: string;
  folioCodigo: string;
  /**
   * borrador_intermedio = se convertirá en CANCELADO (RPC)
   * avanzado            = folio En Firma / Aprobado / Cerrado → CANCELADO (RPC, requiere Admin/RS)
   * delete_fisico       = último Borrador → DELETE físico + recicla contador
   */
  modo: Modo;
  onSuccess: () => void;
}

export function CancelarFolioDialog({
  open,
  onClose,
  folioId,
  folioCodigo,
  modo,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [codigo, setCodigo] = useState<MotivoCancelacionCodigo>("error_creacion");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCodigo("error_creacion");
    setTexto("");
    setSaving(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleConfirmar = async () => {
    if (codigo === "otro" && texto.trim().length < 5) {
      toast({
        title: "Describe el motivo",
        description: "Cuando seleccionas 'Otro' debes escribir al menos 5 caracteres.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (modo === "delete_fisico") {
        // Borrador y es el último número emitido → eliminar físicamente.
        // El trigger reciclar_folio_sequence decrementa el contador.
        const { error } = await supabase.from("folios").delete().eq("id", folioId);
        if (error) throw error;
        toast({
          title: "Folio eliminado",
          description: `${folioCodigo} fue eliminado y el contador se recicló.`,
        });
      } else {
        const { error } = await supabase.rpc("cancelar_folio" as any, {
          p_folio_id: folioId,
          p_motivo_codigo: codigo,
          p_motivo_texto: texto.trim() || null,
        });
        if (error) throw error;
        toast({
          title: "Folio cancelado",
          description: `${folioCodigo} quedó marcado como CANCELADO en el historial.`,
        });
      }
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: "No se pudo procesar la cancelación",
        description: err?.message ?? "Error desconocido",
        variant: "destructive",
      });
      setSaving(false);
    }
  };

  const titulo =
    modo === "delete_fisico"
      ? `Eliminar folio ${folioCodigo}`
      : `Cancelar folio ${folioCodigo}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modo === "avanzado" ? (
              <span className="text-destructive">🔴</span>
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            {titulo}
          </DialogTitle>
          <DialogDescription>
            ¿Por qué se cancela este folio? El motivo queda registrado en el
            expediente y en la bitácora de auditoría.
          </DialogDescription>
        </DialogHeader>

        {/* Advertencia según modo */}
        {modo === "borrador_intermedio" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            ⚠️ Este folio quedará como <strong>CANCELADO</strong> y será visible en el
            historial. No se eliminará — podrás imprimirlo como evidencia ante auditoría.
          </div>
        )}
        {modo === "avanzado" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            🔴 Estás cancelando un folio que ya fue procesado. Esta acción requiere
            justificación y queda registrada en el expediente regulatorio de la
            organización. Solo procede si tienes autorización del Responsable Sanitario.
          </div>
        )}
        {modo === "delete_fisico" && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Este folio es el <strong>último número emitido</strong> y está en Borrador.
            Al eliminarlo, el contador regresa y el siguiente folio reutilizará{" "}
            <span className="font-mono">{folioCodigo}</span>. El motivo quedará en la
            bitácora.
          </div>
        )}

        {/* Motivos */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Motivo</Label>
          <RadioGroup
            value={codigo}
            onValueChange={(v) => setCodigo(v as MotivoCancelacionCodigo)}
            className="space-y-1.5"
          >
            {MOTIVOS_CANCELACION.map((m) => (
              <div key={m.codigo} className="flex items-start gap-2">
                <RadioGroupItem
                  value={m.codigo}
                  id={`motivo-${m.codigo}`}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`motivo-${m.codigo}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {m.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {codigo === "otro" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Descripción del motivo *</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Describe brevemente la razón…"
              rows={3}
              autoFocus
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={saving}
            className="gap-2"
          >
            {modo === "delete_fisico" ? (
              <Trash2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {saving
              ? "Procesando…"
              : modo === "delete_fisico"
                ? "Sí, eliminar"
                : "Confirmar cancelación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}