import { useEffect, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ArrowDownUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export interface RiesgoOrdenable {
  id: string;
  numero_id: number;
  peligro?: string | null;
  peligro_modo_falla?: string | null;
  etapa_proceso?: string | null;
}

function Fila({ r, pos }: { r: RiesgoOrdenable; pos: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: r.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const cambia = pos !== r.numero_id;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-2"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label={`Mover riesgo ${r.numero_id}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="font-mono text-xs font-bold w-16 shrink-0">
        {String(r.numero_id).padStart(2, "0")}
        {cambia && (
          <span className="text-primary"> → {String(pos).padStart(2, "0")}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">
          {r.peligro || r.peligro_modo_falla || "Sin capturar"}
        </p>
        {r.etapa_proceso && (
          <p className="truncate text-[10px] text-muted-foreground">{r.etapa_proceso}</p>
        )}
      </div>
    </div>
  );
}

export default function ReordenarRiesgosDialog({
  open, onClose, folioId, riesgos,
}: {
  open: boolean;
  onClose: () => void;
  folioId: string;
  riesgos: RiesgoOrdenable[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<RiesgoOrdenable[]>(riesgos);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) setItems([...riesgos].sort((a, b) => a.numero_id - b.numero_id));
  }, [open, riesgos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((x) => x.id === active.id);
      const to = prev.findIndex((x) => x.id === over.id);
      return arrayMove(prev, from, to);
    });
  };

  const hayCambios = items.some((r, i) => r.numero_id !== i + 1);

  const guardar = async () => {
    setGuardando(true);
    const { error } = await supabase.rpc("reordenar_riesgos", {
      p_folio_id: folioId,
      p_orden: items.map((r) => r.id),
    });
    setGuardando(false);
    if (error) {
      toast({ title: "No se pudo reordenar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Id reasignados", description: "Los riesgos quedaron numerados 01 a " + String(items.length).padStart(2, "0") + "." });
    queryClient.invalidateQueries({ queryKey: ["folio", folioId] });
    queryClient.invalidateQueries({ queryKey: ["all-riesgos"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowDownUp className="h-4 w-4 text-primary" />
            Reordenar Id de riesgos
          </DialogTitle>
          <DialogDescription className="text-xs">
            Arrastra las filas para dejar el orden lógico o cronológico del análisis.
            Al guardar, los Id se reasignan 01 a {String(items.length).padStart(2, "0")}.
            Esto solo es posible mientras el folio esté en Borrador; al enviarlo a firma
            los Id quedan fijos.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {items.map((r, i) => (
                <Fila key={r.id} r={r} pos={i + 1} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? "Guardando…" : "Guardar orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
