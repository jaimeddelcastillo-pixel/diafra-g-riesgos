import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import DiplomaVerificar from "./pages/DiplomaVerificar";
import Confianza from "./pages/Confianza";
import Configuracion from "./pages/Configuracion";
import ConfiguracionAsistente from "./pages/ConfiguracionAsistente";
import Admin from "./pages/Admin";
import AdminOrg from "./pages/AdminOrg";
import AdminTickets from "./pages/AdminTickets";
import AdminAgentes from "./pages/AdminAgentes";
import AdminProtocolos from "./pages/AdminProtocolos";
import AdminRecursos from "./pages/AdminRecursos";
import AdminDC3 from "./pages/AdminDC3";
import AdminCursos from "./pages/AdminCursos";
import AdminCursoEditor from "./pages/AdminCursoEditor";
import AdminCursoEvaluacion from "./pages/AdminCursoEvaluacion";
import AdminFolios from "./pages/AdminFolios";
import AdminFoliosCancelados from "./pages/AdminFoliosCancelados";
import AdminReeditarCodigos from "./pages/AdminReeditarCodigos";
import Soporte from "./pages/Soporte";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Recuperar from "./pages/Recuperar";
import ResetPassword from "./pages/ResetPassword";
import Precios from "./pages/Precios";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import PagoPendiente from "./pages/PagoPendiente";
import Terminos from "./pages/Terminos";
import Privacidad from "./pages/Privacidad";
import NotFound from "./pages/NotFound";
import GuiaLanding from "./pages/GuiaLanding";
import { ModuloGuard } from "./components/ModuloGuard";
import { modulos, rutasPlataforma, clavesModulos } from "./modules";
import Inicio from "./pages/Inicio";
import MisDiplomas from "./pages/MisDiplomas";
import AuditoriaExterna from "./pages/AuditoriaExterna";
import AuditoriasExternas from "./pages/AuditoriasExternas";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/recuperar" element={<Recuperar />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/precios" element={<Precios />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/pago-pendiente" element={<PagoPendiente />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/confianza" element={<Confianza />} />
            <Route path="/diploma/verificar/:hash" element={<DiplomaVerificar />} />
            <Route path="/guia-:tipo" element={<GuiaLanding />} />
            {/* C6c: portal del auditor externo, fuera del menú y del asistente. */}
            <Route path="/auditoria-externa" element={<AuditoriaExterna />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Inicio />} />
              <Route element={<ModuloGuard clave={clavesModulos} mensaje="Tu organización no tiene ningún módulo activo." />}>
                {rutasPlataforma.map(({ path, Component }) => (
                  <Route key={path} path={path} element={<Component />} />
                ))}
              </Route>
              {modulos.map((m) => (
                <Route key={m.clave} element={<ModuloGuard clave={m.clave} mensaje={m.mensajeNoContratado} />}>
                  {m.rutas.map(({ path, Component }) => (
                    <Route key={path} path={path} element={<Component />} />
                  ))}
                </Route>
              ))}
              {/* P1c.1: los diplomas y DC-3 de cada persona no dependen del módulo contratado. */}
              <Route path="/mis-diplomas" element={<MisDiplomas />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/configuracion/asistente" element={<ConfiguracionAsistente />} />
              <Route path="/configuracion/auditorias" element={<AuditoriasExternas />} />
              <Route path="/configuracion/auditorias/:id" element={<AuditoriasExternas />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/org/:id" element={<AdminOrg />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/admin/agentes-ia" element={<AdminAgentes />} />
              <Route path="/admin/protocolos" element={<AdminProtocolos />} />
              <Route path="/admin/recursos" element={<AdminRecursos />} />
              <Route path="/admin/dc3" element={<AdminDC3 />} />
              <Route path="/admin/cursos" element={<AdminCursos />} />
              <Route path="/admin/cursos/:id" element={<AdminCursoEditor />} />
              <Route path="/admin/cursos/:id/evaluacion" element={<AdminCursoEvaluacion />} />
              <Route path="/admin/folios" element={<AdminFolios />} />
              <Route path="/admin/folios-cancelados" element={<AdminFoliosCancelados />} />
              <Route path="/admin/super/reeditar-codigos" element={<AdminReeditarCodigos />} />
              <Route path="/soporte" element={<Soporte />} />
              <Route path="/soporte/:id" element={<Soporte />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
