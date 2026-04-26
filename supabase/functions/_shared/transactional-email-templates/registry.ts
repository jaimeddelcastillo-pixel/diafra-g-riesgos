/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as bienvenidaUsuario } from './bienvenida-usuario.tsx'
import { template as recordatorioPago } from './recordatorio-pago.tsx'
import { template as reactivacionCuenta } from './reactivacion-cuenta.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'bienvenida-usuario': bienvenidaUsuario,
  'recordatorio-pago': recordatorioPago,
  'reactivacion-cuenta': reactivacionCuenta,
}