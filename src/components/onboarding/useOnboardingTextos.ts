import { useAuth } from "@/hooks/useAuth";

export function useOnboardingTextos() {
  const { org, profile } = useAuth();
  const norma = org?.norma_aplicable ?? null;

  const normaLabel =
    norma === "NOM-241"
      ? "NOM-241 y FEUM"
      : norma === "NOM-059"
      ? "NOM-059 y FEUM"
      : "normativa COFEPRIS";

  const normaCorta =
    norma === "NOM-241" ? "NOM-241" : norma === "NOM-059" ? "NOM-059" : "COFEPRIS";

  const productoLabel =
    norma === "NOM-241"
      ? "dispositivos médicos"
      : norma === "NOM-059"
      ? "medicamentos"
      : "productos COFEPRIS";

  const nombre = profile?.nombre?.split(" ")[0] ?? "";

  return { norma, normaLabel, normaCorta, productoLabel, nombre };
}