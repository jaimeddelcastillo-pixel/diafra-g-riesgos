import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import {
  Building2,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  CreditCard,
  Sparkles,
  Mail,
  Shield,
  FlaskConical,
  Layers,
} from "lucide-react";
import { PLANS, ADDONS, type PlanId, type AddonId } from "@/config/plans";
import { NORMAS_CONFIG, type NormaKey } from "@/config/normas";
import { ContactDialog } from "@/components/ContactDialog";
import traceaLogo from "@/assets/tracea-official.png.asset.json";

type Step = 1 | 2 | 3 | 4;

type Seleccion =
  | { tipo: "trial"; id: "trial"; nombre: string; precio: string; periodo: string; priceId: null }
  | { tipo: "plan"; id: PlanId; nombre: string; precio: string; periodo: string; priceId: string }
  | { tipo: "addon"; id: AddonId; nombre: string; precio: string; priceId: string };

function resolverSeleccion(planParam: string | null): Seleccion | null {
  if (!planParam) return null;
  if (planParam === "trial") {
    return {
      tipo: "trial",
      id: "trial",
      nombre: "Prueba gratuita",
      precio: "$0",
      periodo: "14 días",
      priceId: null,
    };
  }
  const plan = PLANS.find((p) => p.id === planParam);
  if (plan) {
    return {
      tipo: "plan",
      id: plan.id,
      nombre: plan.nombre,
      precio: plan.precio,
      periodo: plan.periodo,
      priceId: plan.priceId,
    };
  }
  const addon = ADDONS.find((a) => a.id === planParam);
  if (addon) {
    return {
      tipo: "addon",
      id: addon.id,
      nombre: addon.nombre,
      precio: addon.precio,
      priceId: addon.priceId,
    };
  }
  return null;
}

