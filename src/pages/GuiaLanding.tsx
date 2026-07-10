import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Download, Mail } from "lucide-react";
import traceaLogo from "@/assets/tracea-official.png.asset.json";

interface GuiaConfig {
  slug: "dm" | "farma";
  titulo: string;
  bajada: string;
  bullets: string[];
}

const GUIAS: Record<string, GuiaConfig> = {
  "guia-dm": {
    slug: "dm",
    titulo:
      "Los 5 errores que generan observaciones en auditorías COFEPRIS — Dispositivos Médicos",
    bajada:
      "Guía práctica para fabricantes de dispositivos médicos que operan bajo NOM-241. Basada en más de 200 auditorías reales.",
    bullets: [
      "Los 5 hallazgos más frecuentes de COFEPRIS",
      "Cómo estructurar tu expediente de gestión de riesgos",
      "Checklist previo a auditoría",
    ],
  },
  "guia-farma": {
    slug: "farma",
    titulo:
      "Los 5 errores que generan observaciones en auditorías COFEPRIS — Farmacéutica",
    bajada:
      "Guía práctica para laboratorios farmacéuticos que operan bajo NOM-059 y FEUM. Basada en auditorías reales.",
    bullets: [
      "Los 5 hallazgos más frecuentes en industria farmacéutica",
      "Cómo documentar tu análisis ICH-Q9",
      "Checklist previo a auditoría",
    ],
  },
};

export default function GuiaLanding() {
  const params = useParams();
  const routeKey = `guia-${params.tipo ?? ""}`;
  const guia = useMemo(() => GUIAS[routeKey], [routeKey]);
  const { toast } = useToast();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<null | { existing: boolean }>(null);

  if (!guia) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">Guía no encontrada</h1>
          <Link to="/" className="text-primary underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) {
      toast({ title: "Nombre y correo son obligatorios", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { FunctionsHttpError } = await import("@supabase/supabase-js");
      const { data, error } = await supabase.functions.invoke("lead-magnet-signup", {
        body: {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          empresa: empresa.trim(),
          telefono: telefono.trim(),
          ebook_slug: guia.slug,
        },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          } catch { /* noop */ }
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setSent({ existing: !!data?.existing_user });
    } catch (err: any) {
      toast({
        title: "No pudimos enviarte la guía",
        description: err.message ?? "Intenta de nuevo en un momento.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 sm:px-10 pt-8 flex justify-center">
        <Link to="/">
          <img src={traceaLogo.url} alt="TRACEA" className="h-10 w-auto" />
        </Link>
      </header>

      <main className="flex-1 px-6 py-10 sm:py-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <p className="inline-block text-xs font-semibold tracking-wide uppercase text-[#E8671A] bg-orange-50 px-3 py-1 rounded">
              Guía gratuita en PDF
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#042C53] leading-tight">
              {guia.titulo}
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              {guia.bajada}
            </p>
            <ul className="space-y-2 pt-2">
              {guia.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-[#185FA5] shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-semibold">Bono incluido:</p>
              <p className="text-sm text-muted-foreground">
                Al descargar la guía activamos automáticamente tu cuenta gratuita
                de <strong>14 días en TRACEA</strong> — la plataforma que documenta
                tu expediente de gestión de riesgos.
              </p>
            </div>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">
                {sent ? "¡Listo! Revisa tu correo" : "Descarga la guía + activa tu cuenta"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="space-y-4 text-sm">
                  <div className="flex gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">Enviamos a {email}:</p>
                      <ul className="mt-2 space-y-1 text-muted-foreground list-disc pl-5">
                        <li>Link de descarga de la guía en PDF</li>
                        {sent.existing ? (
                          <li>Enlace de acceso directo a tu cuenta TRACEA</li>
                        ) : (
                          <li>Credenciales de acceso a tu cuenta trial de 14 días</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ¿No lo ves? Revisa tu bandeja de spam o promociones.
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <a href="https://tracea.com.mx/login">Entrar a TRACEA</a>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre">Nombre completo *</Label>
                    <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Correo profesional *</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa">Empresa</Label>
                    <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="(opcional)" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="(opcional)" />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full text-white font-semibold"
                    style={{ backgroundColor: "#E8671A" }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {submitting ? "Enviando..." : "Descargar guía + activar cuenta"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Al continuar aceptas nuestros{" "}
                    <Link to="/terminos" className="underline">Términos</Link> y el{" "}
                    <Link to="/privacidad" className="underline">Aviso de Privacidad</Link>.
                    Sin tarjeta de crédito · Acceso completo por 14 días.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-6">
        © {new Date().getFullYear()} TRACEA · tracea.com.mx
      </footer>
    </div>
  );
}