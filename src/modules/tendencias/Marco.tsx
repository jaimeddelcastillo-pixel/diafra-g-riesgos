import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/** Contenedor de pantallas de Tendencias con la apariencia de atdiafra: un solo «‹ Tablero», un solo título y su descripción.
 *  La navegación entre pantallas vive solo en el menú lateral de TRACEA. `propio` = la pantalla dibuja su propio encabezado. */
export default function Marco({ titulo, descripcion, volver = { to: '/tendencias', label: 'Tablero' }, propio = false, children }: {
  titulo: string; descripcion?: ReactNode; volver?: { to: string; label: string } | null; propio?: boolean; children: ReactNode;
}) {
  return <div className="mx-auto w-full max-w-7xl">
    {!propio && <>
      {volver && <Link to={volver.to} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ChevronLeft className="h-4 w-4" />{volver.label}</Link>}
      <h1 className="text-2xl font-semibold text-foreground">{titulo}</h1>
      {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
    </>}
    <div className={propio ? 'space-y-6' : 'mt-6 space-y-6'}>{children}</div>
  </div>;
}
