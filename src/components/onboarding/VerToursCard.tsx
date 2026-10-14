import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMisModulos } from "@/hooks/useMisModulos";
import { modulos } from "@/modules";
import { EVENTO_VER_TOUR } from "./OnboardingController";

/** Ayuda → «Ver tours de nuevo». Solo vuelve a mostrar; no borra registros. */
export function VerToursCard() {
  const navigate = useNavigate();
  const { isSuperAdmin, isImpersonating } = useAuth();
  const { data: catalogo } = useMisModulos();
  if (isSuperAdmin() || isImpersonating) return null;
  const acceso = new Set((catalogo ?? []).filter((m) => m.tiene_acceso).map((m) => m.clave));
  const tours = [
    { clave: "plataforma", titulo: "Bienvenida a TRACEA", ruta: "/" },
    ...modulos.filter((m) => acceso.has(m.clave)).flatMap((m) =>
      m.tours.map((t) => ({ clave: t.clave, titulo: t.titulo, ruta: t.rutaInicio }))),
  ];
  const ver = (clave: string, ruta: string) => {
    navigate(ruta);
    setTimeout(() => window.dispatchEvent(new CustomEvent(EVENTO_VER_TOUR, { detail: clave })), 400);
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Compass className="h-4 w-4" /> Ver tours de nuevo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {tours.map((t) => (
          <Button key={t.clave} variant="outline" size="sm" onClick={() => ver(t.clave, t.ruta)}>{t.titulo}</Button>
        ))}
      </CardContent>
    </Card>
  );
}
