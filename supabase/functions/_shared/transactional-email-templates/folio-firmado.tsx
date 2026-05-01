/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, successBox, infoBox, dataRow } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  folio_codigo?: string
  proceso?: string
  organizacion?: string
  aprobador?: string
  norma_nombre?: string
  metodologia?: string
  link?: string
}

const FolioFirmadoEmail = ({
  nombre, folio_codigo, proceso, organizacion, aprobador, norma_nombre, metodologia, link,
}: Props) => {
  const safeLink = link || 'https://tracea.com.mx/folios'
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Estimado(a) Responsable Sanitario,'
  const aprob = aprobador || 'Responsable Sanitario'
  const orgLabel = (organizacion || 'TRACEA').toUpperCase()
  return (
    <TraceaShell preview={`Folio listo para dictamen — ${folio_codigo || 'TRACEA'}`}>
      <Heading style={h1}>Folio listo para dictamen — {orgLabel}</Heading>
      <Text style={text}>{saludo}</Text>
      <Section style={successBox}>
        <Text style={{ ...text, margin: 0, fontWeight: 600, color: '#1b5e20' }}>
          ✅ Todos los miembros del comité han firmado.
        </Text>
      </Section>
      <Text style={text}>
        El siguiente folio está listo para su dictamen como <strong>{aprob}</strong>
        {norma_nombre ? ` (${norma_nombre}${metodologia ? ` · ${metodologia}` : ''})` : ''}:
      </Text>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Folio:</strong> {folio_codigo || '—'}</Text>
        <Text style={dataRow}><strong>Proceso / Equipo:</strong> {proceso || '—'}</Text>
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Emitir dictamen</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: FolioFirmadoEmail,
  subject: (data: Record<string, any>) => {
    const org = data?.organizacion ? `[${String(data.organizacion).toUpperCase()}] ` : ''
    const codigo = data?.folio_codigo || 'folio'
    return `${org}✅ Folio listo para dictamen — ${codigo}`
  },
  displayName: 'Folio firmado por el comité',
  previewData: {
    nombre: 'Q.F.B. María López',
    folio_codigo: 'GR-2026-001',
    proceso: 'Línea de envasado A1',
    organizacion: 'DIAFRA',
    aprobador: 'Responsable Sanitario',
    norma_nombre: 'NOM-241',
    metodologia: 'AMEF',
    link: 'https://tracea.com.mx/folios/abc-123',
  },
} satisfies TemplateEntry