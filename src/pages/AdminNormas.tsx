import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import NormaTendenciasCard from "@/components/admin/NormaTendenciasCard";

/** T5b: especificaciones normativas de plataforma (fuera de Empresas). */
export default function AdminNormas() {
  const { isSuperAdmin, loading } = useAuth();
  if (!loading && !isSuperAdmin()) return <Navigate to="/" replace />;
  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-2xl font-bold">Normas y especificaciones</h1>
      <NormaTendenciasCard />
    </div>
  );
}
