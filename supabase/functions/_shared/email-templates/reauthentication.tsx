/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import { TraceaShell, h1, text, smallText, hrStyle, otpBox, otpText } from './_tracea-shell.tsx'

interface Props {
  token?: string
}

export const ReauthenticationEmail: React.FC<Props> = ({ token = '------' }) => (
  <TraceaShell preview="Código de verificación TRACEA">
    <Heading style={h1}>Código de verificación</Heading>
    <Text style={text}>
      Para confirmar una acción sensible en <strong>TRACEA</strong>, ingresa el siguiente código
      de verificación. Es válido durante <strong>10 minutos</strong>:
    </Text>

    <Section style={otpBox}>
      <Text style={otpText}>{token}</Text>
    </Section>

    <Hr style={hrStyle} />
    <Text style={smallText}>
      Si no realizaste esta acción, no compartas el código. Por seguridad, te recomendamos cambiar
      tu contraseña desde <a href="https://tracea.com.mx/login" style={{ color: '#185FA5' }}>tracea.com.mx</a>.
    </Text>
  </TraceaShell>
)

export default ReauthenticationEmail