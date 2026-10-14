/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle } from './_tracea-shell.tsx'

interface Props {
  siteName?: string
  siteUrl?: string
  confirmationUrl?: string
}

export const InviteEmail: React.FC<Props> = ({ confirmationUrl = '#' }) => (
  <TraceaShell preview="Te invitaron a colaborar en TRACEA">
    <Heading style={h1}>Te invitaron a TRACEA</Heading>
    <Text style={text}>
      Has sido invitado(a) a colaborar en <strong>TRACEA</strong>, la plataforma de gestión de
      calidad y riesgos para industrias reguladas por COFEPRIS (NOM-241, NOM-059, ISO 14971).
    </Text>
    <Text style={text}>
      Acepta la invitación y crea tu contraseña para empezar a participar en los flujos de tu
      organización (matriz de riesgos, firmas, dictámenes, evidencias).
    </Text>

    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      <Button href={confirmationUrl} style={button}>Aceptar invitación</Button>
    </Section>

    <Text style={smallText}>Si el botón no funciona, copia y pega este enlace en tu navegador:</Text>
    <Text style={linkFallback}>{confirmationUrl}</Text>

    <Hr style={hrStyle} />
    <Text style={smallText}>
      Si no esperabas esta invitación puedes ignorar este correo.
    </Text>
  </TraceaShell>
)

export default InviteEmail