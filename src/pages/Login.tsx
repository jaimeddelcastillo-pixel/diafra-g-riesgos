import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Navigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PLANS, ADDONS, type PlanId, type AddonId } from "@/config/plans";
import iconNeon from "@/assets/tracea-icon-neon.png.asset.json";
import loginBg from "@/assets/login-bg.png.asset.json";
import traceaLogo from "@/assets/tracea-official.png.asset.json";

/* ---------- Iconos outline (símbolos SVG) ---------- */
const ICONS: Record<string, JSX.Element> = {
  nodes: (
    <g>
      <circle cx="4" cy="6" r="2" /><circle cx="20" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M5.5 7.5 10.5 16.5 M18.5 7.5 13.5 16.5 M6 6 H18" />
    </g>
  ),
  lineChart: (
    <g>
      <path d="M3 20 V4 M3 20 H21" />
      <path d="M5 16 L10 11 L14 14 L20 6" />
      <circle cx="5" cy="16" r="1.2" /><circle cx="10" cy="11" r="1.2" />
      <circle cx="14" cy="14" r="1.2" /><circle cx="20" cy="6" r="1.2" />
    </g>
  ),
  barChart: (
    <g>
      <path d="M3 20 V4 M3 20 H21" />
      <rect x="6" y="12" width="3" height="6" /><rect x="11" y="8" width="3" height="10" />
      <rect x="16" y="14" width="3" height="4" />
    </g>
  ),
  alert: (
    <g>
      <path d="M12 3 L22 20 H2 Z" /><path d="M12 10 V14 M12 17 V17.5" />
    </g>
  ),
  shield: (
    <g>
      <path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z" />
      <path d="M8.5 12 L11 14.5 L15.5 10" />
    </g>
  ),
  semaforo: (
    <g>
      <rect x="8" y="2" width="8" height="20" rx="3" />
      <circle cx="12" cy="7" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="17" r="1.6" />
    </g>
  ),
  lupa: (
    <g>
      <circle cx="10" cy="10" r="6" /><path d="M14.5 14.5 L20 20" />
    </g>
  ),
  bell: (
    <g>
      <path d="M6 16 V11 C6 7.5 8.5 5 12 5 C15.5 5 18 7.5 18 11 V16 L20 18 H4 Z" />
      <path d="M10 21 H14" />
    </g>
  ),
  cycle: (
    <g>
      <path d="M20 12 A8 8 0 1 1 12 4" /><path d="M20 4 V9 H15" />
    </g>
  ),
  gauge: (
    <g>
      <path d="M4 16 A8 8 0 0 1 20 16" /><path d="M12 16 L17 9" />
      <circle cx="12" cy="16" r="1.2" />
    </g>
  ),
  grid: (
    <g>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M3 9 H21 M3 15 H21 M9 3 V21 M15 3 V21" />
    </g>
  ),
  qr: (
    <g>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14 H17 V17 M21 14 V17 H18 M14 21 H17 V18 M21 21 V18" />
    </g>
  ),
  chain: (
    <g>
      <circle cx="4" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="20" cy="12" r="2" />
      <path d="M6 12 H10 M14 12 H18" />
    </g>
  ),
  network: (
    <g>
      <circle cx="12" cy="4" r="1.8" /><circle cx="4" cy="14" r="1.8" />
      <circle cx="20" cy="14" r="1.8" /><circle cx="12" cy="20" r="1.8" />
      <path d="M12 6 L5 13 M12 6 L19 13 M5 15 L11 19 M19 15 L13 19 M5 14 H19" />
    </g>
  ),
  checkBox: (
    <g>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 12 L11 16 L17 8" />
    </g>
  ),
  arrow: (
    <g>
      <path d="M3 12 H19" /><path d="M15 7 L20 12 L15 17" />
    </g>
  ),
  biohazard: (
    <g>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="5" r="3" /><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" />
    </g>
  ),
};
const ICON_KEYS = Object.keys(ICONS);

