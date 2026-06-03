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
import { AuthLayout } from "@/components/AuthLayout";

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
    <AuthLayout>
      <Card className="w-full border-0 shadow-none lg:shadow-xl lg:border">
        <CardHeader className="space-y-2 px-0 lg:px-6">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {isSignUp ? "Crea tu cuenta" : "Bienvenido de vuelta"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSignUp
              ? "Regístrate para acceder a tu panel TRACEA."
              : "Ingresa tus credenciales para acceder al panel."}
          </p>
          {itemSeleccionado && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground text-left mt-3">
              <p className="font-medium">
                Inicia sesión para continuar con: {itemSeleccionado.nombre}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Te llevaremos directo al pago.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-0 lg:px-6">
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
    </AuthLayout>
  );
}
