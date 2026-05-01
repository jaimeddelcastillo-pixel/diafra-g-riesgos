import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface LegalLayoutProps {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}

export function LegalLayout({ titulo, subtitulo, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <svg
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
            >
              <rect x="1" y="1" width="17" height="17" rx="3" fill="#042C53" />
              <rect x="22" y="1" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="1" y="22" width="17" height="17" rx="3" fill="#185FA5" />
              <rect x="22" y="22" width="17" height="17" rx="3" fill="#8587E8" />
              <path
                d="M18 18L22 22"
                stroke="#8587E8"
                strokeWidth="2"
                strokeDasharray="2.5 2"
                strokeLinecap="round"
              />
              <path
                d="M27 30.5L30.5 34L36 27"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-bold tracking-wide text-foreground">TRACEA</span>
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <header className="mb-8 border-b pb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </header>
        <article className="prose prose-slate dark:prose-invert max-w-none text-foreground/90 leading-relaxed text-[15px]">
          {children}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-6">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link to="/terminos" className="hover:text-foreground underline-offset-2 hover:underline">
              Términos y Condiciones
            </Link>
            <span className="text-border">·</span>
            <Link to="/privacidad" className="hover:text-foreground underline-offset-2 hover:underline">
              Aviso de Privacidad
            </Link>
            <span className="text-border">·</span>
            <a
              href="mailto:soporte@tracea.com.mx"
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              soporte@tracea.com.mx
            </a>
          </div>
          <p>© {new Date().getFullYear()} TRACEA · Follow the quality.</p>
        </div>
      </footer>
    </div>
  );
}