/* PRNG determinista para que el patrón no salte en cada render */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function IconPattern() {
  const items = useMemo(() => {
    const rand = mulberry32(73);
    const arr: { x: number; y: number; s: number; r: number; o: number; k: string }[] = [];
    for (let i = 0; i < 95; i++) {
      arr.push({
        x: rand() * 100,
        y: rand() * 100,
        s: 0.6 + rand() * 1.4, // escala
        r: rand() * 360,
        o: 0.1 + rand() * 0.03,
        k: ICON_KEYS[Math.floor(rand() * ICON_KEYS.length)],
      });
    }
    return arr;
  }, []);

  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    >
      {items.map((it, i) => (
        <g
          key={i}
          transform={`translate(${it.x} ${it.y}) rotate(${it.r}) scale(${(it.s * 4) / 24})`}
          opacity={it.o}
          style={{ transformOrigin: "center" }}
        >
          <g transform="translate(-12 -12)">{ICONS[it.k]}</g>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Página ---------- */
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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Error al iniciar sesión", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    if (itemSeleccionado) {
      try {
        const { data, error: coError } = await supabase.functions.invoke("create-checkout", {
          body: { priceId: itemSeleccionado.priceId },
        });
        if (coError) throw coError;
        if (!data?.url) throw new Error("No se recibió URL de checkout");
        window.location.href = data.url;
        return;
      } catch (e: any) {
        toast({ title: "No pudimos iniciar el cobro", description: e.message, variant: "destructive" });
        navigate("/precios");
      }
    } else {
      navigate("/");
    }
    setSubmitting(false);
  };

  const pills = [
    { label: "COFEPRIS ready", icon: ICONS.shield },
    { label: "Trazabilidad total", icon: ICONS.chain },
    { label: "Tiempo real", icon: ICONS.lineChart },
    { label: "NOM-059 · NOM-241", icon: ICONS.checkBox },
  ];

  return (
    <div
      className="min-h-screen w-full flex bg-white"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Panel izquierdo 60% */}
      <aside
        className="hidden lg:flex relative w-[60%] overflow-hidden flex-col justify-between p-12 xl:p-16 text-white"
        style={{
          backgroundColor: "#042C53",
          backgroundImage: `url(${loginBg.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Patrón de íconos viene del fondo PNG */}

        {/* Top bar */}
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img
              src={iconNeon.url}
              alt="TRACEA"
              className="h-10 w-auto object-contain"
            />
            <span
              className="text-white font-bold text-base"
              style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: "3.5px" }}
            >
              TRACEA
            </span>
          </div>
          <span
            className="text-[10px] font-semibold"
            style={{ color: "#8587E8", letterSpacing: "2px", fontFamily: "'Montserrat', sans-serif" }}
          >
            V2.0 · CLOUD
          </span>
        </div>

        {/* Bottom block */}
        <div className="relative z-10 max-w-xl">
          <h1
            className="text-white font-bold leading-tight"
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "26px" }}
          >
            Gestión de riesgos
            <br />
            <span style={{ color: "#8587E8" }}>inteligente y trazable.</span>
          </h1>

          <div className="mt-6 flex flex-wrap gap-2">
            {pills.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-white"
                style={{
                  background: "rgba(133,135,232,0.10)",
                  border: "1px solid rgba(133,135,232,0.28)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8587E8"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {p.icon}
                </svg>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* Panel derecho 40% */}
      <main className="flex-1 lg:w-[40%] flex flex-col bg-white" style={{ padding: "36px" }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            {/* Logo */}
            <div className="flex items-center mb-8 justify-center">
              <img
                src={traceaLogo.url}
                alt="TRACEA"
                className="h-32 sm:h-40 md:h-44 w-auto object-contain"
              />
            </div>

            <h2
              className="font-bold text-center"
              style={{ color: "#042C53", fontSize: "20px", fontFamily: "'Montserrat', sans-serif" }}
            >
              Acceso a la plataforma
            </h2>
            <p className="mt-1.5 text-center" style={{ color: "#9ca3af", fontSize: "12px" }}>
              Ingresa tus credenciales para continuar.
            </p>

            {itemSeleccionado && (
              <div
                className="mt-4 rounded-md px-3 py-2 text-[11px]"
                style={{
                  background: "rgba(24,95,165,0.06)",
                  border: "1px solid rgba(24,95,165,0.25)",
                  color: "#042C53",
                }}
              >
                <p className="font-medium">
                  Inicia sesión para continuar con: {itemSeleccionado.nombre}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block mb-1.5 font-semibold uppercase"
                  style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.6px" }}
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com.mx"
                  className="w-full h-10 px-3 text-sm bg-white outline-none transition-colors"
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "7px",
                    color: "#042C53",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block mb-1.5 font-semibold uppercase"
                  style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.6px" }}
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full h-10 pl-3 pr-10 text-sm bg-white outline-none transition-colors"
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "7px",
                      color: "#042C53",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-1.5 text-center">
                  <Link
                    to="/recuperar"
                    style={{ color: "#185FA5", fontSize: "11px" }}
                    className="hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 text-white font-semibold text-sm transition-opacity disabled:opacity-60"
                style={{
                  background: "#042C53",
                  borderRadius: "7px",
                  fontFamily: "'Montserrat', sans-serif",
                  letterSpacing: "0.4px",
                }}
              >
                {submitting ? "Procesando..." : "Iniciar sesión"}
              </button>

              <div className="text-center pt-1">
                <Link
                  to="/register"
                  className="inline-block hover:underline font-medium"
                  style={{ color: "#E8671A", fontSize: "12px" }}
                >
                  ¿Quieres probar TRACEA gratis? → Prueba 14 días sin tarjeta
                </Link>
              </div>
            </form>

            <div className="my-6 h-px" style={{ background: "#e5e7eb" }} />

            <div className="text-center space-y-2">
              <Link
                to="/register"
                className="block hover:underline"
                style={{ color: "#185FA5", fontSize: "11px" }}
              >
                ¿Nueva empresa? Crear cuenta →
              </Link>
              <Link
                to="/precios"
                className="block hover:underline"
                style={{ color: "#185FA5", fontSize: "11px" }}
              >
                Ver planes y precios →
              </Link>
            </div>
          </div>
        </div>

        <footer className="text-center" style={{ color: "#9ca3af", fontSize: "11px" }}>
          <Link to="/terminos" className="hover:underline">Términos</Link>
          <span className="mx-2">·</span>
          <Link to="/privacidad" className="hover:underline">Privacidad</Link>
          <span className="mx-2">·</span>
          <span>© {new Date().getFullYear()} TRACEA</span>
        </footer>
      </main>
    </div>
  );
}
