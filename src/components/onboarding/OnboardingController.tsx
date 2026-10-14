import { useEffect, useMemo, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useMisModulos } from "@/hooks/useMisModulos";
import { supabase } from "@/integrations/supabase/client";
import { modulos } from "@/modules";
import type { PasoTour, TourDef } from "@/modules/tipos";
import { Paso2Tour } from "./Paso2Tour";

/** Evento para volver a ver un tour desde Ayuda (detail = clave). No borra filas. */
export const EVENTO_VER_TOUR = "tracea:ver-tour";

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador", responsable_sanitario: "Responsable Sanitario", comite_tecnico: "Comité Técnico",
  operador: "Operador", lectura: "Lectura",
};
const esGestor = (rol: string | null) => rol === "admin" || rol === "responsable_sanitario";

export function pasosPlataforma(rol: string | null): PasoTour[] {
  const gestor = esGestor(rol);
  return [
    {
      selector: '[data-onboarding="tarjetas-modulos"]',
      titulo: "Tus módulos",
      texto: gestor
        ? "Cada tarjeta es un módulo contratado por tu empresa, con los pendientes que te tocan atender. «Entrar» te lleva al módulo."
        : "Cada tarjeta es un módulo de tu empresa con tus pendientes. «Entrar» te lleva al módulo.",
    },
    {
      selector: '[data-onboarding="menu-modulos"]',
      titulo: "Menú por módulo",
      texto: "El menú agrupa las páginas de cada módulo. Se abre el grupo del módulo donde estás.",
    },
    {
      selector: '[data-onboarding="selector-empresa"]',
      titulo: "Cambiar de empresa",
      texto: "Si perteneces a varias empresas, aquí cambias de una a otra. Tu rol puede ser distinto en cada una.",
    },
    gestor
      ? { selector: '[data-onboarding="ayuda"]', titulo: "Ayuda", texto: "Levanta tickets de soporte y vuelve a ver estos tours cuando quieras." }
      : { titulo: "Ayuda", texto: "Si tienes dudas, pregunta al Asistente IA o al administrador de tu empresa." },
  ];
}

function pasoEmpresa(nombre: string, rol: string | null): PasoTour[] {
  const puede = esGestor(rol)
    ? "Puedes administrar usuarios, aprobar y validar lo que se registra en esta empresa."
    : rol === "lectura"
      ? "Puedes consultar la información de esta empresa, sin modificarla."
      : "Puedes registrar y dar seguimiento a tu trabajo en los módulos de esta empresa.";
  return [{ titulo: "Bienvenido", texto: `Estás en ${nombre} como ${ROL_LABEL[rol ?? ""] ?? rol ?? "integrante"}. ${puede}` }];
}

interface Fila { org_id: string | null; clave: string }

export function OnboardingController() {
  const { user, org, orgId, orgRole, isSuperAdmin, isImpersonating, loading } = useAuth();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const { data: catalogo } = useMisModulos();
  const [forzado, setForzado] = useState<string | null>(null);
  const [cerrado, setCerrado] = useState<string | null>(null);

  // Super admin (panel o soporte): ni tours ni escrituras.
  const bloqueado = loading || !user || isSuperAdmin() || isImpersonating;

  const { data: filas } = useQuery({
    queryKey: ["onboarding-estado", user?.id],
    enabled: !bloqueado,
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_estado").select("org_id, clave");
      if (error) throw error;
      return (data ?? []) as Fila[];
    },
  });

  useEffect(() => {
    const h = (e: Event) => setForzado((e as CustomEvent<string>).detail);
    window.addEventListener(EVENTO_VER_TOUR, h);
    return () => window.removeEventListener(EVENTO_VER_TOUR, h);
  }, []);

  const toursContratados = useMemo<TourDef[]>(() => {
    const acceso = new Set((catalogo ?? []).filter((m) => m.tiene_acceso).map((m) => m.clave));
    return modulos.filter((m) => acceso.has(m.clave)).flatMap((m) => m.tours);
  }, [catalogo]);

  const hecho = (clave: string, org: string | null) =>
    !!filas?.some((f) => f.clave === clave && f.org_id === org);

  const pendiente = useMemo<string | null>(() => {
    if (bloqueado || !filas || !orgId) return null;
    if (pathname === "/" && !hecho("plataforma", null)) return "plataforma";
    if (hecho("plataforma", null) && !hecho("empresa", orgId)) return "empresa";
    const t = toursContratados.find((t) =>
      !hecho(t.clave, orgId) && t.rutas.some((r) => matchPath({ path: r, end: true }, pathname)));
    return t?.clave ?? null;
  }, [bloqueado, filas, orgId, pathname, toursContratados]);

  const activo = bloqueado ? null : forzado ?? (pendiente !== cerrado ? pendiente : null);

  async function guardar(clave: string, saltado: boolean) {
    if (bloqueado || !user || !orgId) return;
    const registros = clave === "plataforma"
      ? [{ user_id: user.id, org_id: null, clave, saltado }, { user_id: user.id, org_id: orgId, clave: "empresa", saltado }]
      : [{ user_id: user.id, org_id: orgId, clave, saltado }];
    for (const r of registros) {
      const { error } = await supabase.from("onboarding_estado")
        .upsert({ ...r, completado_en: new Date().toISOString() }, { onConflict: "user_id,org_id,clave", ignoreDuplicates: true });
      if (error) console.error("Error guardando tour:", error);
    }
    await qc.invalidateQueries({ queryKey: ["onboarding-estado", user.id] });
  }

  const terminar = (saltado: boolean) => {
    const clave = activo!;
    const eraForzado = forzado === clave;
    setForzado(null);
    setCerrado(clave);
    if (!eraForzado) void guardar(clave, saltado); // volver a ver no escribe
  };

  if (!activo) return null;
  const props = { onTerminar: () => terminar(false), onSaltar: () => terminar(true) };

  if (activo === "plataforma") {
    return <Paso2Tour key={activo} pasos={pasosPlataforma(orgRole)} onFinish={props.onTerminar} onSaltar={props.onSaltar} />;
  }
  if (activo === "empresa") {
    return <Paso2Tour key={activo} pasos={pasoEmpresa(org?.nombre ?? "tu empresa", orgRole)} onFinish={props.onTerminar} onSaltar={props.onSaltar} />;
  }
  const tour = toursContratados.find((t) => t.clave === activo);
  if (!tour) return null;
  if (tour.Componente) { const C = tour.Componente; return <C key={activo} {...props} />; }
  return <Paso2Tour key={activo} pasos={tour.pasos ?? []} onFinish={props.onTerminar} onSaltar={props.onSaltar} />;
}
