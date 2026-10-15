import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * C6c.2: invitación (usuarios y auditores) y «Olvidé mi contraseña».
 * Toma SOLO la sesión del enlace (capturada en index.html antes de que la app la procese):
 * cierra cualquier otra sesión abierta y, si la del enlace no se puede tomar, muestra «expiró o ya se usó».
 */
type Tokens = { access_token: string; refresh_token: string };

function CampoPassword({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [ver, setVer] = useState(false);
  return (
    <div>
      <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: "11px", color: "#374151" }}>{label}</label>
      <div className="relative">
        <input
          type={ver ? "text" : "password"} required minLength={8} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-3 pr-10 text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", borderRadius: "7px", color: "#042C53" }}
        />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
          {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "listo" | "expirado">("cargando");
  const [cuenta, setCuenta] = useState<{ id: string; email: string } | null>(null);
  const tokens = useRef<Tokens | null>(null);

  useEffect(() => {
    (async () => {
      let crudo: string | null = null;
      try { crudo = sessionStorage.getItem("tracea_enlace_auth"); sessionStorage.removeItem("tracea_enlace_auth"); } catch { /* noop */ }
      const p = new URLSearchParams(crudo ?? "");
      const access_token = p.get("access_token"); const refresh_token = p.get("refresh_token");
      if (!access_token || !refresh_token || p.get("error")) { setEstado("expirado"); return; }
      tokens.current = { access_token, refresh_token };
      // Cierra cualquier sesión abierta en este navegador y toma solo la del enlace.
      await supabase.auth.signOut({ scope: "local" });
      const { data, error } = await supabase.auth.setSession(tokens.current);
      if (error || !data.user) { setEstado("expirado"); return; }
      setCuenta({ id: data.user.id, email: data.user.email ?? "" });
      setEstado("listo");
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirm) { toast.error("Las contraseñas no coinciden"); return; }
    if (!cuenta) return;
    setSubmitting(true);
    try {
      // Si otra pestaña cambió la sesión mientras tanto, se vuelve a tomar la del enlace antes de guardar.
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.user.id !== cuenta.id) {
        const { data: r, error: rErr } = tokens.current ? await supabase.auth.setSession(tokens.current) : { data: null, error: true } as any;
        if (rErr || r?.user?.id !== cuenta.id) { setEstado("expirado"); return; }
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
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
      toast.success("Contraseña guardada.");
      // Destino según la cuenta: con empresa → Inicio; solo expedientes de auditoría → portal.
      const { data: m } = await supabase.from("org_members").select("id").eq("user_id", cuenta.id).limit(1);
      window.location.replace((m ?? []).length > 0 ? "/" : "/auditoria-externa");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  if (estado === "expirado") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border text-center space-y-4">
          <h1 className="text-lg font-bold" style={{ color: "#042C53" }}>El enlace expiró o ya se usó</h1>
          <p className="text-sm text-muted-foreground">Solicita un enlace nuevo o pide que te vuelvan a invitar.</p>
          <a href="/recuperar" className="inline-block text-sm hover:underline" style={{ color: "#185FA5" }}>Solicitar nuevo enlace</a>
        </div>
      </div>
    );
  }
  if (estado === "cargando") {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border">
        <h1 className="text-xl font-bold mb-2" style={{ color: "#042C53" }}>Crear nueva contraseña</h1>
        <p className="text-sm mb-1" style={{ color: "#042C53" }}>
          Estás creando la contraseña de: <strong className="break-all">{cuenta?.email}</strong>
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Mínimo 8 caracteres. Recomendado: 12+ con mezcla de mayúsculas, minúsculas, números y símbolos.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <CampoPassword label="Nueva contraseña" value={password} onChange={setPassword} />
          <CampoPassword label="Confirmar contraseña" value={confirm} onChange={setConfirm} />
          <button type="submit" disabled={submitting}
            className="w-full h-11 text-white font-semibold text-sm disabled:opacity-60"
            style={{ background: "#042C53", borderRadius: "7px" }}>
            {submitting ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
