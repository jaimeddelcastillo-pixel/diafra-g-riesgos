import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useOnboardingTextos } from "./useOnboardingTextos";
import { EVENTO_ABRIR_GRUPO } from "@/components/AppSidebar";

interface Props {
  onFinish: () => void;
  onSaltar: () => void;
}

interface PasoTour {
  selector: string;
  titulo: string;
  texto: string;
}

export function Paso2Tour({ onFinish, onSaltar }: Props) {
  const { normaCorta } = useOnboardingTextos();

  const pasos: PasoTour[] = [
    {
      selector: '[data-onboarding="folios"]',
      titulo: "Mis Folios",
      texto: "Aquí viven tus análisis de riesgo. Cada folio corresponde a un proceso de tu empresa.",
    },
    {
      selector: '[data-onboarding="capacitacion"]',
      titulo: "Capacitación",
      texto: "Encuentra guías, PNOs y el curso de certificación con constancia DC-3.",
    },
    {
      selector: '[data-onboarding="recursos"]',
      titulo: "Recursos",
      texto: "Documentos de referencia y tus propios documentos organizacionales.",
    },
    {
      selector: '[data-onboarding="asistente"]',
      titulo: "Asistente IA",
      texto: `Tu experto regulatorio disponible 24/7. Pregúntale cualquier duda sobre Gestión de Riesgos ${normaCorta}.`,
    },
  ];

  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const paso = pasos[idx];
    if (!paso) return;

    // Si el elemento está dentro de un grupo cerrado del menú, abrir ese grupo antes de resaltarlo.
    const clave = paso.selector.match(/data-onboarding="([^"]+)"/)?.[1];
    if (clave && !document.querySelector(paso.selector)) {
      window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_GRUPO, { detail: clave }));
    }

    const update = () => {
      const el = document.querySelector(paso.selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    update();
    const t = setTimeout(update, 350); // re-medir tras scroll / apertura del grupo
    const t2 = setTimeout(update, 700);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [idx]);

  const siguiente = () => {
    if (idx < pasos.length - 1) setIdx(idx + 1);
    else onFinish();
  };

  const paso = pasos[idx];

  // Posición del tooltip
  const tooltipPos = (() => {
    if (!rect) return { top: 80, left: 80 };
    const isMobile = window.innerWidth < 768;
    // Para el botón flotante (esquina inferior derecha) → arriba-izquierda
    if (paso.selector.includes("asistente")) {
      return {
        top: Math.max(20, rect.top - 180),
        left: Math.max(20, rect.left - 280),
      };
    }
    // Sidebar items → a la derecha del item
    if (isMobile) {
      return { top: rect.bottom + 12, left: 16, right: 16 };
    }
    return {
      top: Math.max(20, rect.top - 8),
      left: rect.right + 16,
    };
  })();

  return (
    <div className="fixed inset-0 z-[100] animate-in fade-in-0 duration-200">
      {/* Overlay con "hole" */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ width: "100vw", height: "100vh" }}>
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#onboarding-mask)" />
        {rect && (
          <rect
            x={rect.left - 6}
            y={rect.top - 6}
            width={rect.width + 12}
            height={rect.height + 12}
            rx={8}
            fill="none"
            stroke="#185FA5"
            strokeWidth={2}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        className="absolute bg-background border-2 rounded-lg shadow-2xl p-4 max-w-xs animate-in zoom-in-95 fade-in-0 duration-200"
        style={{
          borderColor: "#185FA5",
          top: tooltipPos.top,
          left: tooltipPos.left,
          right: (tooltipPos as any).right,
          maxWidth: (tooltipPos as any).right !== undefined ? undefined : 320,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full" style={{ background: "#185FA5" }} />
          <h3 className="text-sm font-bold">{paso.titulo}</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {idx + 1} / {pasos.length}
          </span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{paso.texto}</p>
        <div className="flex justify-between items-center gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={onSaltar} className="text-xs text-muted-foreground">
            Saltar tour
          </Button>
          <Button size="sm" onClick={siguiente} style={{ background: "#042C53" }}>
            {idx < pasos.length - 1 ? "Siguiente →" : "Continuar →"}
          </Button>
        </div>
      </div>
    </div>
  );
}