import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export function PlatformBreadcrumbs({ page, configuracion = false }: { page: string; configuracion?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <Breadcrumb aria-label="Migas de pan">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Inicio</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          {configuracion && <><BreadcrumbItem><BreadcrumbLink asChild><Link to="/configuracion">Configuración</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /></>}
          <BreadcrumbItem><BreadcrumbPage>{page}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Inicio</Link></Button>
    </div>
  );
}