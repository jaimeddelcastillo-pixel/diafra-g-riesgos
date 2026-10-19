// Copia de EliminarRegistroZona (atdiafra). En TRACEA retira (no borra) registro y semanas con motivo y auditoría.
import { useState } from "react";
import { Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export default function ZonaPeligro({ registroId, nombre, codigoInstrumento, onRetirado }: { registroId: string; nombre: string; codigoInstrumento: string | null; onRetirado: () => void }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const codigo = (codigoInstrumento ?? "RETIRAR").trim().toUpperCase();
  const ok = texto.trim().toUpperCase() === codigo && !!motivo.trim();

  const confirmar = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("tend_retirar_registro_completo", { _id: registroId, _motivo: motivo.trim(), _confirmacion: texto.trim() });
      if (error) throw error;
      toast.success(`Registro retirado con ${data ?? 0} semana(s); queda en el historial de retiros`);
      setOpen(false);
      onRetirado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-8 rounded-lg border border-destructive/40 p-4">
      <h3 className="text-sm font-semibold text-destructive">Zona de peligro</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Retira el registro completo con todas sus semanas (no se borra: queda en el historial con motivo y auditoría). Para quitar solo una semana usa «Retirar semana».
      </p>
      <Button size="sm" variant="outline" className="mt-3 gap-1 text-destructive hover:text-destructive"
        onClick={() => { setTexto(""); setMotivo(""); setOpen(true); }}>
        <Trash className="h-4 w-4" /> Retirar registro completo
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar registro completo</DialogTitle>
            <DialogDescription>
              Se retirarán <b>todas las semanas</b> de «{nombre}». Si alguna semana está en un AT emitido no se permitirá. Escribe <b>{codigo}</b> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Motivo del retiro" placeholder="Motivo obligatorio" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Input aria-label="Código de confirmación" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={codigo} autoFocus />
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!ok || busy} onClick={() => void confirmar()}>{busy ? "Retirando…" : "Retirar registro"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
