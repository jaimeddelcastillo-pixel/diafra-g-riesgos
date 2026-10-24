/** Only a verified hosted policy may populate these values; never infer it from a legacy input. */
export interface PasswordPolicy { minimumLength: number; requiredCharacters: string[]; hibpEnabled: boolean }
export function requisitosPassword(value: string, policy: PasswordPolicy) {
  const groups: Record<string, { label: string; regex: RegExp }> = {
    lower: { label: 'Una letra minúscula', regex: /[a-z]/ }, upper: { label: 'Una letra mayúscula', regex: /[A-Z]/ },
    digit: { label: 'Un número', regex: /[0-9]/ }, special: { label: 'Un símbolo', regex: /[^a-zA-Z0-9]/ },
  };
  return [{ label: `Al menos ${policy.minimumLength} caracteres`, met: value.length >= policy.minimumLength },
    ...policy.requiredCharacters.flatMap(key => groups[key] ? [{ label: groups[key].label, met: groups[key].regex.test(value) }] : [])];
}
export function passwordsCoinciden(password: string, confirmation: string): boolean { return password === confirmation; }
/** Presentation only: hosted authentication remains the authority, including breach acceptance. */
export function generarPassword(policy?: PasswordPolicy): string {
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*-_'];
  const elegir = (grupo: string) => {
    const limite = 256 - (256 % grupo.length); const byte = new Uint8Array(1);
    do { crypto.getRandomValues(byte); } while (byte[0] >= limite);
    return grupo[byte[0] % grupo.length];
  };
  const caracteres = grupos.map(elegir); const todos = grupos.join('');
  const length = Math.max(20, policy?.minimumLength ?? 0);
  while (caracteres.length < length) caracteres.push(elegir(todos));
  for (let i = caracteres.length - 1; i > 0; i--) {
    const byte = new Uint32Array(1); const limite = 2 ** 32 - (2 ** 32 % (i + 1));
    do { crypto.getRandomValues(byte); } while (byte[0] >= limite);
    const j = byte[0] % (i + 1); [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
export function errorAutenticacionEs(texto: string): string {
  const t = texto.toLowerCase();
  if (/invalid login credentials|invalid credentials/.test(t)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/.test(t)) return 'Confirma tu correo electrónico antes de iniciar sesión.';
  if (/pwned|breached|known.*breach|leaked password|compromised password|known to be weak and easy to guess/.test(t)) return 'La contraseña aparece en filtraciones conocidas. Elige otra.';
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
  if (/reauthentication|reauthenticate|current password/.test(t)) return 'Confirma tu contraseña actual y vuelve a intentarlo.';
  if (/email.*invalid|invalid.*email/.test(t)) return 'El correo no es válido. Revisa la dirección e inténtalo de nuevo.';
  if (/user.*not found/.test(t)) return 'No se encontró la cuenta. Revisa el correo electrónico.';
  if (/failed to fetch|network.*error/.test(t)) return 'No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.';
  if (/error.*sending.*(email|confirmation|recovery)/.test(t)) return 'No se pudo enviar el correo. Espera unos minutos y vuelve a solicitarlo.';
  return texto;
}
