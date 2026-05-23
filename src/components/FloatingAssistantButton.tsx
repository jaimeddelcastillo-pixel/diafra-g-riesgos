import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { AssistantPanel } from "./AssistantPanel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const HIDDEN_ROUTES = ["/login", "/register", "/precios", "/unsubscribe", "/checkout/success", "/pago-pendiente", "/terminos", "/privacidad"];

export function FloatingAssistantButton() {
  const [open, setOpen] = useState(false);
  const [overrideFolio, setOverrideFolio] = useState<{ id: string; codigo: string } | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const location = useLocation();
  const params = useParams();

  const isFolioDetail = /^\/folios\/[^/]+/.test(location.pathname);
  const folioId = isFolioDetail ? (params.id as string) : null;

  const { data: folio } = useQuery({
    queryKey: ["assistant-folio", folioId],
    enabled: !!folioId,
    queryFn: async () => {
      const { data } = await supabase.from("folios").select("codigo").eq("id", folioId!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { folioId?: string; folioCodigo?: string; mensajeInicial?: string }
        | undefined;
      if (detail?.folioId) {
        setOverrideFolio({ id: detail.folioId, codigo: detail.folioCodigo || "" });
      }
      if (detail?.mensajeInicial) setInitialMessage(detail.mensajeInicial);
      setOpen(true);
    };
    window.addEventListener("tracea:open-assistant", handler);
    return () => window.removeEventListener("tracea:open-assistant", handler);
  }, []);

  if (HIDDEN_ROUTES.some((p) => location.pathname.startsWith(p))) return null;

  const effectiveFolioId = overrideFolio?.id ?? folioId;
  const effectiveFolioCodigo = overrideFolio?.codigo ?? folio?.codigo ?? null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente IA"
        data-onboarding="asistente"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      >
        <Sparkles className="h-6 w-6" />
      </button>
      <AssistantPanel
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setOverrideFolio(null);
            setInitialMessage(null);
          }
        }}
        folioId={effectiveFolioId}
        folioCodigo={effectiveFolioCodigo}
        mensajeInicial={initialMessage}
      />
    </>
  );
}