/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle, infoBox, dataRow, warnBox } from './_tracea-shell.tsx'

interface Props {
  nombre?: string
  folio_codigo?: string
  proceso?: string
  organizacion?: string
  norma_nombre?: string
  norma_largo?: string
  metodologia?: string
  documento?: string
  proceso_label?: string
  link?: string
}

const FolioEnviadoFirmaEmail = ({
  nombre, folio_codigo, proceso, organizacion,
  norma_nombre, norma_largo, metodologia, documento, proceso_label, link,
}: Props) => {
  const safeLink = link || 'https://tracea.com.mx/folios'
  const saludo = nombre ? `Estimado(a) ${nombre},` : 'Estimado(a) miembro del comité,'
  const orgLabel = (organizacion || 'TRACEA').toUpperCase()
  const docLabel = documento || 'Análisis de Gestión de Riesgos'
  const procLabel = proceso_label || 'Proceso / Equipo'
  const norma = norma_nombre || 'NOM-241'
  const metod = metodologia || 'AMEF'
  const refsLargo = norma_largo || 'NOM-241-SSA1-2025'
  return (
    <TraceaShell preview={`Solicitud de firma — ${folio_codigo || 'folio TRACEA'}`}>
      <Heading style={h1}>Solicitud de firma — {orgLabel}</Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>
        Se le solicita firmar el siguiente <strong>{docLabel}</strong> ({norma} · {metod}):
      </Text>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Folio:</strong> {folio_codigo || '—'}</Text>
        <Text style={dataRow}><strong>{procLabel}:</strong> {proceso || '—'}</Text>
        <Text style={dataRow}><strong>Norma:</strong> {refsLargo} ({metod})</Text>
      </Section>
      <Section style={warnBox}>
        <Text style={{ ...text, margin: 0, fontSize: '13px' }}>
          <strong>Importante:</strong> Al firmar, declara haber revisado el contenido íntegro
          y que su firma electrónica tiene el mismo valor legal que su firma autógrafa
          conforme a {refsLargo}.
        </Text>
      </Section>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Ver y firmar folio</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: FolioEnviadoFirmaEmail,
  subject: (data: Record<string, any>) => {
    const org = data?.organizacion ? `[${String(data.organizacion).toUpperCase()}] ` : ''
    const codigo = data?.folio_codigo || 'folio'
    return `${org}Solicitud de firma — ${codigo}`
  },
  displayName: 'Folio enviado a firma',
  previewData: {
    nombre: 'Dr. Juan Pérez',
    folio_codigo: 'GR-2026-001',
    proceso: 'Línea de envasado A1',
    organizacion: 'DIAFRA',
    norma_nombre: 'NOM-241',
    norma_largo: 'NOM-241-SSA1-2025',
    metodologia: 'AMEF',
    documento: 'Archivo de Gestión de Riesgos',
    proceso_label: 'Proceso / Equipo',
    link: 'https://tracea.com.mx/folios/abc-123',
  },
} satisfies TemplateEntry