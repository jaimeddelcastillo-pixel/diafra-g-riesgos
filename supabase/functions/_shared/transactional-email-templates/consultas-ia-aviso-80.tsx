/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  restantes?: number | string
  limite?: number | string
  usadas?: number | string
  fecha_renovacion?: string
  link?: string
}

const ConsultasIaAviso80Email = ({ nombre, organizacion, restantes, limite, usadas, fecha_renovacion, link }: Props) => {
  const safeLink = link || 'https://tracea.com.mx/precios'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  return (
    <TraceaShell preview={`Te quedan ${restantes ?? ''} consultas IA este mes`}>
      <Heading style={h1}>Te quedan pocas consultas IA</Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>
        Tu organización ha usado el <strong>80%</strong> del cupo mensual de consultas al Asistente IA de TRACEA.
      </Text>
      <Section style={infoBox}>
        {organizacion && <Text style={dataRow}><strong>Organización:</strong> {organizacion}</Text>}
        <Text style={dataRow}><strong>Consultas usadas:</strong> {String(usadas ?? '—')} / {String(limite ?? '—')}</Text>
        <Text style={dataRow}><strong>Consultas restantes:</strong> {String(restantes ?? '—')}</Text>
        {fecha_renovacion && (
          <Text style={dataRow}><strong>Se renuevan el:</strong> {fecha_renovacion}</Text>
        )}
      </Section>
      <Text style={text}>
        Para evitar interrupciones puedes ampliar tu plan o comprar un pack adicional de 100 consultas que no caducan.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Ver opciones de plan</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
      <Text style={smallText}>
        Recibirás este aviso solo una vez por ciclo de facturación.
      </Text>
    </TraceaShell>
  )
}

export const template = {
  component: ConsultasIaAviso80Email,
  subject: (data: Record<string, any>) =>
    `Te quedan ${data?.restantes ?? 'pocas'} consultas IA en TRACEA este mes`,
  displayName: 'Consultas IA — aviso 80%',
  previewData: {
    nombre: 'Dirección DIAFRA',
    organizacion: 'DIAFRA',
    usadas: 24,
    limite: 30,
    restantes: 6,
    fecha_renovacion: '1 de julio de 2026',
    link: 'https://tracea.com.mx/precios',
  },
} satisfies TemplateEntry