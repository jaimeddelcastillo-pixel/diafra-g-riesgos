import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity,ClipboardList,Settings,Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export default function Marco({titulo,children}:{titulo:string;children:ReactNode}){
 return <div className="max-w-7xl space-y-6"><header className="space-y-3"><div className="flex flex-wrap items-center gap-3"><Activity className="h-6 w-6 text-primary"/><h1 className="text-2xl font-bold">{titulo}</h1><Badge variant="outline">beta</Badge></div><nav className="flex flex-wrap gap-2" aria-label="Tendencias">{[['/tendencias','Tablero'],['/tendencias/captura','Captura'],['/tendencias/reporte','Reporte'],['/tendencias/cumplimiento','Cumplimiento'],['/tendencias/analisis','Análisis'],['/tendencias/registro-at','Registro AT'],['/tendencias/suplencias','Suplencias'],['/tendencias/catalogos','Catálogos'],['/tendencias/configuracion','Configuración']].map(([ruta,label])=><Button key={ruta} variant="outline" size="sm" asChild><Link to={ruta}>{label}</Link></Button>)}</nav></header>{children}</div>;
}
