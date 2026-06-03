import { Link } from "react-router-dom";
import traceaWhite from "@/assets/tracea-branding-white.png.asset.json";
import { ShieldCheck, Sparkles, Activity } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  /** "narrow" (default) = 60/40 split, max-w-md. "wide" = 45/55 split, max-w-2xl. */
  size?: "narrow" | "wide";
}

/**
 * Layout split 60/40 para Login / Registro.
 * Izquierda (60%): fondo tech con gradiente navy→cobalto, grid sutil, glows y logo TRACEA.
 * Derecha (40%): contenido (formulario) sobre fondo claro.
 * En móvil se colapsa a una sola columna y el panel izquierdo se oculta.
 */
export function AuthLayout({ children, size = "narrow" }: AuthLayoutProps) {
  const leftWidth = size === "wide" ? "lg:w-[45%]" : "lg:w-[60%]";
  const rightWidth = size === "wide" ? "lg:w-[55%]" : "lg:w-[40%]";
  const innerMax = size === "wide" ? "max-w-2xl" : "max-w-md";
  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Panel izquierdo — 60% */}
      <aside
        className={`hidden lg:flex relative ${leftWidth} overflow-hidden flex-col justify-between p-12 xl:p-16 text-white`}
        style={{
          background:
            "radial-gradient(circle at 20% 20%, hsl(210 75% 37% / 0.55), transparent 55%)," +
            "radial-gradient(circle at 80% 85%, hsl(239 68% 72% / 0.4), transparent 50%)," +
            "linear-gradient(135deg, hsl(210 91% 10%) 0%, hsl(210 91% 17%) 55%, hsl(210 75% 27%) 100%)",
        }}
      >
        {/* Grid sutil */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100% / 0.6) 1px, transparent 1px)," +
              "linear-gradient(90deg, hsl(0 0% 100% / 0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />

        {/* Glow superior */}
        <div
          aria-hidden
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-40"
          style={{ background: "hsl(239 68% 72%)" }}
        />
        {/* Glow inferior */}
        <div
          aria-hidden
          className="absolute -bottom-32 -right-20 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30"
          style={{ background: "hsl(210 75% 37%)" }}
        />

        {/* Top — pequeña marca de versión */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white/60">
          <Link to="/" className="hover:text-white transition-colors">
            ← Volver al sitio
          </Link>
          <span className="tracking-widest uppercase">v2.0 · Cloud</span>
        </div>

        {/* Centro — logo + tagline */}
        <div className="relative z-10 flex flex-col items-start gap-6 max-w-lg">
          <img
            src={traceaWhite.url}
            alt="TRACEA — Follow the quality"
            className="h-24 xl:h-28 w-auto object-contain drop-shadow-[0_4px_24px_rgba(133,135,232,0.35)]"
          />
          <h1 className="text-3xl xl:text-4xl font-semibold leading-tight tracking-tight">
            Gestión de riesgos
            <br />
            <span className="text-[hsl(239_68%_82%)]">inteligente y trazable.</span>
          </h1>
          <p className="text-base text-white/70 leading-relaxed">
            Plataforma SaaS para fabricantes y distribuidores de dispositivos
            médicos. Cumplimiento NOM-241, NOM-059 y FEUM con IA integrada.
          </p>
        </div>

        {/* Footer — features */}
        <div className="relative z-10 grid grid-cols-3 gap-4 max-w-xl">
          <Feature icon={<ShieldCheck className="h-4 w-4" />} title="ISO 14971" desc="Cumplimiento auditado" />
          <Feature icon={<Sparkles className="h-4 w-4" />} title="IA integrada" desc="Análisis de causa raíz" />
          <Feature icon={<Activity className="h-4 w-4" />} title="Tiempo real" desc="Dashboards y alertas" />
        </div>
      </aside>

      {/* Panel derecho — 40% */}
      <main className={`flex-1 ${rightWidth} flex flex-col`}>
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className={`w-full ${innerMax}`}>{children}</div>
        </div>
        <footer className="px-6 pb-6 text-center text-xs text-muted-foreground space-x-3">
          <Link to="/terminos" className="hover:text-foreground underline-offset-2 hover:underline">
            Términos
          </Link>
          <span className="text-border">·</span>
          <Link to="/privacidad" className="hover:text-foreground underline-offset-2 hover:underline">
            Privacidad
          </Link>
          <span className="text-border">·</span>
          <span>© {new Date().getFullYear()} TRACEA</span>
        </footer>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 backdrop-blur-sm border border-white/15">
          {icon}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-white/55 leading-snug">{desc}</p>
    </div>
  );
}