export default function Register() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const planParam = searchParams.get("plan");

  const [seleccion, setSeleccion] = useState<Seleccion | null>(() =>
    resolverSeleccion(planParam),
  );

  // Si el usuario llegó con un plan válido en la URL, saltamos la selección
  const [step, setStep] = useState<Step>(() => (resolverSeleccion(planParam) ? 2 : 1));
  const [submitting, setSubmitting] = useState(false);

  // Norma regulatoria bajo la cual opera la empresa (default NOM-241)
  const [norma, setNorma] = useState<NormaKey>("NOM-241");

  // Paso 2 — Empresa
  const [orgNombre, setOrgNombre] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Paso 3 — Administrador
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const elegirPlan = (s: Seleccion) => {
    setSeleccion(s);
    setSearchParams({ plan: s.id });
    setStep(2);
  };

  const handleSlugChange = (value: string) => {
    setOrgSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"));
  };

  const handleOrgNombreChange = (value: string) => {
    setOrgNombre(value);
    if (!orgSlug) handleSlugChange(value);
  };

  const validateStep2 = () => {
    if (!orgNombre.trim()) {
      toast({ title: "Nombre de empresa requerido", variant: "destructive" });
      return false;
    }
    if (!orgSlug.trim() || orgSlug.length < 3) {
      toast({ title: "Identificador debe tener al menos 3 caracteres", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!nombre.trim()) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return false;
    }
    if (!email.trim()) {
      toast({ title: "Correo requerido", variant: "destructive" });
      return false;
    }
    if (password.length < 8) {
      toast({ title: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" });
      return false;
    }
    if (password !== passwordConfirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return false;
    }
    if (!aceptaTerminos || !aceptaPrivacidad) {
      toast({
        title: "Debes aceptar los documentos legales",
        description: "Marca ambos checkboxes para continuar.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!seleccion) {
      toast({ title: "Selecciona un plan primero", variant: "destructive" });
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      // --- Flujo Trial: cuenta activa, sin pago, auto sign-in ---
      if (seleccion.tipo === "trial") {
        const { FunctionsHttpError } = await import("@supabase/supabase-js");
        const { data: trialData, error: trialErr } = await supabase.functions.invoke(
          "register-trial",
          {
            body: {
              nombre,
              email,
              password,
              empresa: orgNombre.trim(),
              org_slug: orgSlug.trim(),
              cargo,
              norma,
              acepta_terminos: aceptaTerminos,
              acepta_privacidad: aceptaPrivacidad,
            },
          },
        );
        if (trialErr) {
          let msg = trialErr.message;
          if (trialErr instanceof FunctionsHttpError) {
            try {
              const body = await trialErr.context.json();
              if (body?.error) msg = body.error;
            } catch {
              try { msg = await trialErr.context.text(); } catch {}
            }
          }
          throw new Error(msg);
        }
        if (trialData?.error) throw new Error(trialData.error);

        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;

        toast({
          title: "¡Bienvenido a TRACEA!",
          description: "Tu prueba de 14 días está activa.",
        });
        navigate("/");
        return;
      }

      // 1. Crear usuario en auth (Supabase enviará el correo de confirmación)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre },
          emailRedirectTo: `${window.location.origin}/login?plan=${seleccion.id}`,
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      // 2. Crear org + org_member via Edge Function con service role
      //    La org nace con estado='pendiente' y pending_price_id guardado.
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "register-org",
        {
          body: {
            user_id: authData.user.id,
            org_nombre: orgNombre.trim(),
            org_slug: orgSlug.trim(),
            pending_price_id: seleccion.priceId,
            norma_aplicable: norma,
            acepta_terminos: aceptaTerminos,
            acepta_privacidad: aceptaPrivacidad,
          },
        },
      );
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      // 3. Avanzar al paso 4 — confirmación + checkout pendiente
      setStep(4);
    } catch (err: any) {
      toast({
        title: "Error al registrar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      <header className="px-6 sm:px-10 pt-8 flex justify-center">
        <Link to="/" className="inline-flex items-center">
          <img
            src={traceaLogo.url}
            alt="TRACEA"
            className="h-32 sm:h-40 md:h-44 w-auto object-contain"
          />
        </Link>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 py-8">
        <Card className="w-full max-w-2xl border-0 shadow-none sm:border sm:shadow-xl">
        <CardHeader className="text-center space-y-3 px-0 lg:px-6">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {step === 1 && "Crea tu cuenta TRACEA"}
            {step === 2 && "Datos de tu empresa"}
            {step === 3 && "Datos del administrador"}
            {step === 4 && "Confirma tu correo"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === 1 && "Elige tu plan para comenzar"}
            {step === 2 && "Información fiscal y de contacto"}
            {step === 3 && "Cuenta principal de administración"}
            {step === 4 && "Te enviamos un correo de verificación"}
          </p>

          {seleccion && step > 1 && step < 4 && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
              <p className="font-medium">
                Plan seleccionado: {seleccion.nombre}{" "}
                <span className="text-muted-foreground font-normal">
                  ({seleccion.precio}
                  {seleccion.tipo === "plan" ? ` ${seleccion.periodo}` : " · pago único"})
                </span>
              </p>
              <button
                type="button"
                className="text-primary underline mt-0.5"
                onClick={() => {
                  setSeleccion(null);
                  setSearchParams({});
                  setStep(1);
                }}
              >
                Cambiar
              </button>
            </div>
          )}

          {/* Stepper */}
          {step < 4 && (
            <div className="flex items-center justify-center gap-1.5 pt-1 flex-wrap">
              {[
                { n: 1, label: "Plan", icon: Sparkles },
                { n: 2, label: "Empresa", icon: Building2 },
                { n: 3, label: "Admin", icon: User },
                { n: 4, label: "Pago", icon: CreditCard },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.n} className="flex items-center gap-1.5">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        step >= s.n
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span
                      className={`text-xs ${
                        step === s.n ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                    {i < 3 && <div className="w-4 h-px bg-border" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardHeader>

        <CardContent className="px-0 lg:px-6">
          {/* Paso 1 — Selección de plan */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Selector de norma regulatoria */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground text-center">
                  ¿Bajo qué norma opera tu empresa?
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Define el formato de gestión de riesgos. Puedes cambiarlo después.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    { key: "NOM-241" as NormaKey, icon: Shield, color: "text-primary", desc: "Dispositivos médicos" },
                    { key: "NOM-059" as NormaKey, icon: FlaskConical, color: "text-blue-600", desc: "Medicamentos" },
                    { key: "MULTI" as NormaKey, icon: Layers, color: "text-sky-500", desc: "Ambas normas" },
                  ].map(({ key, icon: Icon, color, desc }) => {
                    const cfg = NORMAS_CONFIG[key];
                    const selected = norma === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNorma(key)}
                        className={`text-left rounded-lg border-2 p-3 transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <span className="font-semibold text-sm">{cfg.nombre}</span>
                          {selected && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{desc}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {cfg.metodologiaNombre.split("(")[0].trim()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground text-center">
                  Selecciona el plan o producto con el que quieres comenzar. Tu cuenta se activa al
                  confirmar tu pago.
                </p>
              </div>

              {/* Prueba gratuita — destacada */}
              <button
                type="button"
                onClick={() =>
                  elegirPlan({
                    tipo: "trial",
                    id: "trial",
                    nombre: "Prueba gratuita",
                    precio: "$0",
                    periodo: "14 días",
                    priceId: null,
                  })
                }
                className="w-full text-left rounded-lg border-2 p-4 space-y-1.5 relative transition-colors hover:opacity-95"
                style={{ borderColor: "#E8671A", backgroundColor: "rgba(232,103,26,0.06)" }}
              >
                <Badge
                  className="absolute -top-2 right-3 text-[10px] text-white"
                  style={{ backgroundColor: "#E8671A" }}
                >
                  MÁS POPULAR
                </Badge>
                <span className="font-semibold text-sm">Prueba gratuita</span>
                <p className="text-2xl font-bold text-foreground">
                  $0 <span className="text-sm font-normal text-muted-foreground">— 14 días</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sin tarjeta de crédito · Acceso completo · 10 consultas IA
                </p>
                <span
                  className="inline-flex items-center justify-center mt-2 h-9 px-4 rounded-md text-white text-sm font-semibold"
                  style={{ backgroundColor: "#E8671A" }}
                >
                  Iniciar prueba gratis <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Curso */}
                {(() => {
                  const curso = ADDONS.find((a) => a.id === "curso")!;
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        elegirPlan({
                          tipo: "addon",
                          id: "curso",
                          nombre: curso.nombre,
                          precio: curso.precio,
                          priceId: curso.priceId,
                        })
                      }
                      className="text-left rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">Curso</span>
                        <Badge variant="secondary" className="text-[10px]">DC-3 STPS</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {curso.precio}
                        {curso.precioAnterior && (
                          <span className="text-sm font-normal text-muted-foreground line-through ml-2">
                            {curso.precioAnterior}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Pago único · 30 días de acceso</p>
                    </button>
                  );
                })()}

                {/* Starter */}
                {(() => {
                  const starter = PLANS.find((p) => p.id === "starter")!;
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        elegirPlan({
                          tipo: "plan",
                          id: "starter",
                          nombre: starter.nombre,
                          precio: starter.precio,
                          periodo: starter.periodo,
                          priceId: starter.priceId,
                        })
                      }
                      className="text-left rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors p-4 space-y-1.5"
                    >
                      <span className="font-semibold text-sm">Starter</span>
                      <p className="text-2xl font-bold text-foreground">
                        $85 USD<span className="text-sm font-normal text-muted-foreground">/mes</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Hasta 3 usuarios</p>
                    </button>
                  );
                })()}

                {/* Professional */}
                {(() => {
                  const pro = PLANS.find((p) => p.id === "professional")!;
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        elegirPlan({
                          tipo: "plan",
                          id: "professional",
                          nombre: pro.nombre,
                          precio: pro.precio,
                          periodo: pro.periodo,
                          priceId: pro.priceId,
                        })
                      }
                      className="text-left rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors p-4 space-y-1.5 relative"
                    >
                      <Badge className="absolute -top-2 right-3 text-[10px]">
                        <Sparkles className="w-3 h-3 mr-0.5" /> Popular
                      </Badge>
                      <span className="font-semibold text-sm">Professional</span>
                      <p className="text-2xl font-bold text-foreground">
                        $225 USD<span className="text-sm font-normal text-muted-foreground">/mes</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Hasta 10 usuarios</p>
                    </button>
                  );
                })()}

                {/* Enterprise — abre contact dialog, no continúa registro */}
                <ContactDialog
                  trigger={
                    <button
                      type="button"
                      className="text-left rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors p-4 space-y-1.5"
                    >
                      <span className="font-semibold text-sm">Enterprise</span>
                      <p className="text-2xl font-bold text-foreground">Contactar</p>
                      <p className="text-xs text-muted-foreground">
                        Usuarios ilimitados, múltiples sitios
                      </p>
                    </button>
                  }
                />
              </div>

              <p className="text-center text-sm text-muted-foreground pt-2">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="text-primary underline">Iniciar sesión</Link>
              </p>
            </div>
          )}

          {/* Paso 2 — Datos de la empresa */}
          {step === 2 && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="orgNombre">Nombre de la empresa</Label>
                <Input
                  id="orgNombre"
                  value={orgNombre}
                  onChange={(e) => handleOrgNombreChange(e.target.value)}
                  placeholder="Mi Empresa S.A. de C.V."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgSlug">
                  Identificador único
                  <span className="text-muted-foreground font-normal ml-1">
                    (solo letras, números y guiones)
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">tracea.app/</span>
                  <Input
                    id="orgSlug"
                    value={orgSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="mi-empresa"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Cambiar plan
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (validateStep2()) setStep(3);
                  }}
                >
                  Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3 — Datos del administrador */}
          {step === 3 && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Dr. García López"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">
                  Cargo{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="cargo"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Responsable Sanitario"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@miempresa.mx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Confirmar contraseña</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="acepta-terminos"
                    checked={aceptaTerminos}
                    onCheckedChange={(v) => setAceptaTerminos(v === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="acepta-terminos"
                    className="text-xs font-normal leading-relaxed cursor-pointer"
                  >
                    He leído y acepto los{" "}
                    <Link
                      to="/terminos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline font-medium"
                    >
                      Términos y Condiciones
                    </Link>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="acepta-privacidad"
                    checked={aceptaPrivacidad}
                    onCheckedChange={(v) => setAceptaPrivacidad(v === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="acepta-privacidad"
                    className="text-xs font-normal leading-relaxed cursor-pointer"
                  >
                    He leído y acepto el{" "}
                    <Link
                      to="/privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline font-medium"
                    >
                      Aviso de Privacidad
                    </Link>
                  </Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                </Button>
                <Button
                  className="flex-1"
                  disabled={submitting || !aceptaTerminos || !aceptaPrivacidad}
                  onClick={() => {
                    if (validateStep3()) handleRegister();
                  }}
                >
                  {submitting ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              </div>
            </div>
          )}

          {/* Paso 4 — Confirmación + indicación de pago */}
          {step === 4 && (
            <div className="text-center space-y-4 py-2 max-w-md mx-auto">
              <div className="mx-auto h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">¡Cuenta creada!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Te enviamos un correo a <span className="font-medium">{email}</span>. Confírmalo
                  para poder iniciar sesión.
                </p>
              </div>
              {seleccion && (
                <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-left">
                  <p className="font-medium text-foreground mb-1">Siguiente paso: pago</p>
                  <p className="text-muted-foreground text-xs">
                    Una vez confirmes tu correo e inicies sesión, te llevaremos automáticamente al
                    pago de <span className="font-medium text-foreground">{seleccion.nombre}</span> (
                    {seleccion.precio}
                    {seleccion.tipo === "plan" ? ` ${seleccion.periodo}` : " · pago único"}). Tu
                    cuenta queda bloqueada hasta que completes el pago.
                  </p>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() =>
                  navigate(seleccion ? `/login?plan=${seleccion.id}` : "/login")
                }
              >
                Ir al inicio de sesión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </main>

      <footer className="px-6 pb-6 text-center text-xs text-muted-foreground space-x-3">
        <Link to="/terminos" className="hover:text-foreground hover:underline">Términos</Link>
        <span className="text-border">·</span>
        <Link to="/privacidad" className="hover:text-foreground hover:underline">Privacidad</Link>
        <span className="text-border">·</span>
        <span>© {new Date().getFullYear()} TRACEA</span>
      </footer>
    </div>
  );
}