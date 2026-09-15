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
  aprobador?: string
  votos_aprueba?: number | string
  votos_observaciones?: number | string
  votos_pendientes?: number | string
  total_miembros?: number | string
  link?: string
}

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0)

const FolioListoDictamenEmail = ({
  nombre, folio_codigo, proceso, organizacion,
  norma_nombre, norma_largo, metodologia, documento, proceso_label, aprobador,
  votos_aprueba, votos_observaciones, votos_pendientes, total_miembros, link,
}: Props) => {
  const safeLink = link || 'https://tracea.com.mx/folios'
  const rol = aprobador || 'Responsable Sanitario'
  const saludo = nombre ? `Estimado(a) ${nombre},` : `Estimado(a) ${rol},`
  const orgLabel = (organizacion || 'TRACEA').toUpperCase()
  const docLabel = documento || 'Análisis de Gestión de Riesgos'
  const procLabel = proceso_label || 'Proceso / Equipo'
  const norma = norma_nombre || 'NOM-241'
  const metod = metodologia || 'AMEF'
  const refsLargo = norma_largo || 'NOM-241-SSA1-2025'
  const pend = n(votos_pendientes)
  const obs = n(votos_observaciones)
  return (
    <TraceaShell preview={`Folio listo para dictamen — ${folio_codigo || 'folio TRACEA'}`}>
      <Heading style={h1}>Folio listo para dictamen — {orgLabel}</Heading>
      <Text style={text}>{saludo}</Text>
      <Text style={text}>
        El siguiente <strong>{docLabel}</strong> ({norma} · {metod}) pasó a firma y requiere
        tu dictamen final:
      </Text>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Folio:</strong> {folio_codigo || '—'}</Text>
        <Text style={dataRow}><strong>{procLabel}:</strong> {proceso || '—'}</Text>
        <Text style={dataRow}><strong>Norma:</strong> {refsLargo} ({metod})</Text>
      </Section>
      <Section style={infoBox}>
        <Text style={dataRow}><strong>Resultado de la votación del comité</strong></Text>
        <Text style={dataRow}>Aprobaron: {n(votos_aprueba)} de {n(total_miembros)}</Text>
        <Text style={dataRow}>Aprobaron con observaciones: {obs}</Text>
        <Text style={dataRow}>Pendientes de votar: {pend}</Text>
      </Section>
      {(pend > 0 || obs > 0) && (
        <Section style={warnBox}>
          <Text style={{ ...text, margin: 0, fontSize: '13px' }}>
            {pend > 0
              ? `Atención: ${pend} miembro(s) del comité aún no registran su voto. `
              : ''}
            {obs > 0 ? `Hay ${obs} voto(s) con observaciones — revísalas antes de dictaminar.` : ''}
          </Text>
        </Section>
      )}
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button href={safeLink} style={button}>Ver folio y dictaminar</Button>
      </Section>
      <Hr style={hrStyle} />
      <Text style={smallText}>Si el botón no funciona, copia esta dirección en tu navegador:</Text>
      <Text style={linkFallback}>{safeLink}</Text>
    </TraceaShell>
  )
}

export const template = {
  component: FolioListoDictamenEmail,
  subject: (data: Record<string, any>) => {
    const org = data?.organizacion ? `[${String(data.organizacion).toUpperCase()}] ` : ''
    const codigo = data?.folio_codigo || 'folio'
    return `${org}Folio listo para dictamen — ${codigo}`
  },
  displayName: 'Folio listo para dictamen (RS)',
  previewData: {
    nombre: 'Q.F.B. María López',
    folio_codigo: 'GR-2026-001',
    proceso: 'Línea de envasado A1',
    organizacion: 'DIAFRA',
    norma_nombre: 'NOM-241',
    norma_largo: 'NOM-241-SSA1-2025',
    metodologia: 'AMEF',
    documento: 'Archivo de Gestión de Riesgos',
    proceso_label: 'Proceso / Equipo',
    aprobador: 'Responsable Sanitario',
    votos_aprueba: 3,
    votos_observaciones: 1,
    votos_pendientes: 0,
    total_miembros: 4,
    link: 'https://tracea.com.mx/folios/abc-123',
  },
} satisfies TemplateEntry
