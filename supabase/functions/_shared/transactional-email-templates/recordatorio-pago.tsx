/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, inlineLink } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  motivo?: string
  pagoUrl?: string
  soporteEmail?: string
}

const RecordatorioPagoEmail = ({ nombre, organizacion, motivo, pagoUrl, soporteEmail }: Props) => {
  const safePagoUrl = pagoUrl || 'https://tracea.com.mx/pago-pendiente'
  const safeSoporte = soporteEmail || 'soporte@tracea.com.mx'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const orgLabel = organizacion ? ` de ${organizacion}` : ''
  const motivoLabel = motivo?.trim()
    ? motivo.trim()
    : 'Tu cuenta tiene un pago pendiente y no podrás acceder a la plataforma hasta completarlo.'
  return (
    <TraceaShell preview="Recordatorio de pago — completa tu suscripción TRACEA">
      <Heading style={h1}>Recordatorio de pago</Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>Te escribimos respecto a tu cuenta{orgLabel} en <strong>TRACEA</strong>.</Text>
      <Text style={text}>{motivoLabel}</Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safePagoUrl} style={button}>Completar mi pago</Button>
      </Section>
      <Text style={smallText}>Si el botón no funciona, copia y pega esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safePagoUrl}</Text>
      <Hr style={hrStyle} />
      <Text style={text}>
        ¿Dudas con el pago? Escríbenos a <a href={`mailto:${safeSoporte}`} style={inlineLink}>{safeSoporte}</a>.
      </Text>
    </TraceaShell>
  )
}

export const template = {
  component: RecordatorioPagoEmail,
  subject: (data: Record<string, any>) =>
    data?.organizacion
      ? `Recordatorio de pago — ${data.organizacion}`
      : 'Recordatorio de pago — completa tu suscripción TRACEA',
  displayName: 'Recordatorio de pago',
  previewData: {
    nombre: 'Carlos Méndez',
    organizacion: 'DIAFRA',
    motivo: 'Tu cuenta está pendiente de activación. Completa el pago para acceder a TRACEA.',
    pagoUrl: 'https://tracea.com.mx/pago-pendiente',
    soporteEmail: 'soporte@tracea.com.mx',
  },
} satisfies TemplateEntry