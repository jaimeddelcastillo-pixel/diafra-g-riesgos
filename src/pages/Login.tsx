import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { PLANS, ADDONS, type PlanId, type AddonId } from "@/config/plans";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan") as PlanId | AddonId | null;

  const itemSeleccionado = (() => {
    if (!planParam) return null;
    const plan = PLANS.find((p) => p.id === planParam);
    if (plan) return plan;
    const addon = ADDONS.find((a) => a.id === planParam);
    if (addon) return addon;
    return null;
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [nombre, setNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre: nombre || email },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Error al registrar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Registro exitoso", description: "Revisa tu correo para confirmar tu cuenta." });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Error al iniciar sesión", description: error.message, variant: "destructive" });
      } else {
        // Si vino con ?plan= → arrancar checkout; si no, al panel
        if (itemSeleccionado) {
          try {
            const { data, error: coError } = await supabase.functions.invoke(
              "create-checkout",
              { body: { priceId: itemSeleccionado.priceId } },
            );
            if (coError) throw coError;
            if (!data?.url) throw new Error("No se recibió URL de checkout");
            window.location.href = data.url;
            return;
          } catch (e: any) {
            toast({
              title: "No pudimos iniciar el cobro",
              description: e.message,
              variant: "destructive",
            });
            navigate("/precios");
          }
        } else {
          navigate("/");
        }
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 flex items-center justify-center">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14">
              <rect x="1" y="1" width="17" height="17" rx="3" fill="#042C53"/>
              <rect x="22" y="1" width="17" height="17" rx="3" fill="#185FA5"/>
              <rect x="1" y="22" width="17" height="17" rx="3" fill="#185FA5"/>
              <rect x="22" y="22" width="17" height="17" rx="3" fill="#8587E8"/>
              <path d="M18 18L22 22" stroke="#8587E8" strokeWidth="2" strokeDasharray="2.5 2" strokeLinecap="round"/>
              <path d="M27 30.5L30.5 34L36 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <CardTitle className="text-xl tracking-wide">TRACEA</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Plataforma de Gestión de Riesgos · FEUM / ISO 14971</p>
          </div>
          {itemSeleccionado && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground text-left">
              <p className="font-medium">
                Inicia sesión para continuar con: {itemSeleccionado.nombre}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Te llevaremos directo al pago.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Dr. García López" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@tracea.mx" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Procesando..." : isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}
            </Button>
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                <Link to="/register" className="text-primary underline font-medium">
                  ¿Nueva empresa? Crear cuenta →
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                <Link to="/precios" className="text-primary underline font-medium">
                  Ver planes y precios →
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-xs text-muted-foreground space-x-3">
        <Link to="/terminos" className="hover:text-foreground underline-offset-2 hover:underline">
          Términos y Condiciones
        </Link>
        <span className="text-border">·</span>
        <Link to="/privacidad" className="hover:text-foreground underline-offset-2 hover:underline">
          Aviso de Privacidad
        </Link>
      </div>
    </div>
  );
}
