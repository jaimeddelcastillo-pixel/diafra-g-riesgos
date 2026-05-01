/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, warnBox, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  organizacion?: string
  dias_restantes?: number | string
  fecha_fin?: string
  link?: string
}

const TrialPorVencerEmail = ({ nombre, organizacion, dias_restantes, fecha_fin, link }: Props) => {
  const safeLink = link || 'https://tracea.com.mx/precios'
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const dias = dias_restantes ?? 7
  return (
    <TraceaShell preview={`Tu periodo de cortesía TRACEA termina pronto`}>
      <Heading style={h1}>Tu periodo de cortesía TRACEA termina pronto</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={warnBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#7a4500' }}>
          ⏰ Tu periodo de cortesía termina en {String(dias)} día{Number(dias) === 1 ? '' : 's'}.
        </Text>
      </Section>
      <Text style={text}>
        Para no perder el acceso a tus folios, evidencias y configuraciones, contrata
        un plan de suscripción antes de que finalice tu periodo de cortesía.
      </Text>
      <Section style={infoBox}>
        {organizacion && <Text style={dataRow}><strong>Organización:</strong> {organizacion}</Text>}
        {fecha_fin && <Text style={dataRow}><strong>Fecha de vencimiento:</strong> {fecha_fin}</Text>}
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Ver planes y contratar</Button>
      </Section>
      <Text style={smallText}>
        Si decides no continuar, tus datos permanecerán resguardados durante 30 días
        adicionales antes de ser eliminados conforme a nuestro Aviso de Privacidad.
      </Text>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: TrialPorVencerEmail,
  subject: (data: Record<string, any>) => {
    const dias = data?.dias_restantes ?? 7
    return `Tu periodo de cortesía TRACEA termina en ${dias} día${Number(dias) === 1 ? '' : 's'}`
  },
  displayName: 'Periodo de cortesía por vencer',
  previewData: {
    nombre: 'Administrador DIAFRA',
    organizacion: 'DIAFRA',
    dias_restantes: 7,
    fecha_fin: '2026-06-01',
    link: 'https://tracea.com.mx/precios',
  },
} satisfies TemplateEntry