import { useState } from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordFields } from './password-input';
afterEach(cleanup);
function Alta() {
  const [password, setPassword] = useState('');
  return <><label htmlFor="temporal">Contraseña temporal</label><input id="temporal" type="password" value={password} onChange={e => setPassword(e.target.value)}/><output data-testid="longitud">{password.length}</output><PasswordFields/></>;
}
describe('UX-1a adaptación compartida de campos', () => {
  it('Generar conserva el estado React del alta y no altera la validación nativa', async () => {
    render(<Alta/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Generar' }));
    await waitFor(() => expect(screen.getByTestId('longitud').textContent).toBe('20'));
    const input = screen.getByLabelText('Contraseña temporal') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input.type).toBe('password');
  });
  it('campos añadidos después quedan registrados y mensajes auth se traducen', async () => {
    const { rerender } = render(<PasswordFields/>);
    rerender(<><label htmlFor="later">Contraseña</label><input id="later" type="password" minLength={12}/><p role="alert">Invalid login credentials</p><PasswordFields/></>);
    await screen.findByRole('button', { name: 'Mostrar contraseña' });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Correo o contraseña incorrectos.'));
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).minLength).toBe(12);
  });
});
