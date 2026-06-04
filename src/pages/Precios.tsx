import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Loader2, Sparkles, Mail, Upload, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ADDONS, PLANS, CONSULTAS_IA_PACK, type AddonId, type PlanId } from "@/config/plans";
import { ContactDialog } from "@/components/ContactDialog";

type FaqEntry =
  | { type: "group"; title: string }
  | { type: "item"; q: string; a: string };

const FAQ: FaqEntry[] = [
  { type: "group", title: "¿Qué es TRACEA?" },
  {
    type: "item",
    q: "¿Qué es TRACEA?",
    a: "TRACEA es una plataforma de Gestión de Riesgos para empresas reguladas por COFEPRIS. Opera de forma nativa bajo NOM-241-SSA1-2025 (dispositivos médicos, Gestión de Riesgos conforme a NOM-241 y FEUM) y NOM-059-SSA1-2015 (medicamentos, Gestión de Riesgos de Calidad conforme a NOM-059 y FEUM). Centraliza la matriz de riesgos (AMEF), la firma electrónica conforme a 21 CFR Part 11, la trazabilidad, los formatos COFEPRIS y un Asistente IA experto que acompaña a tu equipo en cada paso.",
  },
  {
    type: "item",
    q: "¿Necesito conocimientos técnicos para usar TRACEA?",
    a: "No. TRACEA está diseñado para que la complejidad regulatoria sea invisible para el usuario. El Asistente IA guía a tu equipo paso a paso en lenguaje simple — nadie necesita memorizar requisitos técnicos. El wizard de creación de riesgos traduce los requisitos de Gestión de Riesgos NOM-241 y FEUM (o NOM-059 y FEUM) a preguntas como ¿qué puede salir mal? y ¿qué tan grave sería? El resultado es un análisis que cumple los requerimientos COFEPRIS sin necesitar ser experto regulatorio.",
  },
  {
    type: "item",
    q: "¿El DC-3 que emite TRACEA tiene validez oficial?",
    a: "Sí. El DC-3 (Constancia de Competencias o Habilidades Laborales) que se genera al completar el Curso de Gestión de Riesgos es la constancia oficial reconocida por la STPS — la misma evidencia de capacitación que puedes presentar ante una auditoría COFEPRIS para acreditar la formación de tu equipo en gestión de riesgos bajo NOM-241 y FEUM o NOM-059 y FEUM.",
  },
  {
    type: "item",
    q: "¿TRACEA funciona para NOM-059 también?",
    a: "Sí. TRACEA soporta de forma nativa NOM-059-SSA1-2015 (Buenas Prácticas de Fabricación de medicamentos) con Gestión de Riesgos de Calidad conforme a NOM-059 y FEUM. Al crear tu organización eliges la norma aplicable; la terminología, catálogos de severidad/ocurrencia/detectabilidad, umbrales de NPR y formatos PDF se adaptan automáticamente. El aprobador final es el Director Técnico. El plan Enterprise permite operar bajo NOM-241 y NOM-059 simultáneamente (modo multi-norma).",
  },

  { type: "group", title: "¿Vienes de otro sistema?" },
  {
    type: "item",
    q: "Ya tengo un AMEF. ¿Debo rehacerlo todo?",
    a: "No tienes que rehacer nada solo — el Asistente IA de TRACEA hace el trabajo por ti. La diferencia entre un AMEF simple y el análisis completo de TRACEA no es más trabajo para tu equipo: es más inteligencia del sistema. Mientras que un AMEF básico registra el riesgo, el análisis completo de TRACEA te ayuda a ENTENDERLO — identificando la cadena real de eventos, la causa raíz y los controles que realmente funcionan. El resultado: cuando llegue COFEPRIS no solo tienes un formato lleno, tienes evidencia de que tu empresa entiende y controla sus riesgos. Eso es lo que distingue una auditoría tranquila de una con observaciones mayores.",
  },
  {
    type: "item",
    q: "¿Puedo importar mi AMEF actual a TRACEA?",
    a: "Sí. El Asistente IA analiza tu AMEF existente en Excel, Word o PDF, identifica qué información ya tienes y propone los campos faltantes para completar el expediente conforme a NOM-241 y FEUM. No empiezas desde cero — empiezas desde donde estás y el Asistente enriquece tu análisis gradualmente. Muchos equipos descubren en ese proceso peligros que habían pasado por alto durante años.",
  },
  {
    type: "item",
    q: "¿No es demasiado complejo para mi equipo operativo?",
    a: "No. TRACEA está diseñado para que la complejidad regulatoria sea invisible para el usuario. El Asistente IA guía a tu equipo paso a paso en lenguaje simple — nadie necesita memorizar los requisitos técnicos. El wizard de creación de riesgos traduce los requisitos de Gestión de Riesgos NOM-241 y FEUM (o NOM-059 y FEUM) a preguntas como ¿Qué puede salir mal? y ¿Qué tan grave sería? Al final tu equipo genera un análisis que cumple los requerimientos COFEPRIS sin necesitar ser experto regulatorio.",
  },
  {
    type: "item",
    q: "¿Por qué usar los 6 datos requeridos para tu análisis de riesgo si parece excesivo para mi operación?",
    a: "Porque el agente IA los genera por ti — no es carga adicional para tu equipo. Y porque los 6 datos requeridos por NOM-241 y FEUM (o NOM-059 y FEUM) te protegen más allá de COFEPRIS: si en el futuro necesitas certificación FDA, CE Mark o exportar a mercados internacionales, tu expediente ya cumple. Un análisis simplificado hoy puede costarte rehacerlo todo mañana. TRACEA es una inversión que escala con tu empresa.",
  },
  {
    type: "item",
    q: "¿TRACEA es para empresas grandes o también para PyMEs?",
    a: "TRACEA está especialmente diseñado para PyMEs reguladas que no tienen un departamento de calidad de 10 personas. El Asistente IA actúa como tu experto regulatorio disponible 24/7. Lo que una empresa grande resuelve con un equipo de consultores a $3,000-5,000 USD por análisis, TRACEA lo hace desde $85 USD al mes. Tu tamaño no determina la calidad de tu gestión de riesgos — tu herramienta sí.",
  },
  {
    type: "item",
    q: "¿Qué pasa si mi proceso es muy operativo y no tan técnico?",
    a: "TRACEA se adapta a tu nivel de madurez. Puedes empezar con análisis básicos y el agente IA los va enriqueciendo conforme tu equipo aprende. El sistema guarda todo el historial — cada mejora queda documentada como evidencia de mejora continua ante COFEPRIS. Además, el PNO proforma que incluye TRACEA en los Recursos te da una versión operativa lista para adaptar a tu empresa desde el primer día.",
  },

  { type: "group", title: "Sobre el servicio" },
  {
    type: "item",
    q: "¿Mis datos están seguros?",
    a: "Sí. TRACEA opera sobre infraestructura cloud con cifrado en tránsito (TLS) y en reposo, control de acceso por rol y políticas de seguridad por fila (RLS) que aíslan los datos de cada organización. La firma electrónica cumple 21 CFR Part 11 y cada cambio queda registrado en un Audit Trail inmutable con usuario, fecha, IP y valores previos/posteriores — la evidencia de integridad de datos que un auditor COFEPRIS espera ver.",
  },
  {
    type: "item",
    q: "¿Puedo cancelar en cualquier momento?",
    a: "Sí. Las suscripciones son mensuales y puedes cancelar cuando quieras desde la sección de Configuración. No hay penalización ni contrato anual obligatorio. Mantienes el acceso hasta el final del ciclo pagado.",
  },
  {
    type: "item",
    q: "¿Qué pasa con mis datos al cancelar?",
    a: "Tu información permanece disponible en modo lectura por 60 días después de cancelar para que puedas exportar tus folios, matrices de riesgo, evidencias y reportes PDF. Pasado ese plazo, los datos se eliminan de forma definitiva conforme a las políticas de retención. Puedes reactivar tu cuenta en cualquier momento durante la ventana de lectura y recuperar todo intacto.",
  },
  {
    type: "item",
    q: "¿El Asistente IA está disponible en todos los planes?",
    a: "Sí. El Asistente IA experto en NOM-241 y NOM-059 está incluido en todos los planes. La diferencia entre planes está en el cupo mensual de consultas: 30 en Starter, mayor cupo en Professional y consultas ilimitadas en Enterprise. El Curso (compra única) también incluye acceso completo al Asistente durante los 30 días de práctica.",
  },
  {
    type: "item",
    q: "¿Puedo empezar con el Curso y luego suscribirme?",
    a: "Sí, y es una ruta recomendada. El Curso de Gestión de Riesgos es una compra única que certifica a tu equipo con DC-3 STPS e incluye 30 días de acceso completo a la plataforma. Durante esos días puedes practicar con casos reales y, si decides continuar, contratar una suscripción mensual sin perder lo trabajado.",
  },
  {
    type: "item",
    q: "¿Qué pasa después del mes de prueba incluido en el Curso?",
    a: "Al terminar el mes, puedes continuar con cualquier plan desde $85 USD/mes. Si decides no continuar, tu DC-3 y guías descargadas son tuyas para siempre. No hay cargos automáticos — tú decides si continuar.",
  },
  {
    type: "item",
    q: "¿Necesito DC-3 para cumplir con COFEPRIS?",
    a: "COFEPRIS exige evidencia documental de la capacitación del personal en los temas críticos de su rol — y el DC-3 oficial STPS es la forma más sólida de acreditarla. Tener constancias DC-3 emitidas por un curso especializado en Gestión de Riesgos NOM-241 y FEUM (o NOM-059 y FEUM) demuestra al auditor que tu equipo está formalmente capacitado, no solo informado. Es de las primeras evidencias que se solicitan en una visita de verificación.",
  },
];

