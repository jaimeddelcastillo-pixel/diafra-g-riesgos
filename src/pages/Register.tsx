import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Building2, User, ArrowRight, ArrowLeft, Check } from "lucide-react";

type Step = 1 | 2 | 3;

export default function Register() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Paso 1 — Empresa
  const [orgNombre, setOrgNombre] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Paso 2 — Administrador
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSlugChange = (value: string) => {
    setOrgSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"));
  };

  const handleOrgNombreChange = (value: string) => {
    setOrgNombre(value);
    if (!orgSlug) handleSlugChange(value);
  };

  const validateStep1 = () => {
    if (!orgNombre.trim()) { toast({ title: "Nombre de empresa requerido", variant: "destructive" }); return false; }
    if (!orgSlug.trim() || orgSlug.length < 3) { toast({ title: "Identificador debe tener al menos 3 caracteres", variant: "destructive" }); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!nombre.trim()) { toast({ title: "Nombre requerido", variant: "destructive" }); return false; }
    if (!email.trim()) { toast({ title: "Correo requerido", variant: "destructive" }); return false; }
    if (password.length < 8) { toast({ title: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" }); return false; }
    if (password !== passwordConfirm) { toast({ title: "Las contraseñas no coinciden", variant: "destructive" }); return false; }
    return true;
  };

  const handleRegister = async () => {
    setSubmitting(true);
    try {
      // 1. Crear usuario en auth (envía correo de confirmación si está configurado)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      // 2. Crear org + org_member via Edge Function con service role
      //    (evita problemas de RLS cuando la sesión aún no está confirmada)
      const { data: fnData, error: fnError } = await supabase.functions.invoke("register-org", {
        body: {
          user_id: authData.user.id,
          org_nombre: orgNombre.trim(),
          org_slug: orgSlug.trim(),
        },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      setStep(3);
    } catch (err: any) {
      toast({ title: "Error al registrar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
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
            <p className="text-xs text-muted-foreground mt-1">Crear cuenta de empresa</p>
          </div>

          {/* Stepper */}
          {step < 3 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {s === 1 ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  <span className={`text-xs ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {s === 1 ? "Empresa" : "Administrador"}
                  </span>
                  {s < 2 && <div className="w-6 h-px bg-border mx-1" />}
                </div>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Paso 1 — Datos de la empresa */}
          {step === 1 && (
            <div className="space-y-4">
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
                  <span className="text-muted-foreground font-normal ml-1">(solo letras, números y guiones)</span>
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
              <Button
                className="w-full"
                onClick={() => { if (validateStep1()) setStep(2); }}
              >
                Siguiente <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Paso 2 — Datos del administrador */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Dr. García López" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@miempresa.mx" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Confirmar contraseña</Label>
                <Input id="passwordConfirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                </Button>
                <Button
                  className="flex-1"
                  disabled={submitting}
                  onClick={() => { if (validateStep2()) handleRegister(); }}
                >
                  {submitting ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3 — Confirmación */}
          {step === 3 && (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">¡Cuenta creada!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Revisa tu correo <span className="font-medium">{email}</span> para confirmar tu cuenta y luego inicia sesión.
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate("/login")}>
                Ir al inicio de sesión
              </Button>
            </div>
          )}

          {step < 3 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-primary underline">Iniciar sesión</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
