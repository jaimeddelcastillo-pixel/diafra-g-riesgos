import { BarChart3 } from 'lucide-react';
import Indicadores from './Indicadores';
import { listarPendientes } from '@/lib/pendientes';
import { ModuloTarjeta } from '../ModuloTarjeta';
import type { ModuloDef } from '../tipos';

export const indicadoresModule: ModuloDef = {
  clave: 'indicadores', nombre: 'Indicadores', descripcion: 'Indicadores del SGC y por puesto', icono: BarChart3,
  rutaInicio: '/indicadores', mensajeNoContratado: 'Indicadores no está activo para tu empresa.', ordenPorDefecto: 40,
  menu: { id: 'calidad', label: 'Calidad', icon: BarChart3, section: 'modulos', feature: 'indicadores', children: [{ id: 'indicadores', label: 'Indicadores', icon: BarChart3, section: 'modulos', route: '/indicadores' }] },
  rutas: [{ path: '/indicadores', Component: Indicadores }], tourClave: 'indicadores', tours: [],
  obtenerPendientes: async () => [{ etiqueta: 'KPI en borrador por validar', cantidad: (await listarPendientes()).filter(p => p.modulo === 'indicadores').length, ruta: '/indicadores' }],
  Tarjeta: ModuloTarjeta,
};