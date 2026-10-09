import { CerebroPage } from "@/components/cerebro/CerebroPage";
import { ListaConocimiento } from "@/components/cerebro/ListaConocimiento";
import { useBrainKnowledge } from "@/hooks/useBrain";

const PENDIENTES = ["por_validar", "contradictorio", "capturado"];

export default function CerebroValidacion() {
  const { data: items = [], isLoading } = useBrainKnowledge();

  return (
    <CerebroPage
      titulo="Validación"
      descripcion="Conocimiento que requiere revisión y decisión de gobernanza."
    >
      {isLoading ? null : (
        <ListaConocimiento
          items={items as any[]}
          filtroBase={(i) => PENDIENTES.includes(i.estado)}
          vacio="No hay conocimiento pendiente de validación."
          modo="validacion"
        />
      )}
    </CerebroPage>
  );
}
