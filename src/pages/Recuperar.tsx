import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setEnviado(true);
      toast.success("Si la cuenta existe, recibirás un correo en unos minutos.");
    } catch (err: any) {
      // No revelamos si el email existe o no
      setEnviado(true);
      toast.success("Si la cuenta existe, recibirás un correo en unos minutos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border">
        <h1 className="text-xl font-bold mb-2" style={{ color: "#042C53" }}>
          Recuperar contraseña
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        {enviado ? (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-900">
              Si existe una cuenta asociada a <strong>{email}</strong>, en unos minutos
              recibirás un correo con instrucciones. Revisa también tu carpeta de spam.
              El enlace es válido por 1 hora.
            </div>
            <Link to="/login" className="block text-center text-sm hover:underline" style={{ color: "#185FA5" }}>
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: "11px", color: "#374151" }}>
                Correo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="w-full h-10 px-3 text-sm bg-white outline-none"
                style={{ border: "1px solid #e5e7eb", borderRadius: "7px", color: "#042C53" }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-white font-semibold text-sm disabled:opacity-60"
              style={{ background: "#042C53", borderRadius: "7px" }}
            >
              {submitting ? "Enviando..." : "Enviar enlace"}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-sm hover:underline" style={{ color: "#185FA5" }}>
                Volver a iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}