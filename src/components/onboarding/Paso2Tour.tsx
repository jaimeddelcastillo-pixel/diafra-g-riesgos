import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useOnboardingTextos } from "./useOnboardingTextos";
import { EVENTO_ABRIR_GRUPO } from "@/components/AppSidebar";
import type { PasoTour } from "@/modules/tipos";
import { posicionTour } from "./posicionTour";

interface Props {
  onFinish: () => void;
  onSaltar: () => void;
  /** Pasos propios (tours de plataforma/módulos). Sin ellos, el recorrido original de Riesgos. */
  pasos?: PasoTour[];
}

export function Paso2Tour({ onFinish, onSaltar, pasos: pasosProp }: Props) {
  const { normaCorta } = useOnboardingTextos();

  const pasos: PasoTour[] = pasosProp ?? [
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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState({ width: 320, height: 240 });
  const [pantalla, setPantalla] = useState({ width: window.innerWidth, height: window.innerHeight });

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const medir = () => {
      const { width, height } = el.getBoundingClientRect();
      setMedida((prev) => prev.width === width && prev.height === height ? prev : { width, height });
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, [idx]);

  useEffect(() => {
    const actualizar = () => setPantalla({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  useEffect(() => {
    const paso = pasos[idx];
    if (!paso) return;
    if (!paso.selector) { setRect(null); return; }
    const selector = paso.selector;

    // Si el elemento está dentro de un grupo cerrado del menú, abrir ese grupo antes de resaltarlo.
    const clave = selector.match(/data-onboarding="([^"]+)"/)?.[1];
    if (clave && !document.querySelector(selector)) {
      window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_GRUPO, { detail: clave }));
    }

    const visible = (el: HTMLElement | null) => !!el && el.getClientRects().length > 0;
    const update = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el && visible(el)) {
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    const elemento = document.querySelector(selector) as HTMLElement | null;
    elemento?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    update();
    const t = setTimeout(update, 350); // re-medir tras scroll / apertura del grupo
    const t2 = setTimeout(update, 700);
    // Elemento no visible (rol, celular o menú colapsado): se salta el paso.
    const t3 = setTimeout(() => {
      if (!visible(document.querySelector(selector) as HTMLElement | null)) {
        setIdx((i) => (i === idx ? i + 1 : i));
      }
    }, 900);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [idx]);

  const siguiente = () => {
    if (idx < pasos.length - 1) setIdx(idx + 1);
    else onFinish();
  };

  const paso = pasos[idx];
  useEffect(() => {
    if (idx >= pasos.length) onFinish();
  }, [idx]);
  if (!paso) return null;

  const tooltipPos = posicionTour(rect, medida, pantalla);

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
        <rect width="100%" height="100%" fill="hsl(var(--foreground) / 0.65)" mask="url(#onboarding-mask)" />
        {rect && (
          <rect
            x={rect.left - 6}
            y={rect.top - 6}
            width={rect.width + 12}
            height={rect.height + 12}
            rx={8}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={paso.titulo}
        className="absolute bg-background border-2 border-accent rounded-lg shadow-2xl p-4 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto motion-safe:animate-in motion-safe:fade-in-0 duration-200"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-accent" />
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
          <Button size="sm" onClick={siguiente}>
            {idx < pasos.length - 1 ? "Siguiente →" : "Continuar →"}
          </Button>
        </div>
      </div>
    </div>
  );
}