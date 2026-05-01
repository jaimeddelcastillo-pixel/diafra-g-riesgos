/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, hrStyle, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  empresa?: string
  email?: string
  telefono?: string
  mensaje?: string
  fecha?: string
}

const ContactoSoporteEmail = ({ nombre, empresa, email, telefono, mensaje, fecha }: Props) => (
  <TraceaShell preview={`Nuevo contacto: ${nombre || 'Sin nombre'} — ${empresa || ''}`}>
    <Heading style={h1}>Nuevo mensaje desde tracea.com.mx</Heading>
    <Text style={text}>
      Se recibió un nuevo mensaje a través del formulario público de contacto.
    </Text>
    <Section style={infoBox}>
      <Text style={dataRow}><strong>Nombre:</strong> {nombre || '—'}</Text>
      <Text style={dataRow}><strong>Empresa:</strong> {empresa || '—'}</Text>
      <Text style={dataRow}><strong>Correo:</strong> {email || '—'}</Text>
      <Text style={dataRow}><strong>Teléfono:</strong> {telefono || '—'}</Text>
      {fecha && <Text style={dataRow}><strong>Fecha:</strong> {fecha}</Text>}
    </Section>
    <Hr style={hrStyle} />
    <Text style={text}><strong>Mensaje:</strong></Text>
    <Text style={{ ...text, whiteSpace: 'pre-wrap' as const }}>{mensaje || '—'}</Text>
    <Hr style={hrStyle} />
    <Text style={smallText}>
      Responde directamente a este correo para contactar a {nombre || 'el remitente'}.
    </Text>
  </TraceaShell>
)

export const template = {
  component: ContactoSoporteEmail,
  subject: (data: Record<string, any>) => {
    const nombre = data?.nombre || 'Sin nombre'
    const empresa = data?.empresa ? ` — ${data.empresa}` : ''
    return `[Contacto TRACEA] ${nombre}${empresa}`
  },
  to: 'soporte@tracea.com.mx',
  displayName: 'Contacto desde tracea.com.mx',
  previewData: {
    nombre: 'Jane Pérez',
    empresa: 'Laboratorios ACME',
    email: 'jane@acme.mx',
    telefono: '+52 55 1234 5678',
    mensaje: 'Me interesa una demostración de la plataforma para nuestra planta en Toluca.',
    fecha: new Date().toISOString(),
  },
} satisfies TemplateEntry