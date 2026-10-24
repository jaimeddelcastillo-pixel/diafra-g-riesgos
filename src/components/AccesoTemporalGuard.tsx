import { useAuth } from '@/hooks/useAuth';
import { CambioTemporal } from './CambioTemporal';
export function AccesoTemporalGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.user && !auth.loading && auth.requiereCambioTemporal) return <CambioTemporal/>;
  if (auth.user && auth.loading) return <div className="min-h-screen flex items-center justify-center"><span role="status">Cargando…</span></div>;
  return <>{children}</>;
}