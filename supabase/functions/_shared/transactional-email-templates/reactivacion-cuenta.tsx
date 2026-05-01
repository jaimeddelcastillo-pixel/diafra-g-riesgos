/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, inlineLink } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  diasInactividad?: number
  mensajePersonalizado?: string
  loginUrl?: string
  soporteEmail?: string
}

const ReactivacionCuentaEmail = ({
  nombre, organizacion, diasInactividad, mensajePersonalizado, loginUrl, soporteEmail,
}: Props) => {
  const safeLoginUrl = loginUrl || 'https://tracea.com.mx/login'
  const safeSoporte = soporteEmail || 'soporte@tracea.com.mx'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const orgLabel = organizacion ? ` de ${organizacion}` : ''
  const diasLabel = diasInactividad && diasInactividad > 0
    ? `Hemos notado que no has registrado actividad en TRACEA en los últimos ${diasInactividad} días.`
    : `Hemos notado que tu cuenta${orgLabel} no ha registrado actividad reciente en TRACEA.`
  const cuerpo = mensajePersonalizado?.trim()
    ? mensajePersonalizado.trim()
    : 'Queremos asegurarnos de que sigas aprovechando todas las herramientas de gestión de riesgos: matriz AMEF, control NPR, dictámenes y trazabilidad ISO 14971 / NOM-241.'
  return (
    <TraceaShell preview="Te extrañamos en TRACEA — reactiva tu cuenta">
      <Heading style={h1}>Te extrañamos</Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>{diasLabel}</Text>
      <Text style={text}>{cuerpo}</Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLoginUrl} style={button}>Volver a TRACEA</Button>
      </Section>
      <Text style={smallText}>Si el botón no funciona, copia y pega esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLoginUrl}</Text>
      <Hr style={hrStyle} />
      <Text style={text}>
        ¿Necesitas ayuda? Escríbenos a <a href={`mailto:${safeSoporte}`} style={inlineLink}>{safeSoporte}</a>.
      </Text>
    </TraceaShell>
  )
}

export const template = {
  component: ReactivacionCuentaEmail,
  subject: (data: Record<string, any>) =>
    data?.organizacion
      ? `Te extrañamos en TRACEA — ${data.organizacion}`
      : 'Te extrañamos en TRACEA — reactiva tu cuenta',
  displayName: 'Reactivación de cuenta',
  previewData: {
    nombre: 'Carlos Méndez',
    organizacion: 'DIAFRA',
    diasInactividad: 35,
    mensajePersonalizado: '',
    loginUrl: 'https://tracea.com.mx/login',
    soporteEmail: 'soporte@tracea.com.mx',
  },
} satisfies TemplateEntry