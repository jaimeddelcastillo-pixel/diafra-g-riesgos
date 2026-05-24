/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, infoBox, dataRow, successBox } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  empresa?: string
  norma?: string
  trial_days?: number | string
  link?: string
}

const BienvenidaDemoEmail = ({ nombre, empresa, norma, trial_days, link }: Props) => {
  const safeLink = link || 'https://tracea.com.mx/login'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const dias = trial_days ? String(trial_days) : '14'
  return (
    <TraceaShell preview={`Tu acceso demo a TRACEA está listo — ${dias} días gratis`}>
      <Heading style={h1}>Tu acceso demo a TRACEA está listo</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={successBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
          ✅ Tu cuenta demo está activa.
        </Text>
      </Section>
      <Section style={infoBox}>
        {empresa && <Text style={dataRow}><strong>Empresa:</strong> {empresa}</Text>}
        {norma && <Text style={dataRow}><strong>Norma:</strong> {norma}</Text>}
        <Text style={dataRow}><strong>Duración:</strong> {dias} días</Text>
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Entrar a TRACEA ahora</Button>
      </Section>
      <Text style={smallText}>
        Este enlace de acceso directo expira en 1 hora. Después puedes iniciar sesión normalmente
        con tu correo en <strong>tracea.com.mx</strong> usando la opción "¿Olvidaste tu contraseña?".
      </Text>
      <Hr style={hrStyle} />
      <Text style={text}>
        Al entrar, el <strong>Asistente IA</strong> te guía paso a paso para crear tu primer
        análisis de gestión de riesgos.
      </Text>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
      <Text style={smallText}>
        ¿Dudas? Escríbenos a <strong>soporte@tracea.com.mx</strong>
      </Text>
    </TraceaShell>
  )
}

export const template = {
  component: BienvenidaDemoEmail,
  subject: (data: Record<string, any>) => {
    const dias = data?.trial_days ? String(data.trial_days) : '14'
    return `Tu acceso demo a TRACEA está listo — ${dias} días gratis`
  },
  displayName: 'Bienvenida demo (desde landing)',
  previewData: {
    nombre: 'María Pérez',
    empresa: 'Laboratorios Demo',
    norma: 'NOM-241 y FEUM',
    trial_days: 14,
    link: 'https://tracea.com.mx/login?token=demo',
  },
} satisfies TemplateEntry