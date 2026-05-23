import { Button } from "@/components/ui/button";
import { useOnboardingTextos } from "./useOnboardingTextos";

interface Props {
  onComenzar: () => void;
  onSaltar: () => void;
}

export function Paso1Bienvenida({ onComenzar, onSaltar }: Props) {
  const { normaLabel, nombre } = useOnboardingTextos();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in-0 duration-200">
      <div className="bg-background rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 fade-in-0 duration-300">
        {/* Header Navy */}
        <div
          className="px-6 py-8 text-center text-white"
          style={{ background: "linear-gradient(135deg, #042C53 0%, #185FA5 100%)" }}
        >
          <div className="mx-auto h-14 w-14 mb-3">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14">
              <rect x="1" y="1" width="17" height="17" rx="3" fill="white" fillOpacity="0.15" />
              <rect x="22" y="1" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="1" y="22" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="22" y="22" width="17" height="17" rx="3" fill="#8587E8" />
              <path d="M18 18L22 22" stroke="#8587E8" strokeWidth="2" strokeDasharray="2.5 2" strokeLinecap="round" />
              <path d="M27 30.5L30.5 34L36 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-wide">
            Bienvenido a TRACEA{nombre ? `, ${nombre}` : ""}
          </h2>
          <p className="text-sm text-white/80 mt-2">
            Tu sistema de Gestión de Riesgos conforme a {normaLabel} está listo.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            En los próximos minutos te guiaremos para crear tu primer análisis de riesgo.
            Si en algún momento tienes dudas, el <strong>Asistente IA</strong> está disponible
            para ayudarte.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={onComenzar} className="w-full" size="lg">
              Comenzar →
            </Button>
            <Button onClick={onSaltar} variant="ghost" className="w-full text-muted-foreground">
              Saltar por ahora
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}