import { Bot, Wand2, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useOnboardingTextos } from "./useOnboardingTextos";

interface Props {
  onCompletar: (modo: "asistente" | "wizard" | "explorar") => void;
  onSaltar: () => void;
}

export function Paso3PrimerFolio({ onCompletar, onSaltar }: Props) {
  const navigate = useNavigate();
  const { normaCorta } = useOnboardingTextos();

  const mensajeAsistente = `Hola, soy nuevo en TRACEA. Ayúdame a crear mi primer análisis de riesgo conforme a ${normaCorta}. Guíame desde el inicio.`;

  const elegirAsistente = () => {
    onCompletar("asistente");
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("tracea:open-assistant", {
          detail: { mensajeInicial: mensajeAsistente },
        }),
      );
    }, 200);
  };

  const elegirWizard = () => {
    onCompletar("wizard");
    navigate("/folios?wizard=1");
  };

  const elegirExplorar = () => {
    onCompletar("explorar");
    navigate("/riesgos");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 animate-in fade-in-0 duration-200">
      <div className="bg-background rounded-lg shadow-2xl max-w-3xl w-full p-6 md:p-8 animate-in zoom-in-95 fade-in-0 duration-300">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold" style={{ color: "#042C53" }}>
            Crea tu primer análisis de riesgo
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Un folio es el expediente de un proceso de tu empresa. Vamos a crear uno ahora.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <CardOpcion
            icon={Bot}
            titulo="Con el Asistente IA"
            texto="El Asistente te guía paso a paso. Solo responde sus preguntas."
            botonLabel="Comenzar con el Asistente"
            onClick={elegirAsistente}
            destacado
          />
          <CardOpcion
            icon={Wand2}
            titulo="Con el Wizard"
            texto="Responde preguntas simples y el sistema construye tu análisis."
            botonLabel="Abrir Wizard"
            onClick={elegirWizard}
          />
          <CardOpcion
            icon={Compass}
            titulo="Explorar por mi cuenta"
            texto="Prefiero explorar primero."
            botonLabel="Ir al Tablero"
            onClick={elegirExplorar}
            variant="outline"
          />
        </div>

        <div className="text-center mt-6">
          <Button variant="ghost" size="sm" onClick={onSaltar} className="text-xs text-muted-foreground">
            Saltar por ahora
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardOpcion({
  icon: Icon,
  titulo,
  texto,
  botonLabel,
  onClick,
  destacado = false,
  variant = "default",
}: {
  icon: any;
  titulo: string;
  texto: string;
  botonLabel: string;
  onClick: () => void;
  destacado?: boolean;
  variant?: "default" | "outline";
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border-2 p-4 transition-all hover:shadow-md ${
        destacado ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center mb-3"
        style={{ background: destacado ? "#042C53" : "#185FA5", color: "white" }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-bold text-sm mb-1">{titulo}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{texto}</p>
      <Button
        size="sm"
        variant={variant}
        onClick={onClick}
        className="mt-4 w-full"
        style={variant === "default" ? { background: destacado ? "#042C53" : "#185FA5" } : undefined}
      >
        {botonLabel}
      </Button>
    </div>
  );
}