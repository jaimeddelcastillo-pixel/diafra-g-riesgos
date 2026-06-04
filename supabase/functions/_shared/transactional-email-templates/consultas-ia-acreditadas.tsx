/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, infoBox, dataRow, successBox } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  cantidad?: number | string
  total_extras?: number | string
  link?: string
}

const ConsultasIaAcreditadasEmail = ({ nombre, organizacion, cantidad, total_extras, link }: Props) => {
  const safeLink = link || 'https://tracea.com.mx/login'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const cant = cantidad ?? 100
  return (
    <TraceaShell preview={`${cant} consultas IA agregadas a tu cuenta`}>
      <Heading style={h1}>{cant} consultas IA agregadas</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={successBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
          ✅ Tu pago fue procesado y las consultas ya están disponibles.
        </Text>
      </Section>
      <Text style={text}>
        Estas consultas se suman a tu límite mensual del plan actual y <strong>no caducan</strong> hasta
        que las uses. Se consumen automáticamente cuando agotes el cupo mensual de tu plan.
      </Text>
      <Section style={infoBox}>
        {organizacion && <Text style={dataRow}><strong>Organización:</strong> {organizacion}</Text>}
        <Text style={dataRow}><strong>Consultas acreditadas:</strong> {String(cant)}</Text>
        {total_extras !== undefined && (
          <Text style={dataRow}><strong>Saldo total de extras:</strong> {String(total_extras)}</Text>
        )}
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Ir al Asistente IA</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: ConsultasIaAcreditadasEmail,
  subject: (data: Record<string, any>) =>
    `${data?.cantidad ?? 100} consultas IA agregadas a tu cuenta`,
  displayName: 'Consultas IA acreditadas',
  previewData: {
    nombre: 'Dirección DIAFRA',
    organizacion: 'DIAFRA',
    cantidad: 100,
    total_extras: 100,
    link: 'https://tracea.com.mx/login',
  },
} satisfies TemplateEntry