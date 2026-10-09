import { CerebroPage } from "@/components/cerebro/CerebroPage";
import { ListaConocimiento } from "@/components/cerebro/ListaConocimiento";
import { useBrainKnowledge } from "@/hooks/useBrain";

export default function CerebroConocimiento() {
  const { data: items = [], isLoading } = useBrainKnowledge();

  return (
    <CerebroPage
      titulo="Conocimiento"
      descripcion="Todo el conocimiento capturado, con su tipo y estado de validación."
    >
      {isLoading ? null : (
        <ListaConocimiento items={items as any[]} vacio="Todavía no hay conocimiento capturado." />
      )}
    </CerebroPage>
  );
}
