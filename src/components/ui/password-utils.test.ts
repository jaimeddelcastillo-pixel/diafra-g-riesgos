import { describe, expect, it } from 'vitest';
import { generarPassword, errorAutenticacionEs } from './password-utils';
describe('UX-1a contraseñas compartidas', () => {
  it('genera veinte caracteres con mayúsculas, minúsculas, número y símbolo', () => {
    const p = generarPassword(); expect(p).toHaveLength(20);
    expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[0-9]/); expect(p).toMatch(/[!@#$%&*\-_]/);
    expect(generarPassword()).not.toBe(p);
  });
  it('traduce credenciales sin cambiar errores ajenos a autenticación', () => {
    expect(errorAutenticacionEs('Invalid login credentials')).toBe('Correo o contraseña incorrectos.');
    expect(errorAutenticacionEs('Reporte no encontrado')).toBe('Reporte no encontrado');
  });
  it('no confunde contraseña débil con filtración y conserva longitud exigida', () => {
    expect(errorAutenticacionEs('Password should be at least 12 characters')).toBe('La contraseña debe tener al menos 12 caracteres.');
    expect(errorAutenticacionEs('Password has been pwned')).toBe('La contraseña aparece en filtraciones conocidas. Elige otra.');
    expect(errorAutenticacionEs('weak_password')).not.toContain('filtraciones');
  });
});
