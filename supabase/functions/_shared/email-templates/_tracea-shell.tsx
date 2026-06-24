/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

export const LOGO_URL =
  'https://zcaebecdcpyqdzfqipiq.supabase.co/storage/v1/object/public/tracea-recursos/email%2Ftracea-logo-login.png'

interface ShellProps {
  preview: string
  children: React.ReactNode
}

export const TraceaShell: React.FC<ShellProps> = ({ preview, children }) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Img
            src={LOGO_URL}
            alt="TRACEA"
            width="180"
            height="145"
            style={{ display: 'block', margin: '0 auto', width: '180px', height: '145px' }}
          />
        </Section>

        <Section style={card}>{children}</Section>

        <Section style={footerBar}>
          <Text style={footerText}>
            <strong>TRACEA</strong> · Follow the quality.
          </Text>
          <Text style={footerText}>
            <a href="https://tracea.com.mx" style={footerLink}>tracea.com.mx</a>
            {' · '}
            <a href="mailto:soporte@tracea.com.mx" style={footerLink}>
              soporte@tracea.com.mx
            </a>
          </Text>
          <Text style={footerLegal}>
            © {new Date().getFullYear()} TRACEA · Suite de Gestión de Calidad para industrias reguladas por COFEPRIS.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

// Reusable styles
export const h1: React.CSSProperties = { color: '#042C53', fontSize: '22px', fontWeight: 700, margin: '0 0 20px' }
export const text: React.CSSProperties = { color: '#1f2937', fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
export const smallText: React.CSSProperties = { color: '#6b7280', fontSize: '12px', lineHeight: '1.5', margin: '0 0 6px' }
export const linkFallback: React.CSSProperties = { color: '#185FA5', fontSize: '12px', wordBreak: 'break-all', margin: '0 0 16px' }
export const inlineLink: React.CSSProperties = { color: '#185FA5', textDecoration: 'underline' }
export const hrStyle: React.CSSProperties = { borderColor: '#e6ebf1', margin: '24px 0' }
export const button: React.CSSProperties = {
  backgroundColor: '#185FA5',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '14px 28px',
  borderRadius: '6px',
  display: 'inline-block',
}
export const otpBox: React.CSSProperties = {
  backgroundColor: '#f3f6fb',
  border: '1px solid #185FA5',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center',
  margin: '24px 0',
}
export const otpText: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  color: '#042C53',
  letterSpacing: '8px',
  margin: 0,
  fontFamily: 'monospace',
}

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px 16px',
}
const brandBar: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '28px 24px',
  borderRadius: '8px 8px 0 0',
  borderTop: '1px solid #e6ebf1',
  borderLeft: '1px solid #e6ebf1',
  borderRight: '1px solid #e6ebf1',
  textAlign: 'center',
}
const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e6ebf1',
  borderTop: 'none',
  padding: '32px 28px',
}
const footerBar: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e6ebf1',
  borderTop: 'none',
  borderRadius: '0 0 8px 8px',
  padding: '20px 28px',
  textAlign: 'center',
}
const footerText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 4px',
}
const footerLink: React.CSSProperties = {
  color: '#185FA5',
  textDecoration: 'none',
}
const footerLegal: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '11px',
  lineHeight: '1.5',
  margin: '12px 0 0',
}