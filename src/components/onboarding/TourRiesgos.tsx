import { useState } from "react";
import type { TourProps } from "@/modules/tipos";
import { Paso1Bienvenida } from "./Paso1Bienvenida";
import { Paso2Tour } from "./Paso2Tour";
import { Paso3PrimerFolio } from "./Paso3PrimerFolio";

/** Tour original de Riesgos (bienvenida, recorrido y primer folio), sin cambios de texto. */
export function TourRiesgos({ onTerminar, onSaltar }: TourProps) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  if (paso === 1) return <Paso1Bienvenida onComenzar={() => setPaso(2)} onSaltar={onSaltar} />;
  if (paso === 2) return <Paso2Tour onFinish={() => setPaso(3)} onSaltar={onSaltar} />;
  return (
    <Paso3PrimerFolio
      onCompletar={(modo) => {
        if (modo === "asistente" || modo === "wizard") {
          localStorage.setItem("tracea_onboarding_first_folio_at", String(Date.now()));
        }
        onTerminar();
      }}
      onSaltar={onSaltar}
    />
  );
}
