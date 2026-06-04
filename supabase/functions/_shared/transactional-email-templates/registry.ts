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
import { template as bienvenidaOrg } from './bienvenida-org.tsx'
import { template as folioEnviadoFirma } from './folio-enviado-firma.tsx'
import { template as folioFirmado } from './folio-firmado.tsx'
import { template as folioDictamen } from './folio-dictamen.tsx'
import { template as trialPorVencer } from './trial-por-vencer.tsx'
import { template as pagoFallido } from './pago-fallido.tsx'
import { template as contactoSoporte } from './contacto-soporte.tsx'
import { template as bienvenidaDemo } from './bienvenida-demo.tsx'
import { template as consultasIaAcreditadas } from './consultas-ia-acreditadas.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'bienvenida-usuario': bienvenidaUsuario,
  'recordatorio-pago': recordatorioPago,
  'reactivacion-cuenta': reactivacionCuenta,
  'bienvenida-org': bienvenidaOrg,
  'folio-enviado-firma': folioEnviadoFirma,
  'folio-firmado': folioFirmado,
  'folio-dictamen': folioDictamen,
  'trial-por-vencer': trialPorVencer,
  'pago-fallido': pagoFallido,
  'contacto-soporte': contactoSoporte,
  'bienvenida-demo': bienvenidaDemo,
  'consultas-ia-acreditadas': consultasIaAcreditadas,
}