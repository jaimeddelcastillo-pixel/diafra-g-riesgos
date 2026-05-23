import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Paso1Bienvenida } from "./Paso1Bienvenida";
import { Paso2Tour } from "./Paso2Tour";
import { Paso3PrimerFolio } from "./Paso3PrimerFolio";

type Paso = 0 | 1 | 2 | 3;

const RUTAS_EXCLUIDAS = ["/login", "/register", "/precios", "/unsubscribe", "/checkout", "/pago-pendiente", "/terminos", "/privacidad"];

export function OnboardingController() {
  const { user, org, orgId, isSuperAdmin, isImpersonating, refreshOrg } = useAuth();
  const location = useLocation();
  const [paso, setPaso] = useState<Paso>(0);
  const [persistido, setPersistido] = useState(false);

  const enRutaExcluida = RUTAS_EXCLUIDAS.some((p) => location.pathname.startsWith(p));

  const debeMostrar =
    !!org &&
    !!user &&
    org.onboarding_completado === false &&
    !isSuperAdmin() &&
    !isImpersonating &&
    !enRutaExcluida;

  useEffect(() => {
    if (debeMostrar && paso === 0) setPaso(1);
    if (!debeMostrar && paso !== 0) setPaso(0);
  }, [debeMostrar]);

  async function marcarCompletado(saltado: boolean) {
    if (persistido || !orgId || !user) return;
    setPersistido(true);
    try {
      await supabase
        .from("organizations")
        .update({
          onboarding_completado: true,
          onboarding_saltado: saltado,
          onboarding_completado_at: new Date().toISOString(),
          onboarding_completado_por: user.id,
        })
        .eq("id", orgId);
      await refreshOrg();
    } catch (e) {
      console.error("Error guardando onboarding:", e);
    }
  }

  const saltar = async () => {
    await marcarCompletado(true);
    setPaso(0);
  };

  if (!debeMostrar || paso === 0) return null;

  if (paso === 1) {
    return (
      <Paso1Bienvenida
        onComenzar={() => setPaso(2)}
        onSaltar={saltar}
      />
    );
  }

  if (paso === 2) {
    return (
      <Paso2Tour
        onFinish={() => setPaso(3)}
        onSaltar={saltar}
      />
    );
  }

  if (paso === 3) {
    return (
      <Paso3PrimerFolio
        onCompletar={async (modo) => {
          if (modo === "asistente" || modo === "wizard") {
            localStorage.setItem("tracea_onboarding_first_folio_at", String(Date.now()));
          }
          await marcarCompletado(false);
          setPaso(0);
        }}
        onSaltar={saltar}
      />
    );
  }

  return null;
}