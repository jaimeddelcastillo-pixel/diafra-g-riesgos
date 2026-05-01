/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, errorBox, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  monto?: string
  concepto?: string
  link?: string
}

const PagoFallidoEmail = ({ nombre, organizacion, monto, concepto, link }: Props) => {
  const safeLink = link || 'https://tracea.com.mx/precios'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  return (
    <TraceaShell preview="No pudimos procesar tu pago — actualiza tu método de pago">
      <Heading style={h1}>No pudimos procesar tu pago</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={errorBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#b71c1c' }}>
          ⚠ El cobro de tu suscripción TRACEA fue rechazado.
        </Text>
      </Section>
      <Text style={text}>
        Para evitar la suspensión del servicio, actualiza tu método de pago a la brevedad.
        Si no se regulariza el pago, el acceso a la plataforma se suspenderá automáticamente.
      </Text>
      <Section style={infoBox}>
        {organizacion && <Text style={dataRow}><strong>Organización:</strong> {organizacion}</Text>}
        {concepto && <Text style={dataRow}><strong>Concepto:</strong> {concepto}</Text>}
        {monto && <Text style={dataRow}><strong>Monto:</strong> {monto}</Text>}
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Actualizar método de pago</Button>
      </Section>
      <Text style={smallText}>
        Si crees que esto es un error, contáctanos en{' '}
        <a href="mailto:soporte@tracea.com.mx" style={{ color: '#185FA5' }}>soporte@tracea.com.mx</a>.
      </Text>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: PagoFallidoEmail,
  subject: 'Tu pago en TRACEA no pudo procesarse — acción requerida',
  displayName: 'Pago fallido',
  previewData: {
    nombre: 'Administrador DIAFRA',
    organizacion: 'DIAFRA',
    monto: 'USD 199.00',
    concepto: 'Suscripción Professional — mensual',
    link: 'https://tracea.com.mx/precios',
  },
} satisfies TemplateEntry