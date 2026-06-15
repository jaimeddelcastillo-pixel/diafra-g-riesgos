import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sesionValida, setSesionValida] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase procesa el token de recovery del hash automáticamente y dispara
    // onAuthStateChange con event="PASSWORD_RECOVERY". Validamos que haya sesión.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSesionValida(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSesionValida(!!data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // Manejar contraseña filtrada / débil
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("weak") || msg.includes("pwned") || msg.includes("breach") || msg.includes("known")) {
          toast.error("Esa contraseña aparece en filtraciones públicas. Elige otra más segura (mínimo 12 caracteres, mezcla letras, números y símbolos).");
        } else if (msg.includes("same") || msg.includes("different from")) {
          toast.error("La nueva contraseña debe ser diferente a la actual.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  if (sesionValida === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border text-center space-y-4">
          <h1 className="text-lg font-bold" style={{ color: "#042C53" }}>Enlace inválido o expirado</h1>
          <p className="text-sm text-muted-foreground">
            Este enlace de recuperación ya fue usado o expiró (vigencia: 1 hora). Solicita uno nuevo.
          </p>
          <a href="/recuperar" className="inline-block text-sm hover:underline" style={{ color: "#185FA5" }}>
            Solicitar nuevo enlace
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border">
        <h1 className="text-xl font-bold mb-2" style={{ color: "#042C53" }}>
          Crear nueva contraseña
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Mínimo 8 caracteres. Recomendado: 12+ con mezcla de mayúsculas, minúsculas, números y símbolos.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: "11px", color: "#374151" }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", borderRadius: "7px", color: "#042C53" }}
            />
          </div>
          <div>
            <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: "11px", color: "#374151" }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", borderRadius: "7px", color: "#042C53" }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || sesionValida === null}
            className="w-full h-11 text-white font-semibold text-sm disabled:opacity-60"
            style={{ background: "#042C53", borderRadius: "7px" }}
          >
            {submitting ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}