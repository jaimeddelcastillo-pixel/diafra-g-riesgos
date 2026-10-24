/** Presentation only: hosted authentication remains the authority. */
export function generarPassword(): string {
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*-_'];
  const elegir = (grupo: string) => {
    const limite = 256 - (256 % grupo.length); const byte = new Uint8Array(1);
    do { crypto.getRandomValues(byte); } while (byte[0] >= limite);
    return grupo[byte[0] % grupo.length];
  };
  const caracteres = grupos.map(elegir); const todos = grupos.join('');
  while (caracteres.length < 20) caracteres.push(elegir(todos));
  for (let i = caracteres.length - 1; i > 0; i--) {
    const byte = new Uint8Array(1); const limite = 256 - (256 % (i + 1));
    do { crypto.getRandomValues(byte); } while (byte[0] >= limite);
    const j = byte[0] % (i + 1); [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
export function errorAutenticacionEs(texto: string): string {
  const t = texto.toLowerCase();
  if (/invalid login credentials|invalid credentials/.test(t)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/.test(t)) return 'Confirma tu correo electrónico antes de iniciar sesión.';
  if (/pwned|breached|known.*breach|leaked password|compromised password/.test(t)) return 'La contraseña aparece en filtraciones conocidas. Elige otra.';
  if (/same password|same_password|different from.*password/.test(t)) return 'La nueva contraseña debe ser diferente a la actual.';
  if (/password should be at least|password must be at least/.test(t)) {
    const n = texto.match(/at least (\d+)/)?.[1];
    return n ? `La contraseña debe tener al menos ${n} caracteres.` : 'La contraseña no cumple la longitud mínima requerida.';
  }
  if (/weak password|weak_password|password.*(contain|require)/.test(t)) return 'La contraseña no cumple los requisitos de seguridad. Revisa la longitud y los caracteres requeridos.';
  if (/too many requests|rate limit|security purposes.*request/.test(t)) return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  if (/user already registered|email.*already.*registered/.test(t)) return 'Ya existe una cuenta con este correo electrónico.';
  if (/auth session missing|session.*expired|invalid.*refresh token/.test(t)) return 'La sesión expiró. Inicia sesión de nuevo.';
  if (/otp.*expired|token.*expired|invalid.*token/.test(t)) return 'El enlace expiró o ya se utilizó. Solicita uno nuevo.';
  if (/signups not allowed/.test(t)) return 'El registro de nuevas cuentas no está disponible.';
  return texto;
}
