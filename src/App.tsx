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
import Configuracion from "./pages/Configuracion";
import Admin from "./pages/Admin";
import AdminOrg from "./pages/AdminOrg";
import AdminTickets from "./pages/AdminTickets";
import Soporte from "./pages/Soporte";
import Login from "./pages/Login";
import Register from "./pages/Register";
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
            <Route path="/precios" element={<Precios />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/pago-pendiente" element={<PagoPendiente />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/folios" element={<Folios />} />
              <Route path="/folios/:id" element={<FolioDetail />} />
              <Route path="/auditoria" element={<Auditoria />} />
              <Route path="/catalogos" element={<Catalogos />} />
              <Route path="/recursos" element={<Recursos />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/org/:id" element={<AdminOrg />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
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
