import { useAuth } from "@/hooks/useAuth";
import type { FolioComite } from "@/hooks/useFolios";
import { PanelVotacion } from "./PanelVotacion";
import { PanelComentarios } from "./PanelComentarios";

// Sección Comité — discusión + votación formal antes del dictamen del RS.
export function ComiteTab({
  folioId,
  orgId,
  folioEstado,
  comite,
}: {
  folioId: string;
  orgId: string;
  folioEstado: string;
  comite: FolioComite[];
}) {
  const { hasRole, user } = useAuth();
  const esRS = hasRole("responsable_sanitario");
  const esAdmin = hasRole("admin");
  const esComite = hasRole("comite_tecnico");
  const visible = esRS || esAdmin || esComite || hasRole("super_admin");

  // ¿Es miembro del comité del folio? (por user_id)
  const esMiembroFolio = comite.some((c) => c.user_id && c.user_id === user?.id);
  const puedeComentar = esRS || esAdmin || esComite || esMiembroFolio;

  if (!visible) return null;

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-primary text-primary-foreground px-3 py-1.5 text-[11px] font-bold tracking-wide flex items-center gap-2">
        <span>II-B</span>
        <span className="opacity-80">·</span>
        <span>DISCUSIÓN Y VOTACIÓN DEL COMITÉ TÉCNICO</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <PanelVotacion
          folioId={folioId}
          orgId={orgId}
          folioEstado={folioEstado}
          comite={comite}
          isRS={esRS || esAdmin}
        />
        <PanelComentarios
          folioId={folioId}
          orgId={orgId}
          puedeComentar={puedeComentar}
          esRSoAdmin={esRS || esAdmin}
        />
      </div>
    </div>
  );
}
