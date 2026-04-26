import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

function BlockScreen({ title, message }: { title: string; message: string }) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full text-center space-y-6">
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
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-2">{message}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Para más información contacta a{" "}
          <a href="mailto:soporte@tracea.com.mx" className="text-primary underline font-medium">
            soporte@tracea.com.mx
          </a>
        </p>
        <Button variant="outline" onClick={signOut} className="w-full">
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, org, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Org guard — solo aplica a usuarios con contexto de org
  // Usuarios legacy (sin org_members) e isSuperAdmin pasan siempre
  if (org && !isSuperAdmin()) {
    // Cuenta creada pero pago no completado → pantalla de pago pendiente
    if (org.estado === "pendiente") {
      return <Navigate to="/pago-pendiente" replace />;
    }

    if (org.estado === "cancelado") {
      return (
        <BlockScreen
          title="Suscripción cancelada"
          message="Tu suscripción fue cancelada. Reactívala desde /precios o contacta a soporte para recuperar el acceso."
        />
      );
    }

    if (org.estado === "suspendido") {
      return (
        <BlockScreen
          title="Suscripción suspendida"
          message="Tu pago no se procesó correctamente. Actualiza tu método de pago o contacta a soporte para reactivar tu cuenta."
        />
      );
    }

    if (!org.activo) {
      return (
        <BlockScreen
          title="Cuenta suspendida"
          message="Tu organización ha sido suspendida. Contacta al administrador de TRACEA para reactivarla."
        />
      );
    }

    const trialVencido =
      org.plan === "trial" &&
      org.trial_expires_at !== null &&
      new Date(org.trial_expires_at) < new Date();

    if (trialVencido) {
      return (
        <BlockScreen
          title="Período de prueba vencido"
          message="Tu período de prueba ha expirado. Contacta a TRACEA para continuar usando la plataforma."
        />
      );
    }
  }

  return <>{children}</>;
}
