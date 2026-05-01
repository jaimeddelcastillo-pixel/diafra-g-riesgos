/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle } from './_tracea-shell.tsx'

interface Props {
  siteName?: string
  confirmationUrl?: string
}

export const MagicLinkEmail: React.FC<Props> = ({ confirmationUrl = '#' }) => (
  <TraceaShell preview="Tu enlace seguro para entrar a TRACEA">
    <Heading style={h1}>Tu enlace de acceso</Heading>
    <Text style={text}>
      Usa el siguiente botón para iniciar sesión en <strong>TRACEA</strong>. Este enlace es válido
      una sola vez y expira en <strong>1 hora</strong>.
    </Text>

    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      <Button href={confirmationUrl} style={button}>Acceder a TRACEA</Button>
    </Section>

    <Text style={smallText}>Si el botón no funciona, copia y pega este enlace en tu navegador:</Text>
    <Text style={linkFallback}>{confirmationUrl}</Text>

    <Hr style={hrStyle} />
    <Text style={smallText}>
      Si no solicitaste este enlace, ignora este correo. Nadie podrá usarlo sin acceso a tu bandeja.
    </Text>
  </TraceaShell>
)

export default MagicLinkEmail