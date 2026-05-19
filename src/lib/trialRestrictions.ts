import { useAuth } from "@/hooks/useAuth";

/**
 * Devuelve true si la organización está en plan de prueba (trial 14 días).
 * Durante el trial se restringe la descarga de PNO, formatos y protocolos
 * de referencia para limitar el acceso al material descargable.
 */
export function useIsTrial(): boolean {
  const { org } = useAuth();
  return (org?.plan ?? "").toLowerCase() === "trial";
}

export const TRIAL_DOWNLOAD_TOOLTIP =
  "Descarga disponible al activar un plan. Durante la prueba gratuita de 14 días no es posible descargar PNO, formatos ni protocolos de referencia.";