/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, infoBox, dataRow, successBox } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  plan?: string
  max_users?: number | string
  link?: string
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  curso: 'Curso TRACEA',
}

const BienvenidaOrgEmail = ({ nombre, organizacion, plan, max_users, link }: Props) => {
  const safeLink = link || 'https://tracea.com.mx/login'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const planLabel = plan ? (PLAN_LABELS[plan] || plan) : 'TRACEA'
  return (
    <TraceaShell preview={`Tu organización ${organizacion || ''} ya está activa en TRACEA`}>
      <Heading style={h1}>¡Bienvenido(a) a TRACEA!</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={successBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
          ✅ Tu pago ha sido procesado y tu organización está activa.
        </Text>
      </Section>
      <Text style={text}>
        Ya puedes empezar a usar TRACEA — la suite de gestión de calidad para industrias
        reguladas por COFEPRIS.
      </Text>
      <Section style={infoBox}>
        {organizacion && <Text style={dataRow}><strong>Organización:</strong> {organizacion}</Text>}
        <Text style={dataRow}><strong>Plan:</strong> {planLabel}</Text>
        {max_users && <Text style={dataRow}><strong>Usuarios incluidos:</strong> {String(max_users)}</Text>}
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Ir a la plataforma</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={text}><strong>Próximos pasos sugeridos:</strong></Text>
      <Text style={text}>1. Configura los datos generales de tu organización.</Text>
      <Text style={text}>2. Invita a los miembros del comité técnico y al Responsable Sanitario.</Text>
      <Text style={text}>3. Sube el logotipo y formato de portada para tus folios.</Text>
      <Text style={text}>4. Crea tu primer folio de Análisis de Gestión de Riesgos.</Text>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: BienvenidaOrgEmail,
  subject: (data: Record<string, any>) =>
    data?.organizacion
      ? `Bienvenido a TRACEA — ${data.organizacion} ya está activa`
      : 'Bienvenido a TRACEA — tu organización ya está activa',
  displayName: 'Bienvenida de organización',
  previewData: {
    nombre: 'Dirección DIAFRA',
    organizacion: 'DIAFRA',
    plan: 'professional',
    max_users: 25,
    link: 'https://tracea.com.mx/login',
  },
} satisfies TemplateEntry