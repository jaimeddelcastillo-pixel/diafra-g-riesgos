import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Award, Clock, CheckCircle2, Loader2, ExternalLink, FileBadge } from "lucide-react";

interface Props {
  diplomaId: string;
  cursoId?: string | null;
  cursoTitulo?: string | null;
  compact?: boolean;
}

type Estado = "pendiente" | "enviado" | "cancelado";
type Solicitud = {
  id: string;
  estado: Estado;
  solicitado_en: string;
  enviado_en: string | null;
  dc3_url: string | null;
  fuente: "incluido" | "comprado";
};

const DC3_PRICE_ID = "price_1TbRUHKfwzAg4OKvWE8uMR6y";

export default function SolicitarDC3Card({ diplomaId, cursoId, cursoTitulo, compact, soloLectura }: Props & { soloLectura?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dc3_solicitudes")
      .select("id, estado, solicitado_en, enviado_en, dc3_url, fuente")
      .eq("diploma_id", diplomaId)
      .in("estado", ["pendiente", "enviado"])
      .order("solicitado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSolicitud((data as Solicitud) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void cargar();
  }, [diplomaId]);

  const solicitar = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("solicitar-dc3", {
        body: { diploma_id: diplomaId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.requires_payment) {
        setPaying(true);
        const { data: co, error: coErr } = await supabase.functions.invoke("create-checkout", {
          body: { priceId: DC3_PRICE_ID, quantity: 1 },
        });
        if (coErr) throw new Error(coErr.message);
        if (co?.url) {
          window.location.href = co.url;
          return;
        }
        throw new Error("No se pudo iniciar el pago");
      }
      toast.success("Solicitud de DC-3 recibida — te llegará en 2-3 días hábiles");
      await cargar();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar la solicitud");
    } finally {
      setSubmitting(false);
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-lg border bg-muted/30 ${compact ? "p-3" : "p-4"} text-sm text-muted-foreground`}>
        Cargando estado de DC-3…
      </div>
    );
  }

  if (solicitud?.estado === "enviado") {
    return (
      <div className={`rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20 ${compact ? "p-3" : "p-4"} space-y-2`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> DC-3 oficial STPS enviado
        </div>
        {solicitud.enviado_en && (
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
            Enviado el {new Date(solicitud.enviado_en).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        )}
        {solicitud.dc3_url && (
          <Button asChild variant="outline" size="sm">
            <a href={solicitud.dc3_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Ver constancia DC-3
            </a>
          </Button>
        )}
      </div>
    );
  }

  if (solicitud?.estado === "pendiente") {
    return (
      <div className={`rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 ${compact ? "p-3" : "p-4"} space-y-1`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
          <Clock className="h-4 w-4" /> DC-3 en trámite
        </div>
        <p className="text-xs text-amber-900/80 dark:text-amber-300/80">
          Recibirás tu constancia oficial STPS en 2-3 días hábiles al correo registrado.
        </p>
      </div>
    );
  }

  // P1c.2: empresa suspendida → solo se consultan DC-3 existentes, sin solicitar nuevas.
  if (soloLectura) return null;

  return (
    <div className={`rounded-lg border border-[#0B2545]/20 bg-[#0B2545]/5 ${compact ? "p-3" : "p-4"} space-y-3`}>
      <div className="flex items-start gap-2">
        <FileBadge className="h-5 w-5 text-[#0B2545] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#0B2545]">
            ¿Necesitas tu DC-3 oficial STPS?
          </p>
          <p className="text-xs text-muted-foreground">
            Constancia oficial con validez ante la Secretaría del Trabajo. TRACEA la emite ante SIRCE
            y te llega en 2-3 días hábiles. $35 USD por constancia o gratis si tu plan incluye saldo.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={solicitar}
        disabled={submitting || paying}
        className="w-full sm:w-auto"
        style={{ backgroundColor: "#0B2545" }}
      >
        {submitting || paying ? (
          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {paying ? "Redirigiendo al pago…" : "Procesando…"}</>
        ) : (
          <><Award className="h-4 w-4 mr-1" /> Solicitar mi DC-3</>
        )}
      </Button>
    </div>
  );
}