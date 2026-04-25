import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Loader2, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ADDONS, PLANS, type AddonId, type PlanId } from "@/config/plans";

const FAQ = [
  {
    q: "¿Qué incluye exactamente el plan Starter?",
    a: "Hasta 5 usuarios, folios y matriz AMEF ilimitados, firma electrónica conforme a CFR Part 11 y soporte por correo. Ideal para equipos pequeños iniciando con gestión de riesgos bajo FEUM / ISO 14971.",
  },
  {
    q: "¿Puedo cambiar de plan en cualquier momento?",
    a: "Sí. Puedes hacer upgrade o downgrade desde la sección de Configuración. El cobro se prorratea automáticamente según los días restantes del ciclo.",
  },
  {
    q: "¿Los precios incluyen IVA?",
    a: "Los precios mostrados están en USD y no incluyen impuestos locales. Si tu organización requiere factura fiscal mexicana, contáctanos a soporte@tracea.mx.",
  },
  {
    q: "¿Qué método de pago aceptan?",
    a: "Aceptamos todas las tarjetas de crédito y débito principales (Visa, Mastercard, American Express) procesadas de forma segura mediante Stripe.",
  },
  {
    q: "¿Cuál es la diferencia entre los complementos y los planes?",
    a: "Los planes son suscripciones mensuales que dan acceso a la plataforma. Los complementos (Curso, Pack de Protocolos) son compras únicas que se suman a tu cuenta y permanecen disponibles indefinidamente.",
  },
  {
    q: "¿TRACEA cumple con NOM-241-SSA1-2025?",
    a: "Sí. El módulo actual está optimizado para cumplir con NOM-241-SSA1-2025 (dispositivos médicos) bajo FEUM / ISO 14971. La plataforma está diseñada exclusivamente para esta normativa.",
  },
  {
    q: "¿Ofrecen prueba gratis?",
    a: "Ofrecemos demos guiadas con un especialista. Escríbenos a soporte@tracea.mx para agendar una sesión y conocer la plataforma antes de contratar.",
  },
];

export default function Precios() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading, org } = useAuth();

  const haySesion = !!user && !loading;
  // Suscripción activa = la org tiene plan distinto de trial y está activa
  const tieneSuscripcionActiva =
    haySesion && !!org && org.activo === true && org.plan !== "trial";

  const startCheckout = async (priceId: string, key: PlanId | AddonId) => {
    // Sin sesión → siempre va a /register?plan=<key>
    if (!haySesion) {
      navigate(`/register?plan=${key}`);
      return;
    }
    // Con sesión, pero el addon "protocolos" requiere suscripción activa
    if (key === "protocolos" && !tieneSuscripcionActiva) {
      toast({
        title: "Necesitas una suscripción activa",
        description: "Adquiere un plan (Starter, Professional o Enterprise) para poder comprar este complemento.",
      });
      return;
    }
    setLoadingId(key);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No se recibió URL de checkout");
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header público minimal */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8">
              <rect x="1" y="1" width="17" height="17" rx="3" fill="#042C53" />
              <rect x="22" y="1" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="1" y="22" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="22" y="22" width="17" height="17" rx="3" fill="#8587E8" />
              <path d="M18 18L22 22" stroke="#8587E8" strokeWidth="2" strokeDasharray="2.5 2" strokeLinecap="round" />
              <path d="M27 30.5L30.5 34L36 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold tracking-wide text-foreground">TRACEA</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a
              href="mailto:soporte@tracea.mx"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Contacto</span>
            </a>
            <Button asChild size="sm" variant="outline">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto py-12 px-4 max-w-7xl">
        {/* Hero */}
        <section className="text-center mb-14">
          <Badge variant="secondary" className="mb-4">Planes en USD</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-foreground">
            Planes que escalan con tu organización
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Plataforma de gestión de riesgos FEUM / ISO 14971 alineada a NOM-241-SSA1-2025. Folios y matriz AMEF ilimitados en todos los planes.
          </p>
        </section>

        {/* Planes */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.destacado
                  ? "border-primary shadow-lg relative ring-2 ring-primary/20"
                  : "relative"
              }
            >
              {plan.destacado && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Sparkles className="w-3 h-3 mr-1" /> Más popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.nombre}</CardTitle>
                <CardDescription>{plan.descripcion}</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.precio}</span>
                  <span className="text-muted-foreground">{plan.periodo}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.destacado ? "default" : "outline"}
                  onClick={() => startCheckout(plan.priceId, plan.id)}
                  disabled={loadingId !== null}
                >
                  {loadingId === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : haySesion ? (
                    `Suscribirme a ${plan.nombre}`
                  ) : (
                    `Crear cuenta y suscribirme`
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>

        {/* Complementos */}
        <section className="mb-20">
          <header className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 text-foreground">Complementos</h2>
            <p className="text-muted-foreground">Compras únicas que potencian tu plan.</p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {ADDONS.map((addon) => {
              // Curso: cualquiera (con o sin sesión) puede comprarlo.
              // Protocolos: requiere sesión + suscripción activa.
              const requiereSuscripcion = addon.id === "protocolos";
              const bloqueadoPorSuscripcion =
                requiereSuscripcion && haySesion && !tieneSuscripcionActiva;
              const disabled = bloqueadoPorSuscripcion || loadingId !== null;

              const labelBoton = (() => {
                if (loadingId === addon.id) return null;
                if (!haySesion) {
                  return requiereSuscripcion
                    ? "Crear cuenta y adquirir"
                    : `Adquirir ${addon.nombre}`;
                }
                return `Adquirir ${addon.nombre}`;
              })();

              const mensajeAyuda = (() => {
                if (!haySesion) {
                  return requiereSuscripcion
                    ? "Crea tu cuenta y adquiere los protocolos"
                    : null;
                }
                if (bloqueadoPorSuscripcion) {
                  return "Necesitas una suscripción activa para adquirir este complemento.";
                }
                return null;
              })();

              return (
                <Card key={addon.id}>
                  <CardHeader>
                    <CardTitle>{addon.nombre}</CardTitle>
                    <CardDescription>{addon.descripcion}</CardDescription>
                    <div className="pt-2">
                      <span className="text-3xl font-bold text-foreground">{addon.precio}</span>
                      <span className="text-muted-foreground text-sm ml-2">pago único</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {addon.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="flex-col gap-2 items-stretch">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => startCheckout(addon.priceId, addon.id)}
                      disabled={disabled}
                    >
                      {loadingId === addon.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        labelBoton
                      )}
                    </Button>
                    {mensajeAyuda && (
                      <div className="text-xs text-muted-foreground text-center space-y-1">
                        <p>{mensajeAyuda}</p>
                        {bloqueadoPorSuscripcion && (
                          <Link to="/precios#planes" className="text-primary underline">
                            Ver planes →
                          </Link>
                        )}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto">
          <header className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 text-foreground">Preguntas frecuentes</h2>
            <p className="text-muted-foreground">Todo lo que necesitas saber antes de contratar.</p>
          </header>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-10 text-center">
            <p className="text-muted-foreground mb-3">¿Tienes otra pregunta?</p>
            <Button asChild variant="outline">
              <a href="mailto:soporte@tracea.mx">
                <Mail className="w-4 h-4 mr-2" /> Escríbenos a soporte@tracea.mx
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t mt-16 py-6 bg-card">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} TRACEA · Plataforma de Gestión de Riesgos FEUM / ISO 14971
        </div>
      </footer>
    </div>
  );
}