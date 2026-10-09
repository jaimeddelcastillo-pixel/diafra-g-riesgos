import { useState } from "react";
import { CerebroPage } from "@/components/cerebro/CerebroPage";
import { ListaConocimiento } from "@/components/cerebro/ListaConocimiento";
import { useBrainKnowledge } from "@/hooks/useBrain";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const PENDIENTES = ["por_validar", "contradictorio", "capturado"];

export default function CerebroValidacion() {
  const { data: items = [], isLoading } = useBrainKnowledge();
  const [soloRevision, setSoloRevision] = useState(false);
  const conRevision = (items as any[]).filter((i) => i.requiere_revision).length;

  return (
    <CerebroPage
      titulo="Validación"
      descripcion="Conocimiento que requiere revisión y decisión de gobernanza."
    >
      <div className="flex items-center gap-2">
        <Switch id="filtro-revision" checked={soloRevision} onCheckedChange={setSoloRevision} />
        <Label htmlFor="filtro-revision" className="text-sm">Requiere revisión ({conRevision})</Label>
      </div>
      {isLoading ? null : (
        <ListaConocimiento
          key={soloRevision ? "revision" : "pendientes"}
          items={items as any[]}
          filtroBase={soloRevision ? (i) => !!i.requiere_revision : (i) => PENDIENTES.includes(i.estado)}
          vacio={soloRevision ? "No hay conocimiento que requiera revisión." : "No hay conocimiento pendiente de validación."}
          modo="validacion"
        />
      )}
    </CerebroPage>
  );
}
