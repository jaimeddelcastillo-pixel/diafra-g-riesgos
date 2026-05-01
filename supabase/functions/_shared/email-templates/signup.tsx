/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import { TraceaShell, h1, text, smallText, linkFallback, button, hrStyle } from './_tracea-shell.tsx'

interface Props {
  siteName?: string
  siteUrl?: string
  recipient?: string
  confirmationUrl?: string
}

export const SignupEmail: React.FC<Props> = ({ confirmationUrl = '#', recipient }) => (
  <TraceaShell preview="Confirma tu correo para activar tu cuenta TRACEA">
    <Heading style={h1}>Confirma tu correo</Heading>
    <Text style={text}>
      Bienvenido(a) a <strong>TRACEA</strong>, la suite de gestión de calidad para industrias reguladas por COFEPRIS.
    </Text>
    <Text style={text}>
      Para activar tu cuenta {recipient ? <>(<strong>{recipient}</strong>) </> : null}
      y acceder a la plataforma, confirma tu dirección con el botón siguiente:
    </Text>

    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      <Button href={confirmationUrl} style={button}>Confirmar mi correo</Button>
    </Section>

    <Text style={smallText}>Si el botón no funciona, copia y pega este enlace en tu navegador:</Text>
    <Text style={linkFallback}>{confirmationUrl}</Text>

    <Hr style={hrStyle} />
    <Text style={smallText}>
      Si no solicitaste esta cuenta, puedes ignorar este correo. El enlace expira en 24 horas.
    </Text>
  </TraceaShell>
)

export default SignupEmail