export default function Precios() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading, org } = useAuth();
  const [searchParams] = useSearchParams();
  const fromLimite = searchParams.get("from") === "limite";

  const haySesion = !!user && !loading;
  // Suscripción activa = la org tiene plan distinto de trial y está activa
  const tieneSuscripcionActiva =
    haySesion && !!org && org.activo === true && org.plan !== "trial";
  const planActualId = org?.plan ?? null;

  const startCheckout = async (priceId: string, key: PlanId | AddonId, action: "checkout" | "change_plan" = "checkout") => {
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
        body: { priceId, action },
      });
      if (error) throw error;
      if ((data as any)?.changed) {
        toast({
          title: "Plan actualizado",
          description: "Tu cambio de plan se aplicó con proración automática.",
        });
        navigate("/checkout/success?change=1");
        return;
      }
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
            <ContactDialog
              trigger={
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <Mail className="w-4 h-4" />
                  <span className="hidden sm:inline">Contacto</span>
                </button>
              }
            />
            <Button asChild size="sm" variant="outline">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto py-12 px-4 max-w-7xl">
        {fromLimite && (
          <div className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Agotaste tu cupo de consultas IA este mes.
              </p>
              <p className="text-muted-foreground mt-0.5">
                Cambia a un plan superior para más consultas mensuales, o compra el{" "}
                <a href="#consultas-extras" className="text-primary underline">
                  pack de 100 consultas adicionales
                </a>{" "}
                sin cambiar de plan.
              </p>
            </div>
          </div>
        )}

        {/* Hero */}
        <section className="text-center mb-14">
          <Badge variant="secondary" className="mb-4">Planes en USD</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-foreground">
            Planes que escalan con tu organización
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Plataforma de Gestión de Riesgos conforme a NOM-241 y FEUM (dispositivos médicos) y NOM-059 y FEUM (medicamentos). Folios y matriz de riesgos ilimitados en todos los planes.
          </p>
        </section>

        {/* Planes */}
        <section id="planes" className="mb-20">
          <p className="text-center text-sm text-muted-foreground mb-6">
            ¿Necesitas DC-3 para tu equipo? Disponibles para cualquier plan a $35 USD por usuario —{" "}
            <a href="mailto:soporte@tracea.com.mx" className="text-primary underline">
              soporte@tracea.com.mx
            </a>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.id === planActualId
                  ? "border-accent shadow-lg relative ring-2 ring-accent/40"
                  : plan.destacado
                  ? "border-primary shadow-lg relative ring-2 ring-primary/20"
                  : "relative"
              }
            >
              {plan.id === planActualId ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground hover:bg-accent">
                  <Check className="w-3 h-3 mr-1" /> Tu plan actual
                </Badge>
              ) : plan.destacado ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Sparkles className="w-3 h-3 mr-1" /> Más popular
                </Badge>
              ) : null}
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
                {plan.id === "enterprise" ? (
                  plan.id === planActualId ? (
                    <Button className="w-full" variant="outline" disabled>
                      Plan activo
                    </Button>
                  ) : (
                    <ContactDialog
                    trigger={
                      <Button className="w-full" variant={plan.destacado ? "default" : "outline"}>
                        Contactar
                      </Button>
                    }
                    />
                  )
                ) : plan.id === planActualId ? (
                  <Button className="w-full" variant="outline" disabled>
                    Plan activo
                  </Button>
                ) : tieneSuscripcionActiva ? (
                  <Button
                    className="w-full"
                    variant={plan.destacado ? "default" : "outline"}
                    onClick={() => startCheckout(plan.priceId, plan.id, "change_plan")}
                    disabled={loadingId !== null}
                  >
                    {loadingId === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      `Cambiar a ${plan.nombre}`
                    )}
                  </Button>
                ) : (
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
                )}
              </CardFooter>
            </Card>
          ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            DC-3 adicionales disponibles para cualquier plan — $35 USD por usuario. Contáctanos:{" "}
            <a href="mailto:soporte@tracea.com.mx" className="text-primary underline">
              soporte@tracea.com.mx
            </a>
          </p>
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
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{addon.nombre}</CardTitle>
                      {addon.badge && (
                        <Badge
                          variant="secondary"
                          className={
                            addon.badge.toLowerCase().includes("lanzamiento")
                              ? "shrink-0 bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                              : "shrink-0"
                          }
                        >
                          {addon.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{addon.descripcion}</CardDescription>
                    <div className="pt-2">
                      {addon.precioAnterior && (
                        <span className="text-xl text-muted-foreground line-through mr-2">
                          {addon.precioAnterior}
                        </span>
                      )}
                      <span className="text-3xl font-bold text-foreground">{addon.precio}</span>
                      <span className="text-muted-foreground text-sm ml-2">pago único</span>
                      {addon.precioAnterior && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                          Precio de lanzamiento — primeros 20 clientes
                        </p>
                      )}
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
                    {addon.notaPie && (
                      <p className="text-xs text-muted-foreground text-center">{addon.notaPie}</p>
                    )}
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

        {/* Consultas adicionales — pack one-time que suma al límite mensual */}
        <section id="consultas-extras" className="mb-20 scroll-mt-20">
          <header className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 text-foreground">Consultas adicionales</h2>
            <p className="text-muted-foreground">
              ¿Te quedaste sin consultas IA antes de fin de mes? Compra un pack sin cambiar de plan.
            </p>
          </header>
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>{CONSULTAS_IA_PACK.nombre}</CardTitle>
                <CardDescription>{CONSULTAS_IA_PACK.descripcion}</CardDescription>
                <div className="pt-2">
                  <span className="text-3xl font-bold text-foreground">{CONSULTAS_IA_PACK.precio}</span>
                  <span className="text-muted-foreground text-sm ml-2">pago único</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {CONSULTAS_IA_PACK.features.map((f) => (
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
                  variant="outline"
                  onClick={() => startCheckout(CONSULTAS_IA_PACK.priceId, CONSULTAS_IA_PACK.id)}
                  disabled={loadingId !== null}
                >
                  {loadingId === CONSULTAS_IA_PACK.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : haySesion ? (
                    "Comprar"
                  ) : (
                    "Crear cuenta y comprar"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Sección Responsable Sanitario + Director General */}
        <section className="mb-20 bg-muted/30 rounded-2xl p-6 sm:p-10 md:p-12">
          {/* Bloque superior — Responsable Sanitario */}
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">
              ¿Ya tienes un sistema de gestión de riesgos?
            </h2>
            <p className="text-center text-lg sm:text-xl text-foreground/80 font-medium max-w-3xl mx-auto mb-10 leading-relaxed">
              Tu criterio regulatorio, documentado con la estructura que COFEPRIS exige ver.
              <br className="hidden sm:block" />
              Sin rehacer — sin perder lo que ya construiste.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {[
                {
                  Icon: Upload,
                  title: "Tu AMEF, enriquecido",
                  text: "El Asistente analiza lo que ya tienes y propone lo que falta. Tú validas cada dato antes de que quede registrado.",
                },
                {
                  Icon: TrendingUp,
                  title: "Tu firma, más respaldada",
                  text: "Cada decisión que tomas queda documentada con la trazabilidad que un auditor COFEPRIS necesita ver. Tu criterio, con evidencia sólida.",
                },
                {
                  Icon: Shield,
                  title: "Tu auditoría, sin sorpresas",
                  text: "No cambia tu metodología — la estructura. El resultado: un expediente que defiende cada decisión técnica que tomaste.",
                },
              ].map(({ Icon, title, text }) => (
                <div key={title} className="flex flex-col items-start gap-3 p-4">
                  <Icon className="w-8 h-8" style={{ color: "#185FA5" }} />
                  <h3 className="font-semibold text-foreground text-lg">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <p className="text-center italic text-muted-foreground max-w-3xl mx-auto">
              "Diseñado para Responsables Sanitarios que entienden que documentar bien no es burocracia — es su mejor defensa profesional."
            </p>
          </div>

          <div className="h-px bg-border my-12 max-w-5xl mx-auto" />

          {/* Bloque inferior — Director General */}
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">
              ¿Cuánto cuesta no estar preparado?
            </h2>
            <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              No necesitas contratar a alguien que sepa NOM-241, NOM-059 y COFEPRIS de memoria. Ya existe. Se llama TRACEA. Y cuesta menos que la primera semana de sueldo de un analista junior.
            </p>

            <div className="rounded-lg border overflow-hidden max-w-3xl mx-auto mb-8 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-0 hover:bg-transparent">
                    <TableHead style={{ backgroundColor: "#042C53" }} className="text-white font-semibold"></TableHead>
                    <TableHead style={{ backgroundColor: "#042C53" }} className="text-white font-semibold text-center">
                      Analista Junior
                    </TableHead>
                    <TableHead style={{ backgroundColor: "#042C53" }} className="text-white font-semibold text-center">
                      TRACEA
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["Costo mensual", "$15,000–25,000 MXN", "Desde $1,700 MXN"],
                    ["Disponibilidad", "8 hrs/día", "24/7"],
                    ["Conoce NOM-241 y FEUM", "En proceso", "Siempre actualizado"],
                    ["Curva de aprendizaje", "3–6 meses", "Inmediata"],
                    ["Rotación de personal", "Alta", "Ninguna"],
                    ["Listo para auditoría", "Depende de su experiencia", "Siempre listo"],
                  ].map(([label, a, b], i) => (
                    <TableRow
                      key={label}
                      className="hover:bg-transparent"
                      style={i % 2 === 0 ? { backgroundColor: "#E8F0F9" } : { backgroundColor: "#FFFFFF" }}
                    >
                      <TableCell className="font-medium text-foreground">{label}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{a}</TableCell>
                      <TableCell className="text-center font-medium" style={{ color: "#042C53" }}>{b}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-center space-y-2">
              <Button
                size="lg"
                onClick={() =>
                  document.getElementById("planes")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Ver planes y precios
              </Button>
              <p className="text-xs text-muted-foreground">
                Desde $85 USD/mes. Cancela cuando quieras.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto">
          <header className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2 text-foreground">Preguntas frecuentes</h2>
            <p className="text-muted-foreground">Todo lo que necesitas saber antes de contratar.</p>
          </header>
          {(() => {
            // Agrupa entradas por separadores 'group' y renderiza un Accordion por bloque
            const blocks: { title: string; items: { q: string; a: string }[] }[] = [];
            let current: { title: string; items: { q: string; a: string }[] } | null = null;
            for (const entry of FAQ) {
              if (entry.type === "group") {
                current = { title: entry.title, items: [] };
                blocks.push(current);
              } else if (current) {
                current.items.push({ q: entry.q, a: entry.a });
              }
            }
            return blocks.map((block, bi) => (
              <div key={block.title} className={bi === 0 ? "" : "mt-10"}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px bg-border flex-1" />
                  <h3 className="text-sm font-medium text-muted-foreground text-center">
                    {block.title}
                  </h3>
                  <div className="h-px bg-border flex-1" />
                </div>
                <Accordion type="single" collapsible className="w-full">
                  {block.items.map((item, i) => (
                    <AccordionItem key={`${bi}-${i}`} value={`item-${bi}-${i}`}>
                      <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground whitespace-pre-line">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ));
          })()}

          <div className="mt-10 text-center">
            <p className="text-muted-foreground mb-3">¿Tienes otra pregunta?</p>
            <ContactDialog
              trigger={
                <Button variant="outline">
                  <Mail className="w-4 h-4 mr-2" /> Escríbenos
                </Button>
              }
            />
          </div>
        </section>
      </main>

      <footer className="border-t mt-16 py-6 bg-card">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <Link to="/terminos" className="hover:text-foreground underline-offset-2 hover:underline">
              Términos y Condiciones
            </Link>
            <span className="text-border">·</span>
            <Link to="/privacidad" className="hover:text-foreground underline-offset-2 hover:underline">
              Aviso de Privacidad
            </Link>
          </div>
          <p>© {new Date().getFullYear()} TRACEA · Plataforma de Gestión de Riesgos NOM-241 / NOM-059</p>
        </div>
      </footer>
    </div>
  );
}