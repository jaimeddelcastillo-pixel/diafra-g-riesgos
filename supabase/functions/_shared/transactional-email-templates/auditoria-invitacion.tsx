/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, button } from './_tracea-shell.tsx'

interface Props {
  nombre?: string; organizacion?: string; expediente?: string; expira?: string; portalUrl?: string
}

const AuditoriaInvitacionEmail = ({ nombre, organizacion, expediente, expira, portalUrl }: Props) => {
  const url = portalUrl || 'https://tracea.com.mx/auditoria-externa'
  return (
    <TraceaShell preview={`Acceso de auditoría a ${organizacion ?? 'una empresa'} en TRACEA`}>
      <Heading style={h1}>Acceso de auditoría en TRACEA</Heading>
      <Text style={text}>{nombre ? `Hola ${nombre},` : 'Hola,'}</Text>
      <Text style={text}>
        <strong>{organizacion}</strong> te dio acceso de solo lectura al expediente <strong>{expediente}</strong>.
      </Text>
      <Text style={text}>
        El acceso vence el {expira}. Entra con tu cuenta de TRACEA. Cada consulta y descarga queda registrada.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={url} style={button}>Abrir el expediente</Button>
      </Section>
    </TraceaShell>
  )
}

export const template = {
  component: AuditoriaInvitacionEmail,
  subject: (d: Record<string, any>) => `Acceso de auditoría: ${d?.expediente ?? 'expediente'} (${d?.organizacion ?? ''})`,
  displayName: 'Invitación a auditoría externa',
  previewData: { nombre: 'Auditor', organizacion: 'QA Brain adminqa', expediente: 'Auditoría COFEPRIS oct-2026', expira: '14 nov 2026', portalUrl: 'https://tracea.com.mx/auditoria-externa' },
} satisfies TemplateEntry
