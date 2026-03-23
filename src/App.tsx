import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Folios from "./pages/Folios";
import FolioDetail from "./pages/FolioDetail";
import Auditoria from "./pages/Auditoria";
import Catalogos from "./pages/Catalogos";
import Configuracion from "./pages/Configuracion";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/folios" element={<Folios />} />
            <Route path="/folios/:id" element={<FolioDetail />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route path="/catalogos" element={<Catalogos />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
