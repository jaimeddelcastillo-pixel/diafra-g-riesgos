/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, button } from './_tracea-shell.tsx'

interface Props {
  nombre?: string; organizacion?: string; expediente?: string; inicia?: string; expira?: string
  permiteDescarga?: boolean; cuentaNueva?: boolean; portalUrl?: string
}

const AuditoriaInvitacionEmail = ({ nombre, organizacion, expediente, inicia, expira, permiteDescarga, cuentaNueva, portalUrl }: Props) => {
  const url = portalUrl || 'https://tracea.com.mx/auditoria-externa'
  return (
    <TraceaShell preview={`Acceso de auditoría a ${organizacion ?? 'una empresa'} en TRACEA`}>
      <Heading style={h1}>Acceso de auditoría en TRACEA</Heading>
      <Text style={text}>{nombre ? `Hola ${nombre},` : 'Hola,'}</Text>
      <Text style={text}>
        <strong>{organizacion}</strong> te dio acceso de solo lectura al expediente <strong>{expediente}</strong>.
      </Text>
      <Text style={text}>
        <strong>Vigencia:</strong> {inicia ? `del ${inicia} al ${expira}` : `hasta el ${expira}`}<br />
        <strong>Descargas:</strong> {permiteDescarga
          ? 'permitidas, como copia no controlada con marca de agua'
          : 'no permitidas; los documentos solo se pueden ver en pantalla'}
      </Text>
      <Text style={text}>
        {cuentaNueva
          ? 'Para entrar, primero crea tu contraseña con el botón. El enlace es personal y de un solo uso.'
          : 'Entra con tu cuenta de TRACEA.'} Cada consulta y descarga queda registrada.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={url} style={button}>{cuentaNueva ? 'Crear mi contraseña' : 'Abrir el expediente'}</Button>
      </Section>
    </TraceaShell>
  )
}

export const template = {
  component: AuditoriaInvitacionEmail,
  subject: (d: Record<string, any>) => `Acceso de auditoría — ${d?.organizacion ?? 'TRACEA'}`,
  displayName: 'Invitación a auditoría externa',
  previewData: { nombre: 'Auditor', organizacion: 'QA Brain adminqa', expediente: 'Auditoría COFEPRIS oct-2026', inicia: '15 de octubre de 2026', expira: '14 de noviembre de 2026', permiteDescarga: true, cuentaNueva: true, portalUrl: 'https://tracea.com.mx/auditoria-externa' },
} satisfies TemplateEntry
