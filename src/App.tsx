import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Folios from "./pages/Folios";
import FolioDetail from "./pages/FolioDetail";
import Auditoria from "./pages/Auditoria";
import Catalogos from "./pages/Catalogos";
import Recursos from "./pages/Recursos.tsx";
import Capacitacion from "./pages/Capacitacion";
import ExamenFinal from "./pages/ExamenFinal";
import DiplomaVerificar from "./pages/DiplomaVerificar";
import Confianza from "./pages/Confianza";
import MisDiplomas from "./pages/MisDiplomas";
import Cumplimiento from "./pages/Cumplimiento";
import Configuracion from "./pages/Configuracion";
import Admin from "./pages/Admin";
import AdminOrg from "./pages/AdminOrg";
import AdminTickets from "./pages/AdminTickets";
import AdminAgentes from "./pages/AdminAgentes";
import AdminProtocolos from "./pages/AdminProtocolos";
import AdminRecursos from "./pages/AdminRecursos";
import AdminCursos from "./pages/AdminCursos";
import AdminCursoEditor from "./pages/AdminCursoEditor";
import AdminCursoEvaluacion from "./pages/AdminCursoEvaluacion";
import AdminFolios from "./pages/AdminFolios";
import AdminFoliosCancelados from "./pages/AdminFoliosCancelados";
import MisProtocolos from "./pages/MisProtocolos";
import Soporte from "./pages/Soporte";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Recuperar from "./pages/Recuperar";
import ResetPassword from "./pages/ResetPassword";
import Unsubscribe from "./pages/Unsubscribe";
import Precios from "./pages/Precios";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import PagoPendiente from "./pages/PagoPendiente";
import Terminos from "./pages/Terminos";
import Privacidad from "./pages/Privacidad";
import NotFound from "./pages/NotFound";

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
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/pago-pendiente" element={<PagoPendiente />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/confianza" element={<Confianza />} />
            <Route path="/diploma/verificar/:hash" element={<DiplomaVerificar />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/folios" element={<Folios />} />
              <Route path="/folios/:id" element={<FolioDetail />} />
              <Route path="/auditoria" element={<Auditoria />} />
              <Route path="/catalogos" element={<Catalogos />} />
              <Route path="/recursos" element={<Recursos />} />
              <Route path="/capacitacion" element={<Capacitacion />} />
              <Route path="/capacitacion/:cursoId/examen" element={<ExamenFinal />} />
              <Route path="/mis-diplomas" element={<MisDiplomas />} />
              <Route path="/cumplimiento" element={<Cumplimiento />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/org/:id" element={<AdminOrg />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/admin/agentes-ia" element={<AdminAgentes />} />
              <Route path="/admin/protocolos" element={<AdminProtocolos />} />
              <Route path="/admin/recursos" element={<AdminRecursos />} />
              <Route path="/admin/cursos" element={<AdminCursos />} />
              <Route path="/admin/cursos/:id" element={<AdminCursoEditor />} />
              <Route path="/admin/cursos/:id/evaluacion" element={<AdminCursoEvaluacion />} />
              <Route path="/admin/folios" element={<AdminFolios />} />
              <Route path="/admin/folios-cancelados" element={<AdminFoliosCancelados />} />
              <Route path="/mis-protocolos" element={<MisProtocolos />} />
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
